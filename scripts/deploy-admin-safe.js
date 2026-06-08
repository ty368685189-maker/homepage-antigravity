import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = resolve(root, "release");

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const preflight = args.has("--preflight");
const skipChecks = args.has("--skip-checks");

const deployHost = process.env.HOMEPAGE_DEPLOY_HOST;
const deployUser = process.env.HOMEPAGE_DEPLOY_USER || "root";
const deployPort = process.env.HOMEPAGE_DEPLOY_PORT || "";
const deployKey = process.env.HOMEPAGE_DEPLOY_KEY || "";
const deployRoot = process.env.HOMEPAGE_DEPLOY_ROOT || "/var/www/homepage";
const adminService = process.env.HOMEPAGE_ADMIN_SERVICE || "homepage-lite-admin";
const sshTarget = deployHost ? `${deployUser}@${deployHost}` : "";

function pad(value) {
	return String(value).padStart(2, "0");
}

function timestamp() {
	const now = new Date();
	return [
		now.getFullYear(),
		pad(now.getMonth() + 1),
		pad(now.getDate()),
		"-",
		pad(now.getHours()),
		pad(now.getMinutes()),
		pad(now.getSeconds()),
	].join("");
}

function run(command, commandArgs, options = {}) {
	const result = spawnSync(command, commandArgs, {
		cwd: root,
		stdio: "inherit",
		shell: false,
		...options,
	});

	if (result.error || result.status !== 0) {
		if (result.error) {
			console.error(result.error.message);
		}
		process.exit(result.status ?? 1);
	}
}

function runCapture(command, commandArgs, options = {}) {
	const result = spawnSync(command, commandArgs, {
		cwd: root,
		encoding: "utf8",
		shell: false,
		...options,
	});

	if (result.error || result.status !== 0) {
		if (result.stdout) process.stdout.write(result.stdout);
		if (result.stderr) process.stderr.write(result.stderr);
		process.exit(result.status ?? 1);
	}

	return result.stdout;
}

function corepackExecutable() {
	return process.platform === "win32" ? "corepack.cmd" : "corepack";
}

