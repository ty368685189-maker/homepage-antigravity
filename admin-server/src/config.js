import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));

export const projectRoot = root;
export const adminPort = Number(process.env.ADMIN_PORT || 4310);
export const adminHost = process.env.ADMIN_HOST || "127.0.0.1";
export const adminUsername = process.env.ADMIN_USERNAME || "admin";
export const adminPassword = process.env.ADMIN_PASSWORD || "change-me";
export const sessionTtlMs = Number(process.env.ADMIN_SESSION_TTL_MS || 1000 * 60 * 60 * 12);
export const isSecureCookie = process.env.ADMIN_SECURE_COOKIE === "true";
export const adminBasePath = normalizeBasePath(process.env.ADMIN_BASE_PATH ?? "/admin");
export const uploadPublicBase = "/uploads";
export const uploadsDir = resolve(root, "public", "uploads");
export const projectPublicDir = resolve(root, "public");
export const backupsDir = resolve(root, ".admin-backups");
export const adminPublicDir = resolve(root, "admin-server", "public");

function normalizeBasePath(value) {
	const normalized = String(value || "").trim();

	if (!normalized || normalized === "/") {
		return "";
	}

	return `/${normalized.replace(/^\/+|\/+$/g, "")}`;
}

export const collections = [
	{
		id: "posts",
		label: "文章",
		storage: "markdown",
		directory: resolve(root, "src", "content", "posts"),
		extension: ".md",
		sortField: "published",
		supportsCreate: true,
		supportsDelete: true,
		fields: [
			{ name: "title", label: "标题", type: "text", required: true, defaultValue: "" },
			{ name: "published", label: "发布日期", type: "date", required: true, defaultValue: "" },
			{ name: "updated", label: "更新日期", type: "date", defaultValue: "" },
			{ name: "description", label: "简介", type: "textarea", defaultValue: "" },
			{ name: "image", label: "封面图", type: "image", defaultValue: "" },
			{ name: "tags", label: "标签", type: "tags", defaultValue: [] },
			{ name: "category", label: "分类", type: "text", defaultValue: "" },
			{ name: "draft", label: "草稿", type: "checkbox", defaultValue: false },
			{ name: "lang", label: "语言", type: "text", defaultValue: "" },
			{ name: "body", label: "正文", type: "markdown", defaultValue: "" },
		],
	},
	{
		id: "diary",
		label: "日记",
		storage: "markdown",
		directory: resolve(root, "src", "content", "diary"),
		extension: ".md",
		sortField: "date",
		supportsCreate: true,
		supportsDelete: true,
		fields: [
			{ name: "title", label: "标题", type: "text", required: true, defaultValue: "" },
			{ name: "date", label: "日期", type: "date", required: true, defaultValue: "" },
			{ name: "mood", label: "心情", type: "text", defaultValue: "" },
			{ name: "weather", label: "天气", type: "text", defaultValue: "" },
			{ name: "excerpt", label: "摘要", type: "textarea", defaultValue: "" },
			{ name: "image", label: "配图", type: "image", defaultValue: "" },
			{ name: "tags", label: "标签", type: "tags", defaultValue: [] },
			{ name: "body", label: "正文", type: "markdown", defaultValue: "" },
		],
	},
	{
		id: "novels",
		label: "小说",
		storage: "yaml",
		directory: resolve(root, "src", "content", "novels"),
		extension: ".yaml",
		sortField: "title",
		supportsCreate: true,
		supportsDelete: true,
		fields: [
			{ name: "title", label: "作品名", type: "text", required: true, defaultValue: "" },
			{ name: "creator", label: "作者", type: "text", defaultValue: "" },
			{ name: "status", label: "状态", type: "text", defaultValue: "" },
			{ name: "rating", label: "评分", type: "number", defaultValue: 0 },
			{ name: "year", label: "年份", type: "number", defaultValue: "" },
			{ name: "progress", label: "进度", type: "text", defaultValue: "" },
			{ name: "tags", label: "标签", type: "tags", defaultValue: [] },
			{ name: "description", label: "简介", type: "textarea", defaultValue: "" },
			{ name: "image", label: "封面图", type: "image", defaultValue: "" },
			{ name: "featured", label: "首页推荐", type: "checkbox", defaultValue: false },
		],
	},
	{
		id: "anime",
		label: "动漫",
		storage: "yaml",
		directory: resolve(root, "src", "content", "anime"),
		extension: ".yaml",
		sortField: "title",
		supportsCreate: true,
		supportsDelete: true,
		fields: [
			{ name: "title", label: "作品名", type: "text", required: true, defaultValue: "" },
			{ name: "creator", label: "制作方", type: "text", defaultValue: "" },
			{ name: "status", label: "状态", type: "text", defaultValue: "" },
			{ name: "rating", label: "评分", type: "number", defaultValue: 0 },
			{ name: "year", label: "年份", type: "number", defaultValue: "" },
			{ name: "progress", label: "进度", type: "text", defaultValue: "" },
			{ name: "tags", label: "标签", type: "tags", defaultValue: [] },
			{ name: "description", label: "简介", type: "textarea", defaultValue: "" },
			{ name: "image", label: "封面图", type: "image", defaultValue: "" },
			{ name: "featured", label: "首页推荐", type: "checkbox", defaultValue: false },
		],
	},
	{
		id: "album",
		label: "相册",
		storage: "yaml",
		directory: resolve(root, "src", "content", "album"),
		extension: ".yaml",
		sortField: "date",
		supportsCreate: true,
		supportsDelete: true,
		fields: [
			{ name: "title", label: "标题", type: "text", required: true, defaultValue: "" },
			{ name: "date", label: "日期", type: "date", defaultValue: "" },
			{ name: "location", label: "地点", type: "text", defaultValue: "" },
			{ name: "description", label: "说明", type: "textarea", defaultValue: "" },
			{ name: "image", label: "图片", type: "image", defaultValue: "" },
			{ name: "tags", label: "标签", type: "tags", defaultValue: [] },
			{ name: "featured", label: "精选展示", type: "checkbox", defaultValue: false },
		],
	},
	{
		id: "about",
		label: "关于页",
		storage: "raw-markdown",
		file: resolve(root, "src", "content", "spec", "about.md"),
		singletonSlug: "about",
		supportsCreate: false,
		supportsDelete: false,
		fields: [{ name: "body", label: "正文", type: "markdown", defaultValue: "" }],
	},
];

export function getCollectionConfig(collectionId) {
	const collection = collections.find(item => item.id === collectionId);

	if (!collection) {
		throw new Error(`Unknown collection: ${collectionId}`);
	}

	return collection;
}
