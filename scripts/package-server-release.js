import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = resolve(root, "release");

const includeEntries = [
	"admin-server",
	"deploy",
	"docs",
	"public",
	"scripts",
	"src",
	".gitignore",
	".npmrc",
	"astro.config.mjs",
	"biome.json",
	"CONTRIBUTING.md",
	"DEPLOY_CN.md",
	"frontmatter.json",
	"LICENSE",
	"package.json",
	"pagefind.yml",
	"pnpm-lock.yaml",
	"postcss.config.mjs",
	"README.md",
	"svelte.config.js",
	"tailwind.config.cjs",
	"tsconfig.json",
	"vercel.json",
];

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

const missingEntries = includeEntries.filter(entry => !existsSync(resolve(root, entry)));

if (missingEntries.length > 0) {
	console.error("These files or folders are missing:");
	for (const entry of missingEntries) {
		console.error(`- ${entry}`);
	}
	process.exit(1);
}

mkdirSync(releaseDir, { recursive: true });

const archiveName = `homepage-server-src-${timestamp()}.tgz`;
const archivePath = resolve(releaseDir, archiveName);

const result = spawnSync(
	"tar",
	["-czf", archivePath, "-C", root, ...includeEntries],
	{ stdio: "inherit" },
);

if (result.error || result.status !== 0) {
	console.error("");
	console.error("Failed to create the server source archive with `tar`.");
	console.error("You can still upload the project files manually.");
	process.exit(result.status ?? 1);
}

console.log("");
console.log(`Server source package created: ${archivePath}`);
