import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { projectRoot } from "./config.js";

const githubApiBase = "https://api.github.com";
const defaultWorkflow = "deploy-static.yml";
const defaultBranch = "main";
const defaultAuthorName = "Homepage Admin";
const defaultAuthorEmail = "homepage-admin@users.noreply.github.com";
const defaultSyncRoots = ["src/content", "public/uploads"];

function normalizeRepo(value) {
	return String(value || "").trim().replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "");
}

function normalizeBranch(value) {
	return String(value || defaultBranch).trim() || defaultBranch;
}

function normalizePath(value) {
	return String(value || "").replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}

function relativeProjectPath(pathname) {
	return normalizePath(relative(projectRoot, pathname).split(sep).join("/"));
}

function gitBlobSha(buffer) {
	return createHash("sha1").update(`blob ${buffer.length}\0`).update(buffer).digest("hex");
}

function isUnderRoot(pathname, rootPath) {
	return pathname === rootPath || pathname.startsWith(`${rootPath}/`);
}

function envFlag(name) {
	return ["1", "true", "yes", "on"].includes(String(process.env[name] || "").toLowerCase());
}

function buildSyncRoots() {
	const customRoots = String(process.env.ADMIN_GITHUB_SYNC_PATHS || "")
		.split(",")
		.map(normalizePath)
		.filter(Boolean);

	return customRoots.length ? customRoots : defaultSyncRoots;
}

export function getGitHubPublishConfig() {
	const repo = normalizeRepo(process.env.ADMIN_GITHUB_REPO);
	const token = String(process.env.ADMIN_GITHUB_TOKEN || "").trim();
	const mode = String(process.env.ADMIN_PUBLISH_MODE || "").trim().toLowerCase();
	const enabled = mode === "github" || Boolean(repo && token && mode !== "local" && mode !== "server");

	return {
		enabled,
		repo,
		token,
		branch: normalizeBranch(process.env.ADMIN_GITHUB_BRANCH),
		workflow: String(process.env.ADMIN_GITHUB_WORKFLOW || defaultWorkflow).trim() || defaultWorkflow,
		authorName: String(process.env.ADMIN_GITHUB_AUTHOR_NAME || defaultAuthorName).trim() || defaultAuthorName,
		authorEmail:
			String(process.env.ADMIN_GITHUB_AUTHOR_EMAIL || defaultAuthorEmail).trim() || defaultAuthorEmail,
		syncRoots: buildSyncRoots(),
		dryRun: envFlag("ADMIN_GITHUB_DRY_RUN"),
	};
}

function assertGitHubConfig(config) {
	if (!config.repo) {
		throw new Error("缺少 ADMIN_GITHUB_REPO，例如 ty368685189-maker/homepage-antigravity");
	}

	if (!config.token) {
		throw new Error("缺少 ADMIN_GITHUB_TOKEN，后台不能同步内容到 GitHub");
	}
}

