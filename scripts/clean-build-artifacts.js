import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, sep } from "node:path";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const targets = ["dist", ".astro", "node_modules/.astro"];

for (const target of targets) {
	const absoluteTarget = resolve(root, target);
	const isInsideProject =
		absoluteTarget === root || absoluteTarget.startsWith(`${root}${sep}`);

	if (!isInsideProject) {
		throw new Error(`Refusing to remove path outside project: ${absoluteTarget}`);
	}

	rmSync(absoluteTarget, { force: true, recursive: true });
}
