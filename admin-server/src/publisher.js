import { spawn } from "node:child_process";
import { projectRoot } from "./config.js";

const state = {
	status: "idle",
	startedAt: "",
	endedAt: "",
	logs: [],
	error: "",
};

function corepackExecutable() {
	return process.platform === "win32" ? "corepack.cmd" : "corepack";
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

export function getPublishState() {
	return { ...state, logs: [...state.logs] };
}

export function startPublish() {
	if (state.status === "running") {
		throw new Error("发布任务正在进行中");
	}

	state.status = "running";
	state.startedAt = new Date().toISOString();
	state.endedAt = "";
	state.logs = [];
	state.error = "";

	return new Promise((resolve, reject) => {
		const child = spawn(corepackExecutable(), ["pnpm@9.14.4", "build"], {
			cwd: projectRoot,
			env: process.env,
		});

		child.stdout.on("data", appendLog);
		child.stderr.on("data", appendLog);

		child.on("error", error => {
			state.status = "failed";
			state.endedAt = new Date().toISOString();
			state.error = error.message;
			appendLog(error.message);
			reject(error);
		});

		child.on("close", code => {
			state.endedAt = new Date().toISOString();

			if (code === 0) {
				state.status = "success";
				resolve(getPublishState());
				return;
			}

			state.status = "failed";
			state.error = `构建失败，退出码 ${code}`;
			reject(new Error(state.error));
		});
	});
}