function quoteSh(value) {
	return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function sshArgs(command) {
	return [
		...(deployKey ? ["-i", deployKey, "-o", "IdentitiesOnly=yes"] : []),
		...(deployPort ? ["-p", deployPort] : []),
		sshTarget,
		command,
	];
}

function scpArgs(source, target) {
	return [
		...(deployKey ? ["-i", deployKey, "-o", "IdentitiesOnly=yes"] : []),
		...(deployPort ? ["-P", deployPort] : []),
		source,
		target,
	];
}

function assertSafeProjectRoot(value) {
	if (!/^\/(var\/www|www)\//.test(value)) {
		console.error("HOMEPAGE_DEPLOY_ROOT must be under /var/www/ or /www/.");
		process.exit(1);
	}
}

function printUsage() {
	console.log("");
	console.log("Safe admin deploy");
	console.log("");
	console.log("Dry run:");
	console.log("  HOMEPAGE_DEPLOY_HOST=your-server-ip pnpm deploy:admin");
	console.log("");
	console.log("Read-only server preflight:");
	console.log("  HOMEPAGE_DEPLOY_HOST=your-server-ip pnpm deploy:admin -- --preflight");
	console.log("");
	console.log("Apply:");
	console.log("  HOMEPAGE_DEPLOY_HOST=your-server-ip pnpm deploy:admin -- --apply");
	console.log("");
	console.log("Environment:");
	console.log("  HOMEPAGE_DEPLOY_HOST     server IP or SSH host");
	console.log("  HOMEPAGE_DEPLOY_USER     SSH user, defaults to root");
	console.log("  HOMEPAGE_DEPLOY_PORT     SSH port, defaults to 22");
	console.log("  HOMEPAGE_DEPLOY_KEY      optional SSH private key path");
	console.log("  HOMEPAGE_DEPLOY_ROOT     project root, defaults to /var/www/homepage");
	console.log("  HOMEPAGE_ADMIN_SERVICE   systemd service, defaults to homepage-lite-admin");
	console.log("");
	console.log("Options:");
	console.log("  --apply        upload admin-server and restart only the admin service");
	console.log("  --preflight    connect to the server and run read-only admin checks");
	console.log("  --skip-checks  skip local admin checks before packaging");
	console.log("");
}

function remotePreflightCommand() {
	return [
		"set -e",
		`ROOT=${quoteSh(deployRoot)}`,
		`SERVICE=${quoteSh(adminService)}`,
		'case "$ROOT" in /var/www/*|/www/*) ;; *) echo "unsafe project root: $ROOT"; exit 2;; esac',
		'printf "project=%s\\nservice=%s\\n" "$ROOT" "$SERVICE"',
		'printf "server load: "; uptime',
		"free -m | head -2",
		'test -d "$ROOT"',
		'test -d "$ROOT/admin-server"',
		'test -s "$ROOT/package.json"',
		'test -s "$ROOT/admin-server/src/server.js"',
		'test -s "$ROOT/admin-server/public/app.js"',
		"command -v node >/dev/null",
		'systemctl is-active "$SERVICE" >/dev/null',
		'ENV_FILE="/etc/homepage-admin.env"',
		'ADMIN_PORT=$(awk -F= \'/^ADMIN_PORT=/{print $2; exit}\' "$ENV_FILE" 2>/dev/null || true)',
		'ADMIN_BASE=$(awk -F= \'/^ADMIN_BASE_PATH=/{print $2; exit}\' "$ENV_FILE" 2>/dev/null || true)',
		'ADMIN_PORT=${ADMIN_PORT:-4310}',
		'case "$ADMIN_BASE" in "") CHECK_PATH="/api/session" ;; /*) CHECK_PATH="${ADMIN_BASE%/}/api/session" ;; *) CHECK_PATH="/${ADMIN_BASE%/}/api/session" ;; esac',
		'curl -fsS --max-time 10 "http://127.0.0.1:${ADMIN_PORT}${CHECK_PATH}" >/dev/null',
		'du -sh "$ROOT/admin-server"',
		'printf "Admin preflight completed. No files changed.\\n"',
	].join("\n");
}

function remoteCommand(archiveName) {
	const remoteArchive = `/tmp/${archiveName}`;

	return [
		"set -e",
		`ARCHIVE=${quoteSh(remoteArchive)}`,
		`ROOT=${quoteSh(deployRoot)}`,
		`SERVICE=${quoteSh(adminService)}`,
		'case "$ROOT" in /var/www/*|/www/*) ;; *) echo "unsafe project root: $ROOT"; exit 2;; esac',
		'test -d "$ROOT"',
		'test -d "$ROOT/admin-server"',
		'test -s "$ROOT/package.json"',
		'test -s "$ARCHIVE"',
		'systemctl is-active "$SERVICE" >/dev/null',
		"STAMP=$(date +%Y%m%d-%H%M%S)",
		'BACKUP_DIR="$ROOT/.admin-server-backups"',
		'BACKUP="$BACKUP_DIR/admin-server-$STAMP"',
		'CHECK="/tmp/homepage-admin-check-$STAMP"',
		'NEW="$ROOT/admin-server.new-$STAMP"',
		"REPLACED=0",
		'mkdir -p "$BACKUP_DIR" "$CHECK"',
		"rollback() {",
		"  code=$?",
		'  if [ "$code" -ne 0 ]; then',
		'    echo "admin deploy failed; cleaning up"',
		'    if [ "$REPLACED" = "1" ] && [ -d "$BACKUP" ]; then',
		'      echo "restoring previous admin-server"',
		'      rm -rf "$ROOT/admin-server"',
		'      cp -a "$BACKUP" "$ROOT/admin-server"',
		'      systemctl restart "$SERVICE" || true',
		'      systemctl is-active "$SERVICE" || true',
		"    fi",
		"  fi",
		'  rm -rf "$CHECK" "$NEW"',
		'  rm -f "$ARCHIVE"',
		'  exit "$code"',
		"}",
		"trap rollback EXIT",
		'printf "project=%s\\nservice=%s\\nbackup=%s\\n" "$ROOT" "$SERVICE" "$BACKUP"',
		'printf "preflight load: "; uptime',
		'cp -a "$ROOT/admin-server" "$BACKUP"',
		'tar -xzf "$ARCHIVE" -C "$CHECK"',
		'test -s "$CHECK/admin-server/src/server.js"',
		'test -s "$CHECK/admin-server/public/app.js"',
		'node --check "$CHECK/admin-server/src/server.js" >/dev/null',
		'node --check "$CHECK/admin-server/public/app.js" >/dev/null',
		'cp -a "$CHECK/admin-server" "$NEW"',
		"REPLACED=1",
		'rm -rf "$ROOT/admin-server"',
		'mv "$NEW" "$ROOT/admin-server"',
		'systemctl restart "$SERVICE"',
		"sleep 2",
		'systemctl is-active "$SERVICE" >/dev/null',
		'ENV_FILE="/etc/homepage-admin.env"',
		'ADMIN_PORT=$(awk -F= \'/^ADMIN_PORT=/{print $2; exit}\' "$ENV_FILE" 2>/dev/null || true)',
		'ADMIN_BASE=$(awk -F= \'/^ADMIN_BASE_PATH=/{print $2; exit}\' "$ENV_FILE" 2>/dev/null || true)',
		'ADMIN_PORT=${ADMIN_PORT:-4310}',
		'case "$ADMIN_BASE" in "") CHECK_PATH="/api/session" ;; /*) CHECK_PATH="${ADMIN_BASE%/}/api/session" ;; *) CHECK_PATH="/${ADMIN_BASE%/}/api/session" ;; esac',
		'curl -fsS --max-time 10 "http://127.0.0.1:${ADMIN_PORT}${CHECK_PATH}" >/dev/null',
		'printf "postflight load: "; uptime',
		'rm -rf "$CHECK"',
		'rm -f "$ARCHIVE"',
		"trap - EXIT",
		'printf "Admin deploy completed. Backup kept at %s\\n" "$BACKUP"',
	].join("\n");
}

if (args.has("--help") || args.has("-h")) {
	printUsage();
	process.exit(0);
}

assertSafeProjectRoot(deployRoot);

if (preflight) {
	if (!deployHost) {
		console.error("HOMEPAGE_DEPLOY_HOST is required for --preflight.");
		process.exit(1);
	}

	console.log("");
	console.log(`Running read-only admin preflight on: ${sshTarget}${deployPort ? `:${deployPort}` : ""}`);
	run("ssh", sshArgs(remotePreflightCommand()));
	console.log("");
	console.log("Read-only admin preflight completed.");
	process.exit(0);
}

if (!skipChecks) {
	console.log("Running local admin checks...");
	run(process.execPath, ["--check", resolve(root, "admin-server", "public", "app.js")]);
	run(corepackExecutable(), ["pnpm@9.14.4", "admin:test"], {
		shell: process.platform === "win32",
	});
}

mkdirSync(releaseDir, { recursive: true });

const archiveName = `homepage-admin-server-${timestamp()}.tgz`;
const archivePath = resolve(releaseDir, archiveName);

console.log("");
console.log("Packaging admin-server/...");
run("tar", ["-czf", archivePath, "-C", root, "admin-server"]);
console.log(`Created: ${archivePath}`);

console.log("");
console.log("Checking local archive...");
const archiveList = runCapture("tar", ["-tzf", archivePath]);
if (
	!archiveList.includes("admin-server/src/server.js") ||
	!archiveList.includes("admin-server/public/app.js")
) {
	console.error("Archive check failed: missing admin server files.");
	process.exit(1);
}

const command = remoteCommand(archiveName);

if (!deployHost) {
	console.log("");
	console.log("HOMEPAGE_DEPLOY_HOST is not set, so this stops after local checks and packaging.");
	console.log("Set HOMEPAGE_DEPLOY_HOST and add --apply only when you are ready to update the admin service.");
	process.exit(0);
}

if (!apply) {
	console.log("");
	console.log("Dry run only. Nothing was uploaded and no service was restarted.");
	console.log(`Target: ${sshTarget}${deployPort ? `:${deployPort}` : ""}`);
	console.log("Remote command that would run:");
	console.log(command);
	process.exit(0);
}

console.log("");
console.log(`Checking admin service before upload: ${sshTarget}`);
run("ssh", sshArgs(
	`uptime && free -m | head -2 && systemctl is-active ${quoteSh(adminService)}`,
));

console.log("");
console.log("Uploading admin archive...");
run("scp", scpArgs(archivePath, `${sshTarget}:/tmp/${archiveName}`));

console.log("");
console.log("Replacing admin-server on the server...");
run("ssh", sshArgs(command));

console.log("");
console.log("Safe admin deploy completed.");
