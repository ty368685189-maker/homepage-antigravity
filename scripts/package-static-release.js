import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = resolve(root, "dist");
const releaseDir = resolve(root, "release");

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

if (!existsSync(distDir)) {
	console.error("dist/ does not exist. Run `pnpm build` first.");
	process.exit(1);
}

mkdirSync(releaseDir, { recursive: true });

const archiveName = `homepage-dist-${timestamp()}.tgz`;
const archivePath = resolve(releaseDir, archiveName);

const result = spawnSync(
	"tar",
	["-czf", archivePath, "-C", distDir, "."],
	{ stdio: "inherit" },
);

if (result.error || result.status !== 0) {
	console.error("");
	console.error("Failed to create the release archive with `tar`.");
	console.error("You can still upload the whole dist/ folder manually.");
	process.exit(result.status ?? 1);
}

console.log("");
console.log(`Static release package created: ${archivePath}`);
