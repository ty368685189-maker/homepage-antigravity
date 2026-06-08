import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = resolve(root, "dist");
const releaseDir = resolve(root, "release");
const binDir = resolve(root, "node_modules", ".bin");

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const skipBuild = args.has("--skip-build");

const deployHost = process.env.HOMEPAGE_DEPLOY_HOST;
const deployUser = process.env.HOMEPAGE_DEPLOY_USER || "root";
const siteUrl = process.env.HOMEPAGE_DEPLOY_SITE_URL || "https://blog.yugold.top/";
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

function quoteSh(value) {
	return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function localBin(name) {
	return resolve(binDir, process.platform === "win32" ? `${name}.cmd` : name);
}

function printUsage() {
	console.log("");
	console.log("Safe static deploy");
	console.log("");
	console.log("Dry run:");
	console.log("  HOMEPAGE_DEPLOY_HOST=your-server-ip pnpm deploy:static");
	console.log("");
	console.log("Apply:");
	console.log("  HOMEPAGE_DEPLOY_HOST=your-server-ip pnpm deploy:static -- --apply");
	console.log("");
	console.log("Options:");
	console.log("  --apply       upload and replace the Caddy static root");
	console.log("  --skip-build  package the existing dist/ without rebuilding");
	console.log("");
}

function assertSafeUrl(url) {
	if (!/^https?:\/\//.test(url)) {
		console.error("HOMEPAGE_DEPLOY_SITE_URL must start with http:// or https://");
		process.exit(1);
	}
}

function remoteCommand(archiveName) {
	const remoteArchive = `/tmp/${archiveName}`;
	const checkUrl = siteUrl.replace(/\/+$/, "/");

	return [
		"set -e",
		`ARCHIVE=${quoteSh(remoteArchive)}`,
		`CHECK_URL=${quoteSh(checkUrl)}`,
		"ROOT=$(awk '/root \\*/ {print $3; exit}' /etc/caddy/Caddyfile)",
		'case "$ROOT" in /var/www/*/dist|/www/*/dist) ;; *) echo "unsafe caddy root: $ROOT"; exit 2;; esac',
		'test -d "$ROOT"',
		'test -s "$ROOT/index.html"',
		'test -s "$ARCHIVE"',
		"STAMP=$(date +%Y%m%d-%H%M%S)",
		'BACKUP="${ROOT}.backup-static-${STAMP}"',
		'CHECK="/tmp/homepage-dist-check-${STAMP}"',
		'printf "root=%s\\nbackup=%s\\n" "$ROOT" "$BACKUP"',
		'printf "preflight load: "; uptime',
		'cp -a "$ROOT" "$BACKUP"',
		'mkdir -p "$CHECK"',
		'tar -xzf "$ARCHIVE" -C "$CHECK"',
		'test -s "$CHECK/index.html"',
		'test -d "$CHECK/_astro"',
		'tar -xzf "$ARCHIVE" -C "$ROOT"',
		'rm -rf "$CHECK"',
		'rm -f "$ARCHIVE"',
		'curl -fsS --max-time 15 "$CHECK_URL" >/dev/null',
		'systemctl is-active caddy.service >/dev/null',
		'printf "postflight load: "; uptime',
		'du -sh "$ROOT" "$BACKUP"',
	].join("\n");
}

if (args.has("--help") || args.has("-h")) {
	printUsage();
	process.exit(0);
}

assertSafeUrl(siteUrl);

if (!skipBuild) {
	console.log("Building locally...");
	run(process.execPath, [resolve(root, "scripts", "clean-build-artifacts.js")]);
	run(localBin("astro"), ["build"], { shell: process.platform === "win32" });
	run(localBin("pagefind"), ["--site", "dist"], {
		shell: process.platform === "win32",
	});
} else if (!existsSync(distDir)) {
	console.error("dist/ does not exist. Remove --skip-build and build first.");
	process.exit(1);
}

mkdirSync(releaseDir, { recursive: true });

const archiveName = `homepage-dist-safe-${timestamp()}.tgz`;
const archivePath = resolve(releaseDir, archiveName);

console.log("");
console.log("Packaging dist/...");
run("tar", ["-czf", archivePath, "-C", distDir, "."]);
console.log(`Created: ${archivePath}`);

console.log("");
console.log("Checking local archive...");
const archiveList = runCapture("tar", ["-tzf", archivePath]);
if (!archiveList.includes("./index.html") || !archiveList.includes("./_astro/")) {
	console.error("Archive check failed: missing index.html or _astro/.");
	process.exit(1);
}

if (!deployHost) {
	console.log("");
	console.log("HOMEPAGE_DEPLOY_HOST is not set, so this stops after packaging.");
	console.log("Set HOMEPAGE_DEPLOY_HOST and add --apply when you are ready to deploy.");
	process.exit(0);
}

const command = remoteCommand(archiveName);

if (!apply) {
	console.log("");
	console.log("Dry run only. Nothing was uploaded.");
	console.log(`Target: ${sshTarget}`);
	console.log("Remote command that would run:");
	console.log(command);
	process.exit(0);
}

console.log("");
console.log(`Checking server before upload: ${sshTarget}`);
run("ssh", [sshTarget, "uptime && free -m | head -2 && systemctl is-active caddy.service"]);

console.log("");
console.log("Uploading static archive...");
run("scp", [archivePath, `${sshTarget}:/tmp/${archiveName}`]);

console.log("");
console.log("Replacing Caddy static root on the server...");
run("ssh", [sshTarget, command]);

console.log("");
console.log("Safe static deploy completed.");
