import express from "express";
import multer from "multer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	adminHost,
	adminPort,
	adminBasePath,
	adminPublicDir,
	adminUsername,
	projectPublicDir,
	uploadPublicBase,
	uploadsDir,
} from "./config.js";
import { getSessionUser, login, logout, requireAuth } from "./auth.js";
import {
	createEmptyEntry,
	deleteEntry,
	getCollectionsMeta,
	listEntries,
	readEntry,
	saveEntry,
	slugify,
} from "./content-store.js";
import { getPublishState, startPublish } from "./publisher.js";

function createUploadMiddleware() {
	return multer({
		storage: multer.memoryStorage(),
		limits: {
			fileSize: 10 * 1024 * 1024,
		},
	});
}

function sanitizeFileName(fileName) {
	const extension = extname(fileName || "").toLowerCase();
	const baseName = (fileName || "image")
		.replace(extension, "")
		.normalize("NFKD")
		.replace(/[^\w\s-]/g, "")
		.trim()
		.toLowerCase()
		.replace(/[\s_-]+/g, "-")
		.replace(/^-+|-+$/g, "");

	return `${baseName || "image"}-${Date.now()}${extension || ".png"}`;
}

function asyncHandler(fn) {
	return (req, res, next) => {
		Promise.resolve(fn(req, res, next)).catch(next);
	};
}

function withBasePath(pathname) {
	if (!adminBasePath) {
		return pathname;
	}

	if (pathname === "/") {
		return adminBasePath;
	}

	return `${adminBasePath}${pathname}`;
}

async function renderIndexHtml() {
	const templatePath = resolve(adminPublicDir, "index.html");
	const template = await readFile(templatePath, "utf8");
	return template.replaceAll("__ADMIN_BASE_PATH__", adminBasePath || "");
}

export function createApp() {
	const app = express();
	const upload = createUploadMiddleware();
	const router = express.Router();

	app.use(express.json({ limit: "2mb" }));
	if (adminBasePath) {
		app.get("/", (req, res) => {
			res.redirect(withBasePath("/"));
		});
	}

	router.use("/preview-public", express.static(projectPublicDir));
	router.use(uploadPublicBase, express.static(uploadsDir));
	router.use("/assets", express.static(resolve(adminPublicDir, "assets")));
	router.use(express.static(adminPublicDir, { index: false }));

	router.get("/api/session", (req, res) => {
		const session = getSessionUser(req);
		res.json({
			authenticated: Boolean(session),
			username: session?.username || "",
			expectedUsername: adminUsername,
			basePath: adminBasePath || "",
		});
	});

	router.post(
		"/api/login",
		asyncHandler(async (req, res) => {
			const { username = "", password = "" } = req.body || {};
			const session = login(req, res, username, password);
			res.json({ ok: true, session });
		}),
	);

	router.post("/api/logout", (req, res) => {
		logout(req, res);
		res.json({ ok: true });
	});

	router.get(
		"/api/collections",
		requireAuth,
		asyncHandler(async (req, res) => {
			res.json({ collections: getCollectionsMeta() });
		}),
	);

	router.get(
		"/api/entries",
		requireAuth,
		asyncHandler(async (req, res) => {
			const collection = String(req.query.collection || "");
			res.json({ entries: await listEntries(collection) });
		}),
	);

	router.get(
		"/api/entry",
		requireAuth,
		asyncHandler(async (req, res) => {
			const collection = String(req.query.collection || "");
			const slug = String(req.query.slug || "");

			if (slug === "__new__") {
				res.json({ entry: await createEmptyEntry(collection) });
				return;
			}

			res.json({ entry: await readEntry(collection, slug) });
		}),
	);

	router.post(
		"/api/entry",
		requireAuth,
		asyncHandler(async (req, res) => {
			const { collection = "", slug = "", data = {} } = req.body || {};
			const saved = await saveEntry(String(collection), String(slug || data.slug || ""), data);
			res.json({ ok: true, entry: saved });
		}),
	);

	router.delete(
		"/api/entry",
		requireAuth,
		asyncHandler(async (req, res) => {
			const { collection = "", slug = "" } = req.body || {};
			await deleteEntry(String(collection), String(slug));
			res.json({ ok: true });
		}),
	);

	router.post(
		"/api/upload",
		requireAuth,
		upload.single("file"),
		asyncHandler(async (req, res) => {
			if (!req.file) {
				throw new Error("没有收到文件");
			}

			await mkdir(uploadsDir, { recursive: true });
			const safeName = sanitizeFileName(req.file.originalname);
			const targetPath = resolve(uploadsDir, safeName);
			await writeFile(targetPath, req.file.buffer);

			res.json({
				ok: true,
				path: `${uploadPublicBase}/${safeName}`,
				suggestedMarkdown: `![](${uploadPublicBase}/${safeName})`,
			});
		}),
	);

	router.get("/api/publish/status", requireAuth, (req, res) => {
		res.json({ publish: getPublishState() });
	});

	router.post(
		"/api/publish",
		requireAuth,
		asyncHandler(async (req, res) => {
			startPublish().catch(() => {});
			res.json({ ok: true, publish: getPublishState() });
		}),
	);

	router.get("/api/slugify", requireAuth, (req, res) => {
		res.json({ slug: slugify(String(req.query.value || "")) });
	});

	router.get(["/", "/{*path}"], asyncHandler(async (req, res) => {
		res.type("html").send(await renderIndexHtml());
	}));

	app.use(adminBasePath || "/", router);

	app.use((error, req, res, next) => {
		if (res.headersSent) {
			next(error);
			return;
		}

		res.status(400).json({ error: error.message || "请求失败" });
	});

	return app;
}

export async function startAdminServer() {
	await mkdir(uploadsDir, { recursive: true });
	const app = createApp();
	const server = app.listen(adminPort, adminHost, () => {
		console.log(`Homepage admin running at http://${adminHost}:${adminPort}`);
	});
	return server;
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
	await startAdminServer();
}
