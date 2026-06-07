const state = {
	session: null,
	expectedUsername: "admin",
	basePath: window.__ADMIN_CONFIG__?.basePath || "",
	collections: [],
	activeCollection: "",
	entries: [],
	currentSlug: "",
	currentEntry: null,
	notice: "",
	noticeType: "info",
	publish: null,
	loading: false,
};

const root = document.querySelector("#app");

function escapeHtml(value) {
	return String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function api(path, options = {}) {
	return fetch(`${state.basePath}${path}`, {
		credentials: "same-origin",
		headers: {
			"Content-Type": "application/json",
			...(options.headers || {}),
		},
		...options,
	}).then(async response => {
		const isJson = response.headers.get("content-type")?.includes("application/json");
		const payload = isJson ? await response.json() : null;

		if (!response.ok) {
			throw new Error(payload?.error || "请求失败");
		}

		return payload;
	});
}

function getCollectionMeta() {
	return state.collections.find(item => item.id === state.activeCollection);
}

function setNotice(message, type = "info") {
	state.notice = message;
	state.noticeType = type;
	render();
}

function previewSource(pathValue) {
	if (!pathValue) {
		return "";
	}

	if (/^https?:\/\//.test(pathValue)) {
		return pathValue;
	}

	if (pathValue.startsWith("/")) {
		return `${state.basePath}/preview-public${pathValue}`;
	}

	return pathValue;
}

async function boot() {
	try {
		const session = await api("/api/session", { headers: {} });
		state.expectedUsername = session.expectedUsername || "admin";
		state.basePath = session.basePath || state.basePath || "";
		state.session = session.authenticated ? session : null;

		if (state.session) {
			await loadCollections();
			await refreshPublishStatus();
		}
	} catch (error) {
		setNotice(error.message, "error");
	}

	render();
}

async function loadCollections() {
	const payload = await api("/api/collections");
	state.collections = payload.collections;
	state.activeCollection = state.activeCollection || payload.collections[0]?.id || "";

	if (state.activeCollection) {
		await loadEntries(state.activeCollection);
	}
}

async function loadEntries(collectionId) {
	state.activeCollection = collectionId;
	const payload = await api(`/api/entries?collection=${encodeURIComponent(collectionId)}`);
	state.entries = payload.entries;

	if (!state.currentSlug || !payload.entries.some(item => item.slug === state.currentSlug)) {
		state.currentSlug = payload.entries[0]?.slug || "";
	}

	if (state.currentSlug) {
		await loadEntry(collectionId, state.currentSlug);
	} else {
		state.currentEntry = null;
		render();
	}
}

async function loadEntry(collectionId, slug) {
	const payload = await api(
		`/api/entry?collection=${encodeURIComponent(collectionId)}&slug=${encodeURIComponent(slug)}`,
	);

	state.currentSlug = slug;
	state.currentEntry = payload.entry;
	render();
}

async function createEntry() {
	const payload = await api(
		`/api/entry?collection=${encodeURIComponent(state.activeCollection)}&slug=__new__`,
	);
	state.currentSlug = "__new__";
	state.currentEntry = payload.entry;
	render();
}

function fieldValue(field) {
	return state.currentEntry?.meta?.[field.name] ?? field.defaultValue ?? "";
}

function renderField(field) {
	const value = fieldValue(field);
	const escapedLabel = escapeHtml(field.label);

	if (field.type === "checkbox") {
		return `
			<div class="field">
				<label>
					<input type="checkbox" name="${field.name}" ${value ? "checked" : ""} />
					${escapedLabel}
				</label>
			</div>
		`;
	}

	if (field.type === "markdown") {
		return `
			<div class="field full">
				<label for="field-${field.name}">${escapedLabel}</label>
				<textarea id="field-${field.name}" name="${field.name}" class="mono" style="min-height: 360px;">${escapeHtml(value)}</textarea>
				<div class="helper">支持 Markdown。图片可以先上传，再把生成的地址贴进正文。</div>
			</div>
		`;
	}

	if (field.type === "textarea") {
		return `
			<div class="field full">
				<label for="field-${field.name}">${escapedLabel}</label>
				<textarea id="field-${field.name}" name="${field.name}">${escapeHtml(value)}</textarea>
			</div>
		`;
	}

	if (field.type === "tags") {
		return `
			<div class="field full">
				<label for="field-${field.name}">${escapedLabel}</label>
				<input id="field-${field.name}" name="${field.name}" value="${escapeHtml(
					Array.isArray(value) ? value.join(", ") : value,
				)}" />
				<div class="helper">用英文逗号或换行分隔多个标签。</div>
			</div>
		`;
	}

	if (field.type === "image") {
		const imagePath = String(value || "");
		return `
			<div class="field full">
				<label for="field-${field.name}">${escapedLabel}</label>
				<div class="image-input">
					<input id="field-${field.name}" name="${field.name}" value="${escapeHtml(imagePath)}" />
					<label class="upload-button">
						上传图片
						<input type="file" accept="image/*" data-upload-field="${field.name}" />
					</label>
				</div>
				<div class="helper mono">${escapeHtml(imagePath || "还没有图片地址")}</div>
				${
					imagePath
						? `<div class="image-preview"><img src="${escapeHtml(previewSource(imagePath))}" alt="${escapedLabel}" /></div>`
						: ""
				}
			</div>
		`;
	}

	const inputType = field.type === "date" ? "date" : field.type === "number" ? "number" : "text";
	const fullClass = field.type === "text" ? "" : "full";

	return `
		<div class="field ${fullClass}">
			<label for="field-${field.name}">${escapedLabel}</label>
			<input
				id="field-${field.name}"
				type="${inputType}"
				name="${field.name}"
				value="${escapeHtml(value)}"
				${field.type === "number" ? 'step="1"' : ""}
			/>
		</div>
	`;
}

function renderLogin() {
	const expectedUsername = state.expectedUsername || "admin";
	root.innerHTML = `
		<div class="login-shell">
			<form class="login-card" id="login-form">
				<h1>后台登录</h1>
				<p class="muted">这个后台只负责改内容和点发布。前台站点仍然是静态站，稳定性会高很多。</p>
				<div class="field">
					<label for="login-username">账号</label>
					<input id="login-username" name="username" value="${escapeHtml(expectedUsername)}" />
				</div>
				<div class="field">
					<label for="login-password">密码</label>
					<input id="login-password" name="password" type="password" />
				</div>
				${
					state.notice
						? `<div class="notice ${state.noticeType}">${escapeHtml(state.notice)}</div>`
						: ""
				}
				<button class="button primary" type="submit">登录后台</button>
			</form>
		</div>
	`;

	root.querySelector("#login-form").addEventListener("submit", handleLogin);
}

function renderApp() {
	const collection = getCollectionMeta();
	const publish = state.publish || { status: "idle", logs: [] };
	const currentSlug = state.currentSlug === "__new__" ? "" : state.currentSlug;
	const isNew = state.currentSlug === "__new__";

	root.innerHTML = `
		<div class="page-shell">
			<div class="shell">
				<div class="topbar">
					<div class="brand">
						<h1>宇少后台</h1>
						<p>登录后直接改 Markdown 和 YAML，点一次发布就能更新主页。</p>
					</div>
					<div class="topbar-actions">
						<div class="publish-pill">
							<span class="status-dot ${escapeHtml(publish.status)}"></span>
							<span>发布状态：${escapeHtml(statusLabel(publish.status))}</span>
						</div>
						<button class="button primary" id="publish-button" ${publish.status === "running" ? "disabled" : ""}>一键发布</button>
						<button class="button subtle" id="logout-button">退出登录</button>
					</div>
				</div>
				${
					state.notice
						? `<div class="notice ${state.noticeType}">${escapeHtml(state.notice)}</div>`
						: ""
				}
				<div class="layout">
					<section class="panel">
						<div class="panel-head">
							<div>
								<h2>内容类型</h2>
								<div class="panel-subtitle">站点数据结构保持不变</div>
							</div>
						</div>
						<div class="collection-list">
							${state.collections
								.map(
									item => `
										<button class="collection-item ${item.id === state.activeCollection ? "active" : ""}" data-collection="${item.id}">
											<div class="collection-title">${escapeHtml(item.label)}</div>
										</button>
									`,
								)
								.join("")}
						</div>
					</section>
					<section class="panel">
						<div class="panel-head">
							<div>
								<h2>${escapeHtml(collection?.label || "内容列表")}</h2>
								<div class="panel-subtitle">${escapeHtml(String(state.entries.length))} 条记录</div>
							</div>
							${
								collection?.supportsCreate
									? `<button class="button subtle" id="new-entry-button">新建</button>`
									: ""
							}
						</div>
						<div class="entry-list">
							${
								state.entries.length
									? state.entries
											.map(
												item => `
													<button class="entry-item ${item.slug === state.currentSlug ? "active" : ""}" data-slug="${escapeHtml(item.slug)}">
														<div class="entry-title">${escapeHtml(item.title)}</div>
														<div class="entry-meta">${escapeHtml(item.summary || item.updatedAt || "")}</div>
													</button>
												`,
											)
											.join("")
									: `<div class="empty">这个内容类型还没有记录。</div>`
							}
						</div>
					</section>
					<section class="panel">
						${
							state.currentEntry
								? `
									<form id="editor-form" class="editor">
										<div class="editor-toolbar">
											<div class="editor-title">
												<strong>${isNew ? "新建内容" : escapeHtml(state.currentEntry.meta.title || collection?.label || "")}</strong>
												<div class="helper mono">slug: ${escapeHtml(currentSlug || "未生成")}</div>
											</div>
											<div class="editor-actions">
												<button class="button primary" type="submit">保存</button>
												${
													collection?.supportsDelete && !isNew
														? `<button class="button danger" id="delete-entry-button" type="button">删除</button>`
														: ""
												}
											</div>
										</div>
										<div class="field-grid">
											${
												isNew && collection?.supportsCreate
													? `
														<div class="field">
															<label for="field-slug">slug</label>
															<input id="field-slug" name="slug" value="" class="mono" />
															<div class="helper">不填也可以，保存时会根据标题自动生成。</div>
														</div>
													`
													: ""
											}
											${collection.fields.map(renderField).join("")}
										</div>
									</form>
								`
								: `<div class="empty">先从左边选择一个内容类型，再打开一条记录。</div>`
						}
					</section>
				</div>
				<div class="log-panel">
					<div class="panel-head">
						<div>
							<h2>发布日志</h2>
							<div class="panel-subtitle">状态会自动刷新。成功后前台静态站点就会更新。</div>
						</div>
						<button class="button subtle" id="refresh-publish-button">刷新状态</button>
					</div>
					<pre>${escapeHtml((publish.logs || []).join("\n") || "还没有发布记录。")}</pre>
				</div>
			</div>
		</div>
	`;

	wireAppEvents();
}

function wireAppEvents() {
	root.querySelectorAll("[data-collection]").forEach(button => {
		button.addEventListener("click", async event => {
			await loadEntries(event.currentTarget.dataset.collection);
		});
	});

	root.querySelectorAll("[data-slug]").forEach(button => {
		button.addEventListener("click", async event => {
			await loadEntry(state.activeCollection, event.currentTarget.dataset.slug);
		});
	});

	root.querySelector("#logout-button")?.addEventListener("click", handleLogout);
	root.querySelector("#publish-button")?.addEventListener("click", handlePublish);
	root.querySelector("#refresh-publish-button")?.addEventListener("click", refreshPublishStatus);
	root.querySelector("#new-entry-button")?.addEventListener("click", createEntry);
	root.querySelector("#editor-form")?.addEventListener("submit", handleSave);
	root.querySelector("#editor-form")?.addEventListener("input", syncDraftFromForm);
	root.querySelector("#editor-form")?.addEventListener("change", syncDraftFromForm);
	root.querySelector("#delete-entry-button")?.addEventListener("click", handleDelete);
	root.querySelectorAll("[data-upload-field]").forEach(input => {
		input.addEventListener("change", handleUpload);
	});
}

function syncDraftFromForm(event) {
	if (!state.currentEntry?.meta) {
		return;
	}

	const target = event.target;
	const fieldName = target?.name;

	if (!fieldName) {
		return;
	}

	state.currentEntry.meta[fieldName] =
		target.type === "checkbox" ? target.checked : target.value;
}

function render() {
	if (!state.session) {
		renderLogin();
		return;
	}

	renderApp();
}

function statusLabel(status) {
	if (status === "running") {
		return "构建中";
	}

	if (status === "success") {
		return "最近一次成功";
	}

	if (status === "failed") {
		return "最近一次失败";
	}

	return "待发布";
}

async function handleLogin(event) {
	event.preventDefault();
	const formData = new FormData(event.currentTarget);

	try {
		await api("/api/login", {
			method: "POST",
			body: JSON.stringify({
				username: formData.get("username"),
				password: formData.get("password"),
			}),
		});

		state.notice = "";
		state.session = { authenticated: true };
		await loadCollections();
		await refreshPublishStatus();
		render();
	} catch (error) {
		setNotice(error.message, "error");
	}
}

async function handleLogout() {
	await api("/api/logout", { method: "POST" });
	state.session = null;
	state.collections = [];
	state.entries = [];
	state.currentEntry = null;
	state.currentSlug = "";
	setNotice("已经退出后台。");
}

async function handleSave(event) {
	event.preventDefault();
	const formData = new FormData(event.currentTarget);
	const collection = getCollectionMeta();
	const data = {};

	for (const field of collection.fields) {
		if (field.type === "checkbox") {
			data[field.name] = formData.get(field.name) === "on";
			continue;
		}

		data[field.name] = formData.get(field.name);
	}

	const requestedSlug = state.currentSlug === "__new__" ? formData.get("slug") : state.currentSlug;

	try {
		const payload = await api("/api/entry", {
			method: "POST",
			body: JSON.stringify({
				collection: state.activeCollection,
				slug: requestedSlug,
				data,
			}),
		});

		state.currentSlug = payload.entry.slug;
		state.currentEntry = payload.entry;
		await loadEntries(state.activeCollection);
		await loadEntry(state.activeCollection, payload.entry.slug);
		setNotice("内容已保存。");
	} catch (error) {
		setNotice(error.message, "error");
	}
}

async function handleDelete() {
	if (!window.confirm("确定要删除这条内容吗？删除前会自动备份原文件。")) {
		return;
	}

	try {
		await api("/api/entry", {
			method: "DELETE",
			body: JSON.stringify({
				collection: state.activeCollection,
				slug: state.currentSlug,
			}),
		});

		state.currentEntry = null;
		state.currentSlug = "";
		await loadEntries(state.activeCollection);
		setNotice("内容已删除。");
	} catch (error) {
		setNotice(error.message, "error");
	}
}

async function handleUpload(event) {
	const file = event.currentTarget.files?.[0];
	const fieldName = event.currentTarget.dataset.uploadField;

	if (!file || !fieldName) {
		return;
	}

	const body = new FormData();
	body.append("file", file);

	try {
		const response = await fetch(`${state.basePath}/api/upload`, {
			method: "POST",
			body,
			credentials: "same-origin",
		});
		const payload = await response.json();

		if (!response.ok) {
			throw new Error(payload?.error || "上传失败");
		}

		const input = root.querySelector(`[name="${fieldName}"]`);

		if (input) {
			input.value = payload.path;
		}

		if (state.currentEntry?.meta) {
			state.currentEntry.meta[fieldName] = payload.path;
		}

		setNotice(`图片已上传：${payload.path}`);
		render();
	} catch (error) {
		setNotice(error.message, "error");
	}
}

async function handlePublish() {
	try {
		await api("/api/publish", { method: "POST", body: JSON.stringify({}) });
		setNotice("已经开始构建发布，日志会自动刷新。");
		await refreshPublishStatus();
	} catch (error) {
		setNotice(error.message, "error");
	}
}

async function refreshPublishStatus() {
	if (!state.session) {
		return;
	}

	try {
		const payload = await api("/api/publish/status");
		state.publish = payload.publish;
		render();
	} catch (error) {
		setNotice(error.message, "error");
	}
}

window.setInterval(() => {
	if (state.session && state.publish?.status === "running") {
		refreshPublishStatus();
	}
}, 5000);

boot();
