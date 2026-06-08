import { copyFile, mkdir, open, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, relative, resolve, sep } from "node:path";
import matter from "gray-matter";
import YAML from "yaml";
import { backupsDir, collections, getCollectionConfig, projectRoot } from "./config.js";

const frontmatterReadLimit = 64 * 1024;

function timestamp() {
	const now = new Date();
	const parts = [
		now.getFullYear(),
		String(now.getMonth() + 1).padStart(2, "0"),
		String(now.getDate()).padStart(2, "0"),
		"-",
		String(now.getHours()).padStart(2, "0"),
		String(now.getMinutes()).padStart(2, "0"),
		String(now.getSeconds()).padStart(2, "0"),
	];

	return parts.join("");
}

function ensureInsideProject(targetPath) {
	const absolutePath = resolve(targetPath);

	if (absolutePath !== projectRoot && !absolutePath.startsWith(`${projectRoot}${sep}`)) {
		throw new Error(`Refusing to access path outside project: ${absolutePath}`);
	}

	return absolutePath;
}

function slugify(value) {
	return String(value || "")
		.normalize("NFKC")
		.replace(/[^\p{Letter}\p{Number}\s_-]/gu, "")
		.trim()
		.toLowerCase()
		.replace(/[\s_-]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function normalizeDateInput(value) {
	if (!value) {
		return "";
	}

	return String(value).slice(0, 10);
}

function toMarkdownDate(value, label) {
	const normalized = normalizeDateInput(value);
	const date = new Date(`${normalized}T00:00:00.000Z`);

	if (!normalized || Number.isNaN(date.getTime())) {
		throw new Error(`${label} 不是有效日期`);
	}

	return date;
}

function cloneDefaultValue(value) {
	if (Array.isArray(value)) {
		return [...value];
	}

	return value;
}

function today() {
	return new Date().toISOString().slice(0, 10);
}

function getDefaultData(collection) {
	return Object.fromEntries(
		collection.fields.map(field => [field.name, cloneDefaultValue(field.defaultValue)]),
	);
}

function sanitizeValue(collection, field, rawValue) {
	if (field.type === "checkbox") {
		return Boolean(rawValue);
	}

	if (field.type === "number") {
		if (rawValue === "" || rawValue === null || rawValue === undefined) {
			return field.required ? 0 : undefined;
		}

		const numericValue = Number(rawValue);

		if (Number.isNaN(numericValue)) {
			throw new Error(`${field.label} 不是有效数字`);
		}

		return numericValue;
	}

	if (field.type === "tags") {
		if (Array.isArray(rawValue)) {
			return rawValue.map(item => String(item).trim()).filter(Boolean);
		}

		return String(rawValue || "")
			.split(/[\n,]/)
			.map(item => item.trim())
			.filter(Boolean);
	}

	if (field.type === "date") {
		const normalized = normalizeDateInput(rawValue);

		if (!normalized) {
			return undefined;
		}

		if (collection.storage === "markdown") {
			return toMarkdownDate(normalized, field.label);
		}

		return normalized;
	}

	return String(rawValue ?? "");
}

function sanitizeData(collection, inputData) {
	const sanitized = {};

	for (const field of collection.fields) {
		const value = sanitizeValue(collection, field, inputData[field.name]);

		if (field.required && (value === "" || value === undefined)) {
			throw new Error(`${field.label} 不能为空`);
		}

		if (value !== undefined) {
			sanitized[field.name] = value;
		}
	}

	return sanitized;
}

function sortEntries(collection, entries) {
	const direction = collection.sortField === "title" ? 1 : -1;

	return entries.sort((left, right) => {
		const leftValue = String(left.meta[collection.sortField] || left.slug || "");
		const rightValue = String(right.meta[collection.sortField] || right.slug || "");

		if (leftValue === rightValue) {
			return left.slug.localeCompare(right.slug, "zh-CN");
		}

		return leftValue.localeCompare(rightValue, "zh-CN") * direction;
	});
}

async function backupExistingFile(filePath) {
	const safeFilePath = ensureInsideProject(filePath);
	const stats = await stat(safeFilePath).catch(() => null);

	if (!stats?.isFile()) {
		return;
	}

	const archivePath = resolve(backupsDir, timestamp(), relative(projectRoot, safeFilePath));
	ensureInsideProject(archivePath);
	await mkdir(dirname(archivePath), { recursive: true });
	await copyFile(safeFilePath, archivePath);
}

function getEntryPath(collection, slug) {
	if (collection.storage === "raw-markdown") {
		return collection.file;
	}

	if (!slug) {
		throw new Error("缺少 slug");
	}

	const normalizedSlug = slugify(slug);

	if (!normalizedSlug) {
		throw new Error("slug 不能为空");
	}

	return ensureInsideProject(resolve(collection.directory, `${normalizedSlug}${collection.extension}`));
}

async function parseMarkdownFile(filePath) {
	const raw = await readFile(filePath, "utf8");
	const parsed = matter(raw);
	return {
		body: parsed.content,
		data: parsed.data || {},
	};
}

async function parseMarkdownFrontmatter(filePath) {
	const file = await open(filePath, "r");

	try {
		const buffer = Buffer.alloc(frontmatterReadLimit);
		const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
		const head = buffer.subarray(0, bytesRead).toString("utf8");

		if (!head.startsWith("---")) {
			return {};
		}

		const closingIndex = head.indexOf("\n---", 3);

		if (closingIndex === -1) {
			return (await parseMarkdownFile(filePath)).data;
		}

		const frontmatter = head.slice(0, closingIndex + "\n---".length);
		return matter(`${frontmatter}\n`).data || {};
	} finally {
		await file.close();
	}
}

async function parseYamlFile(filePath) {
	const raw = await readFile(filePath, "utf8");
	return YAML.parse(raw) || {};
}

function serializeMarkdown(data) {
	const { body = "", ...frontmatter } = data;
	return matter.stringify(body, frontmatter);
}

function serializeYaml(data) {
	return YAML.stringify(data, null, {
		lineWidth: 0,
		simpleKeys: true,
	});
}

async function readDirectoryEntries(collection) {
	const fileNames = await readdir(collection.directory);
	const entries = await Promise.all(
		fileNames
			.filter(fileName => extname(fileName) === collection.extension)
			.map(async fileName => {
				const slug = basename(fileName, collection.extension);
				return readEntrySummary(collection, slug);
			}),
	);

	return sortEntries(collection, entries);
}

async function readEntrySummary(collection, slug) {
	const filePath = getEntryPath(collection, slug);
	const fileStats = await stat(filePath).catch(() => null);

	if (!fileStats?.isFile()) {
		throw new Error("内容不存在");
	}

	if (collection.storage === "markdown") {
		return {
			collection: collection.id,
			slug: slugify(slug),
			meta: { ...getDefaultData(collection), ...(await parseMarkdownFrontmatter(filePath)) },
			updatedAt: fileStats.mtime.toISOString(),
		};
	}

	if (collection.storage === "yaml") {
		return {
			collection: collection.id,
			slug: slugify(slug),
			meta: { ...getDefaultData(collection), ...(await parseYamlFile(filePath)) },
			updatedAt: fileStats.mtime.toISOString(),
		};
	}

	return readEntry(collection.id, slug);
}

export function getCollectionsMeta() {
	return collections.map(collection => ({
		id: collection.id,
		label: collection.label,
		sortField: collection.sortField || "",
		supportsCreate: collection.supportsCreate,
		supportsDelete: collection.supportsDelete,
		fields: collection.fields,
	}));
}

export async function listEntries(collectionId) {
	const collection = getCollectionConfig(collectionId);

	if (collection.storage === "raw-markdown") {
		const entry = await readEntry(collection.id, collection.singletonSlug);
		return [summarizeEntry(collection, entry)];
	}

	const entries = await readDirectoryEntries(collection);
	return entries.map(entry => summarizeEntry(collection, entry));
}

function summarizeEntry(collection, entry) {
	const title =
		entry.meta.title ||
		(collection.id === "about" ? "关于我" : entry.slug);

	const summaryKey =
		collection.id === "posts"
			? entry.meta.published
			: collection.id === "diary"
				? entry.meta.date
				: collection.id === "album"
					? entry.meta.date
					: entry.meta.status || entry.meta.creator || "";

	return {
		slug: entry.slug,
		title,
		summary: summaryKey || "",
		updatedAt: entry.updatedAt,
	};
}

export async function readEntry(collectionId, slug) {
	const collection = getCollectionConfig(collectionId);
	const filePath = getEntryPath(collection, slug || collection.singletonSlug);
	const fileStats = await stat(filePath).catch(() => null);

	if (!fileStats?.isFile()) {
		if (collection.storage === "raw-markdown") {
			return {
				collection: collection.id,
				slug: collection.singletonSlug,
				meta: { body: "" },
				updatedAt: "",
			};
		}

		throw new Error("内容不存在");
	}

	if (collection.storage === "markdown") {
		const parsed = await parseMarkdownFile(filePath);
		return {
			collection: collection.id,
			slug: slugify(slug),
			meta: { ...getDefaultData(collection), ...parsed.data, body: parsed.body },
			updatedAt: fileStats.mtime.toISOString(),
		};
	}

	if (collection.storage === "yaml") {
		const parsed = await parseYamlFile(filePath);
		return {
			collection: collection.id,
			slug: slugify(slug),
			meta: { ...getDefaultData(collection), ...parsed },
			updatedAt: fileStats.mtime.toISOString(),
		};
	}

	const body = await readFile(filePath, "utf8");
	return {
		collection: collection.id,
		slug: collection.singletonSlug,
		meta: { body },
		updatedAt: fileStats.mtime.toISOString(),
	};
}

export async function createEmptyEntry(collectionId) {
	const collection = getCollectionConfig(collectionId);
	const meta = getDefaultData(collection);

	for (const field of collection.fields) {
		if (field.type === "date" && !meta[field.name]) {
			meta[field.name] = today();
		}
	}

	return {
		collection: collection.id,
		slug: collection.storage === "raw-markdown" ? collection.singletonSlug : "",
		meta,
	};
}

export async function saveEntry(collectionId, slug, payload) {
	const collection = getCollectionConfig(collectionId);
	const entrySlug =
		collection.storage === "raw-markdown"
			? collection.singletonSlug
			: slugify(slug || payload.title || "");

	if (collection.storage !== "raw-markdown" && !entrySlug) {
		throw new Error("请先填写 slug 或标题");
	}

	const filePath = getEntryPath(collection, entrySlug);
	const sanitized = sanitizeData(collection, payload);

	await mkdir(resolve(filePath, ".."), { recursive: true });
	await backupExistingFile(filePath);

	if (collection.storage === "markdown") {
		await writeFile(filePath, serializeMarkdown(sanitized), "utf8");
	} else if (collection.storage === "yaml") {
		await writeFile(filePath, serializeYaml(sanitized), "utf8");
	} else {
		await writeFile(filePath, sanitized.body || "", "utf8");
	}

	return readEntry(collection.id, entrySlug);
}

export async function deleteEntry(collectionId, slug) {
	const collection = getCollectionConfig(collectionId);

	if (!collection.supportsDelete) {
		throw new Error("这个内容类型不允许删除");
	}

	const filePath = getEntryPath(collection, slug);
	await backupExistingFile(filePath);
	await rm(filePath);
}

export { slugify };
