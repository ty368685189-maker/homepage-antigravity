import { spawn } from "node:child_process";
import { copyFile, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { projectRoot } from "./config.js";
import {
	findWorkflowRun,
	getGitHubPublishConfig,
	getWorkflowRun,
	syncAdminContentToGitHub,
	triggerGitHubWorkflow,
	workflowUrl,
} from "./github-publisher.js";

const buildTimeoutMs = Number(process.env.ADMIN_PUBLISH_TIMEOUT_MS || 1000 * 60 * 10);
const binDir = resolve(projectRoot, "node_modules", ".bin");
const serverBuildEnabled =
	process.platform === "win32" || process.env.ADMIN_ENABLE_SERVER_BUILD === "true";
const githubPublishConfig = getGitHubPublishConfig();
const publishWorkDir = resolve(projectRoot, ".admin-publish");
const caddyConfigPath = process.env.ADMIN_CADDY_CONFIG || "/etc/caddy/Caddyfile";

const state = {
	status: "idle",
	startedAt: "",
	endedAt: "",
	logs: [],
	error: "",
	publishMode: githubPublishConfig.enabled ? "github" : serverBuildEnabled ? "server" : "local",
	cloudPublishEnabled: githubPublishConfig.enabled,
	workflowRunId: "",
	workflowUrl: githubPublishConfig.enabled ? workflowUrl(githubPublishConfig) : "",
	commitSha: "",
	lastRunStatus: "",
};

const localDeployLogs = [
	"这台 VPS 不适合在后台直接构建，服务器现场发布已安全关闭。",
	"推荐开启 GitHub 云端发布：后台同步内容到 GitHub，由 GitHub Actions 构建后上传 VPS。",
	"临时上线仍可在本地电脑运行：corepack pnpm@9.14.4 deploy:static -- --apply",
];

function timestamp() {
	const now = new Date();
	const pad = value => String(value).padStart(2, "0");
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

function localBin(name) {
	return resolve(binDir, process.platform === "win32" ? `${name}.cmd` : name);
}

function quoteWindowsArgument(value) {
	return `"${String(value).replaceAll('"', '\\"')}"`;
}

function commandStep(label, command, args) {
	if (process.platform !== "win32") {
		return { label, command, args };
	}

	const commandLine = [quoteWindowsArgument(command), ...args.map(quoteWindowsArgument)].join(" ");

	return {
		label,
		command: process.env.ComSpec || "cmd.exe",
		args: ["/d", "/s", "/c", `"${commandLine}"`],
		windowsVerbatimArguments: true,
	};
}

function appendLog(chunk) {
	const text = chunk.toString().trim();

	if (!text) {
		return;
	}

	state.logs.push(text);

	if (state.logs.length > 200) {
		state.logs.splice(0, state.logs.length - 200);
	}
}

function appendLogOnce(chunk) {
	const text = chunk.toString().trim();

	if (!text || state.logs.includes(text)) {
		return;
	}

	appendLog(text);
}

function failPublish(message) {
	state.status = "failed";
	state.endedAt = new Date().toISOString();
	state.error = message;
	appendLog(`发布失败：${message}`);
}

function friendlySpawnError(error) {
	if (error?.code === "ENOENT") {
		return "找不到构建命令，服务器上的依赖可能没有安装完整，请在项目目录运行 pnpm install";
	}

	return error?.message || "发布任务启动失败";
}

async function pathExists(pathname) {
	return Boolean(await stat(pathname).catch(() => null));
}

function assertSafeDistPath(pathname) {
	const absolutePath = resolve(pathname);

	if (process.platform === "win32") {
		const localDistDir = resolve(projectRoot, "dist").toLowerCase();

		if (absolutePath.toLowerCase() !== localDistDir) {
			throw new Error(`静态目录不安全，拒绝替换：${absolutePath}`);
		}

		return absolutePath;
	}

	if (!/^[/\\](var[/\\]www|www)[/\\].+[/\\]dist$/.test(absolutePath)) {
		throw new Error(`静态目录不安全，拒绝替换：${absolutePath}`);
	}

	return absolutePath;
}

async function getLiveDistDir() {
	if (process.env.ADMIN_STATIC_ROOT) {
		return assertSafeDistPath(process.env.ADMIN_STATIC_ROOT);
	}

	if (process.platform === "win32") {
		return resolve(projectRoot, "dist");
	}

	const caddyfile = await readFile(caddyConfigPath, "utf8").catch(() => "");
	const rootLine = caddyfile
		.split(/\r?\n/)
		.map(line => line.trim())
		.find(line => line.startsWith("root * "));
	const caddyRoot = rootLine?.split(/\s+/)[2];

	if (caddyRoot) {
		return assertSafeDistPath(caddyRoot);
	}

	return assertSafeDistPath(resolve(projectRoot, "dist"));
}

async function copyDirectory(source, target) {
	await mkdir(target, { recursive: true });
	const entries = await readdir(source, { withFileTypes: true });

	for (const entry of entries) {
		const sourcePath = join(source, entry.name);
		const targetPath = join(target, entry.name);

		if (entry.isDirectory()) {
			await copyDirectory(sourcePath, targetPath);
			continue;
		}

		if (entry.isFile()) {
			await mkdir(dirname(targetPath), { recursive: true });
			await copyFile(sourcePath, targetPath);
		}
	}
}

async function replaceLiveDist(source, target) {
	const liveDistDir = assertSafeDistPath(target);
	const backupDir = `${liveDistDir}.backup-admin-${timestamp()}`;
	const parentDir = dirname(liveDistDir);
	const stagedDir = join(parentDir, `.dist-admin-new-${timestamp()}`);

	appendLog(`线上静态目录：${liveDistDir}`);
	await rm(stagedDir, { force: true, recursive: true });
	await copyDirectory(source, stagedDir);

	if (await pathExists(liveDistDir)) {
		await rm(backupDir, { force: true, recursive: true });
		await copyDirectory(liveDistDir, backupDir);
		appendLog(`已备份旧前台：${backupDir}`);
	}

	await rm(liveDistDir, { force: true, recursive: true });
	await copyDirectory(stagedDir, liveDistDir);
	await rm(stagedDir, { force: true, recursive: true });
	appendLog("已替换线上前台静态文件");
}

function buildSteps(tempDistDir) {
	return [
		commandStep("构建静态站点", localBin("astro"), ["build", "--outDir", tempDistDir]),
		commandStep("生成搜索索引", localBin("pagefind"), ["--site", tempDistDir]),
	];
}

function runStep(step) {
	appendLog(`开始：${step.label}`);

	return new Promise((resolveStep, rejectStep) => {
		let settled = false;
		const child = spawn(step.command, step.args, {
			cwd: projectRoot,
			env: process.env,
			windowsHide: true,
			windowsVerbatimArguments: Boolean(step.windowsVerbatimArguments),
		});
		const timeout = setTimeout(() => {
			if (settled) {
				return;
			}

			settled = true;
			child.kill("SIGTERM");
			rejectStep(new Error(`${step.label}超时，超过 ${Math.round(buildTimeoutMs / 60000)} 分钟没有完成`));
		}, buildTimeoutMs);

		child.stdout.on("data", appendLog);
		child.stderr.on("data", appendLog);

		child.on("error", error => {
			if (settled) {
				return;
			}

			settled = true;
			clearTimeout(timeout);
			rejectStep(new Error(`${step.label}启动失败：${friendlySpawnError(error)}`));
		});

		child.on("close", (code, signal) => {
			if (settled) {
				return;
			}

			settled = true;
			clearTimeout(timeout);

			if (code === 0) {
				appendLog(`完成：${step.label}`);
				resolveStep();
				return;
			}

			const message = signal
				? `${step.label}被系统中断：${signal}`
				: `${step.label}失败，退出码 ${code}`;
			rejectStep(new Error(message));
		});
	});
}

function publishStateSnapshot(extra = {}) {
	return {
		...state,
		serverBuildEnabled,
		cloudPublishEnabled: githubPublishConfig.enabled,
		publishMode: githubPublishConfig.enabled ? "github" : serverBuildEnabled ? "server" : "local",
		...extra,
		logs: [...(extra.logs || state.logs)],
	};
}

async function refreshGitHubState() {
	if (!githubPublishConfig.enabled || state.publishMode !== "github" || state.status !== "running") {
		return;
	}

	if (githubPublishConfig.dryRun) {
		state.status = "success";
		state.endedAt = new Date().toISOString();
		appendLogOnce("云端发布演练完成：未真正触发 GitHub Actions。");
		return;
	}

	try {
		if (!state.commitSha) {
			appendLogOnce("正在同步内容到 GitHub。");
			return;
		}

		if (!state.workflowRunId) {
			const run = await findWorkflowRun(githubPublishConfig, state.commitSha, state.startedAt);

			if (!run) {
				appendLogOnce("GitHub Actions 已触发，正在等待云端任务排队。");
				return;
			}

			state.workflowRunId = String(run.id);
			state.workflowUrl = run.html_url || state.workflowUrl;
			appendLogOnce(`云端任务已创建：${state.workflowUrl}`);
		}

		const run = await getWorkflowRun(githubPublishConfig, state.workflowRunId);

		if (!run) {
			return;
		}

		const signature = `${run.status}:${run.conclusion || ""}`;

		if (signature !== state.lastRunStatus) {
			state.lastRunStatus = signature;

			if (run.status !== "completed") {
				appendLog(`云端任务状态：${run.status}`);
			}
		}

		if (run.status !== "completed") {
			return;
		}

		state.endedAt = run.updated_at || new Date().toISOString();

		if (run.conclusion === "success") {
			state.status = "success";
			state.error = "";
			appendLogOnce("发布完成：GitHub 已构建并上传到 VPS。");
			return;
		}

		state.status = "failed";
		state.error = `GitHub Actions 结束状态：${run.conclusion || "unknown"}`;
		appendLogOnce(`发布失败：${state.error}`);
	} catch (error) {
		appendLogOnce(`读取 GitHub 发布状态失败：${error.message || "未知错误"}`);
	}
}

export async function getPublishState() {
	if (githubPublishConfig.enabled) {
		await refreshGitHubState();
		return publishStateSnapshot();
	}

	if (!serverBuildEnabled) {
		return {
			...publishStateSnapshot(),
			status: "local-only",
			error: "",
			serverBuildEnabled,
			cloudPublishEnabled: false,
			publishMode: "local",
			logs: state.logs.length ? [...state.logs] : [...localDeployLogs],
		};
	}

	return publishStateSnapshot();
}

export function startPublish() {
	if (state.status === "running") {
		throw new Error("发布任务正在进行中");
	}

	if (githubPublishConfig.enabled) {
		state.status = "running";
		state.startedAt = new Date().toISOString();
		state.endedAt = "";
		state.logs = [];
		state.error = "";
		state.publishMode = "github";
		state.cloudPublishEnabled = true;
		state.workflowRunId = "";
		state.workflowUrl = workflowUrl(githubPublishConfig);
		state.commitSha = "";
		state.lastRunStatus = "";
		appendLog("开始云端发布：VPS 不构建，只等待 GitHub Actions 上传成品。");

		return Promise.resolve()
			.then(async () => {
				const syncResult = await syncAdminContentToGitHub(githubPublishConfig, appendLog);
				state.commitSha = syncResult.commitSha;
				await triggerGitHubWorkflow(githubPublishConfig, syncResult.commitSha, appendLog);
				appendLog(`状态页：${state.workflowUrl}`);
				appendLog("后台会自动刷新云端任务状态。");
				return getPublishState();
			})
			.catch(error => {
				failPublish(error.message || "云端发布启动失败");
				throw error;
			});
	}

	if (!serverBuildEnabled) {
		state.status = "local-only";
		state.startedAt = new Date().toISOString();
		state.endedAt = state.startedAt;
		state.logs = [...localDeployLogs];
		state.error = "";
		return Promise.resolve(getPublishState());
	}

	state.status = "running";
	state.startedAt = new Date().toISOString();
	state.endedAt = "";
	state.logs = [];
	state.error = "";
	appendLog(`开始发布：项目目录 ${projectRoot}`);

	return Promise.resolve()
		.then(async () => {
			const liveDistDir = await getLiveDistDir();
			const tempDistDir = resolve(publishWorkDir, `dist-${timestamp()}`);
			await rm(tempDistDir, { force: true, recursive: true });
			await mkdir(tempDistDir, { recursive: true });
			appendLog(`临时构建目录：${tempDistDir}`);
			await buildSteps(tempDistDir)
				.reduce((chain, step) => chain.then(() => runStep(step)), Promise.resolve());
			await replaceLiveDist(tempDistDir, liveDistDir);
			await rm(tempDistDir, { force: true, recursive: true });
		})
		.then(() => {
			state.status = "success";
			state.endedAt = new Date().toISOString();
			appendLog("发布完成：已更新线上前台");
			return getPublishState();
		})
		.catch(error => {
			failPublish(error.message || "构建失败");
			appendLog("可以先在服务器或本地项目目录运行 pnpm build，看完整构建错误。");
			throw error;
		});
}