async function githubRequest(config, pathname, options = {}) {
	assertGitHubConfig(config);

	const response = await fetch(`${githubApiBase}${pathname}`, {
		method: options.method || "GET",
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${config.token}`,
			"Content-Type": "application/json",
			"User-Agent": "homepage-admin-publisher",
			"X-GitHub-Api-Version": "2022-11-28",
			...(options.headers || {}),
		},
		body: options.body ? JSON.stringify(options.body) : undefined,
	});

	if (response.status === 204) {
		return null;
	}

	const text = await response.text();
	const payload = text ? JSON.parse(text) : null;

	if (!response.ok) {
		const message = payload?.message || response.statusText || "GitHub API 请求失败";
		throw new Error(`GitHub ${response.status}: ${message}`);
	}

	return payload;
}

async function listLocalFiles(rootPath, syncRoot, files = []) {
	const absoluteRoot = resolve(projectRoot, rootPath);
	const absolutePath = resolve(projectRoot, syncRoot);
	const info = await stat(absolutePath).catch(() => null);

	if (!info) {
		return files;
	}

	if (info.isFile()) {
		files.push(absolutePath);
		return files;
	}

	if (!info.isDirectory()) {
		return files;
	}

	const entries = await readdir(absolutePath, { withFileTypes: true });

	for (const entry of entries) {
		const child = resolve(absolutePath, entry.name);

		if (!child.startsWith(absoluteRoot)) {
			continue;
		}

		if (entry.isDirectory()) {
			await listLocalFiles(rootPath, relativeProjectPath(child), files);
			continue;
		}

		if (entry.isFile()) {
			files.push(child);
		}
	}

	return files;
}

async function collectLocalFiles(syncRoots) {
	const files = new Map();

	for (const syncRoot of syncRoots) {
		const absoluteFiles = await listLocalFiles(projectRoot, syncRoot);

		for (const absolutePath of absoluteFiles) {
			const content = await readFile(absolutePath);
			const path = relativeProjectPath(absolutePath);

			files.set(path, {
				path,
				content,
				sha: gitBlobSha(content),
			});
		}
	}

	return files;
}

function filterRemoteTree(tree, syncRoots) {
	const roots = syncRoots.map(normalizePath);
	const files = new Map();

	for (const item of tree || []) {
		const path = normalizePath(item.path);

		if (item.type !== "blob" || !roots.some(root => isUnderRoot(path, root))) {
			continue;
		}

		files.set(path, item);
	}

	return files;
}

async function getBranchHead(config) {
	const ref = await githubRequest(config, `/repos/${config.repo}/git/ref/heads/${config.branch}`);
	const commit = await githubRequest(config, `/repos/${config.repo}/git/commits/${ref.object.sha}`);

	return {
		commitSha: ref.object.sha,
		treeSha: commit.tree.sha,
	};
}

async function getRemoteFiles(config, treeSha, syncRoots) {
	const tree = await githubRequest(
		config,
		`/repos/${config.repo}/git/trees/${treeSha}?recursive=1`,
	);

	if (tree?.truncated) {
		throw new Error("GitHub 仓库文件树太大，返回被截断；请缩小 ADMIN_GITHUB_SYNC_PATHS");
	}

	return filterRemoteTree(tree?.tree || [], syncRoots);
}

async function createBlob(config, file) {
	const blob = await githubRequest(config, `/repos/${config.repo}/git/blobs`, {
		method: "POST",
		body: {
			content: file.content.toString("base64"),
			encoding: "base64",
		},
	});

	return blob.sha;
}

function summarizePaths(paths) {
	const shown = paths.slice(0, 8);
	const suffix = paths.length > shown.length ? ` 等 ${paths.length} 个文件` : "";
	return `${shown.join(", ")}${suffix}`;
}

export async function syncAdminContentToGitHub(config, appendLog) {
	assertGitHubConfig(config);
	appendLog(`同步内容到 GitHub：${config.repo}#${config.branch}`);
	appendLog(`同步范围：${config.syncRoots.join(", ")}`);

	const head = await getBranchHead(config);
	const [localFiles, remoteFiles] = await Promise.all([
		collectLocalFiles(config.syncRoots),
		getRemoteFiles(config, head.treeSha, config.syncRoots),
	]);

	const changedFiles = [];
	const deletedFiles = [];

	for (const [path, file] of localFiles) {
		if (remoteFiles.get(path)?.sha !== file.sha) {
			changedFiles.push(file);
		}
	}

	for (const path of remoteFiles.keys()) {
		if (!localFiles.has(path)) {
			deletedFiles.push(path);
		}
	}

	if (!changedFiles.length && !deletedFiles.length) {
		appendLog("GitHub 内容已是最新，没有需要提交的文件。");
		return {
			changed: false,
			commitSha: head.commitSha,
			changedCount: 0,
			deletedCount: 0,
		};
	}

	appendLog(`准备提交：新增/修改 ${changedFiles.length} 个，删除 ${deletedFiles.length} 个。`);

	if (changedFiles.length) {
		appendLog(`变更文件：${summarizePaths(changedFiles.map(file => file.path))}`);
	}

	if (deletedFiles.length) {
		appendLog(`删除文件：${summarizePaths(deletedFiles)}`);
	}

	if (config.dryRun) {
		appendLog("ADMIN_GITHUB_DRY_RUN=true，仅演练同步，不创建 GitHub commit。");
		return {
			changed: true,
			commitSha: head.commitSha,
			changedCount: changedFiles.length,
			deletedCount: deletedFiles.length,
			dryRun: true,
		};
	}

	const treeEntries = [];

	for (const file of changedFiles) {
		const sha = await createBlob(config, file);
		treeEntries.push({
			path: file.path,
			mode: "100644",
			type: "blob",
			sha,
		});
	}

	for (const path of deletedFiles) {
		treeEntries.push({
			path,
			mode: "100644",
			type: "blob",
			sha: null,
		});
	}

	const tree = await githubRequest(config, `/repos/${config.repo}/git/trees`, {
		method: "POST",
		body: {
			base_tree: head.treeSha,
			tree: treeEntries,
		},
	});
	const now = new Date().toISOString();
	const commit = await githubRequest(config, `/repos/${config.repo}/git/commits`, {
		method: "POST",
		body: {
			message: `chore(content): publish admin updates ${now}`,
			tree: tree.sha,
			parents: [head.commitSha],
			author: {
				name: config.authorName,
				email: config.authorEmail,
			},
			committer: {
				name: config.authorName,
				email: config.authorEmail,
			},
		},
	});

	await githubRequest(config, `/repos/${config.repo}/git/refs/heads/${config.branch}`, {
		method: "PATCH",
		body: {
			sha: commit.sha,
		},
	});

	appendLog(`已提交 GitHub commit：${commit.sha.slice(0, 7)}`);

	return {
		changed: true,
		commitSha: commit.sha,
		changedCount: changedFiles.length,
		deletedCount: deletedFiles.length,
	};
}

export async function triggerGitHubWorkflow(config, commitSha, appendLog) {
	assertGitHubConfig(config);

	if (config.dryRun) {
		appendLog("ADMIN_GITHUB_DRY_RUN=true，仅演练触发，不启动 GitHub Actions。");
		return;
	}

	await githubRequest(config, `/repos/${config.repo}/actions/workflows/${config.workflow}/dispatches`, {
		method: "POST",
		body: {
			ref: config.branch,
			inputs: {
				source: "admin",
				commit_sha: commitSha,
				requested_at: new Date().toISOString(),
			},
		},
	});

	appendLog(`已触发 GitHub Actions：${config.workflow}`);
}

export async function findWorkflowRun(config, commitSha, startedAt) {
	if (!commitSha || config.dryRun) {
		return null;
	}

	const params = new URLSearchParams({
		branch: config.branch,
		event: "workflow_dispatch",
		per_page: "10",
	});
	const payload = await githubRequest(
		config,
		`/repos/${config.repo}/actions/workflows/${config.workflow}/runs?${params.toString()}`,
	);
	const runs = payload?.workflow_runs || [];
	const startedTime = startedAt ? new Date(startedAt).getTime() - 30_000 : 0;

	return (
		runs.find(run => run.head_sha === commitSha && new Date(run.created_at).getTime() >= startedTime) ||
		null
	);
}

export async function getWorkflowRun(config, runId) {
	if (!runId || config.dryRun) {
		return null;
	}

	return githubRequest(config, `/repos/${config.repo}/actions/runs/${runId}`);
}

export function workflowUrl(config) {
	return `https://github.com/${config.repo}/actions/workflows/${config.workflow}`;
}
