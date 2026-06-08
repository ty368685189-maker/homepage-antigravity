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
	loadingCollection: "",
	loadingEntry: "",
	action: "",
};

const root = document.querySelector("#app");
let entriesRequestId = 0;
let entryRequestId = 0;

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

	const noticeSlot = root.querySelector("[data-notice-slot]");
	if (noticeSlot) {
		noticeSlot.innerHTML = renderNotice();
		return;
	}

	render();
}

function setNoticeState(message, type = "info") {
	state.notice = message;
	state.noticeType = type;
}

function errorMessage(error, fallback = "请求失败") {
	return error?.message || fallback;
}

function renderNotice() {
	if (!state.notice) {
		return "";
	}

	return `<div class="notice ${state.noticeType}">${escapeHtml(state.notice)}</div>`;
}

function renderImagePreview(field, imagePath) {
	if (!imagePath) {
		return "";
	}

	return `<div class="image-preview"><img src="${escapeHtml(previewSource(imagePath))}" alt="${escapeHtml(field.label)}" /></div>`;
}

function getEntrySummary(entry, collection = getCollectionMeta()) {
	const title = entry.meta.title || (collection?.id === "about" ? "关于我" : entry.slug);
	let summary = "";

	if (collection?.id === "posts") {
		summary = entry.meta.published || "";
	} else if (collection?.id === "diary" || collection?.id === "album") {
		summary = entry.meta.date || "";
	} else {
		summary = entry.meta.status || entry.meta.creator || "";
	}

	return {
		slug: entry.slug,
		title,
		summary,
		updatedAt: entry.updatedAt,
	};
}

function entrySortValue(entry, collection = getCollectionMeta()) {
	if (collection?.sortField === "title") {
		return entry.title || entry.slug || "";
	}

	if (collection?.sortField === "published" || collection?.sortField === "date") {
		return entry.summary || entry.slug || "";
	}

	return entry.slug || "";
}

function sortEntrySummaries() {
	const collection = getCollectionMeta();
	const direction = collection?.sortField === "title" ? 1 : -1;

	state.entries.sort((left, right) => {
		const leftValue = String(entrySortValue(left, collection));
		const rightValue = String(entrySortValue(right, collection));

		if (leftValue === rightValue) {
			return left.slug.localeCompare(right.slug, "zh-CN");
		}

		return leftValue.localeCompare(rightValue, "zh-CN") * direction;
	});
}

function upsertEntrySummary(entry) {
	const summary = getEntrySummary(entry);
	const index = state.entries.findIndex(item => item.slug === summary.slug);

	if (index >= 0) {
		state.entries[index] = summary;
	} else {
		state.entries.unshift(summary);
	}

	sortEntrySummaries();
}

function renderEntryList() {
	if (state.loadingCollection) {
		return `<div class="loading-state">正在读取内容列表...</div>`;
	}

	if (!state.entries.length) {
		return `<div class="empty">这个内容类型还没有记录。</div>`;
	}

	return state.entries
		.map(
			item => `
				<button
					class="entry-item ${item.slug === state.currentSlug ? "active" : ""} ${item.slug === state.loadingEntry ? "loading" : ""}"
					data-slug="${escapeHtml(item.slug)}"
					${state.loadingCollection || state.loadingEntry || state.action ? "disabled" : ""}
				>
					<div class="entry-title">${escapeHtml(item.title)}</div>
					<div class="entry-meta">${escapeHtml(item.summary || item.updatedAt || "")}</div>
				</button>
			`,
		)
		.join("");
}

function wireEntryEvents() {
	root.querySelectorAll("[data-slug]").forEach(button => {
		button.addEventListener("click", async event => {
			await loadEntry(state.activeCollection, event.currentTarget.dataset.slug || "");
		});
	});
}

function updateEntryListUi() {
	const entryList = root.querySelector("[data-entry-list]");

	updateEntryListMeta();

	if (entryList) {
		entryList.innerHTML = renderEntryList();
		wireEntryEvents();
	}
}

function updateEditorTitle() {
	const titleNode = root.querySelector("[data-editor-title]");
	const slugNode = root.querySelector("[data-editor-slug]");
	const collection = getCollectionMeta();

	if (titleNode) {
		titleNode.textContent = state.currentEntry?.meta?.title || collection?.label || "";
	}

	if (slugNode) {
		slugNode.textContent = `slug: ${state.currentSlug || "未生成"}`;
	}
}

function updateEntryListMeta() {
	const subtitle = root.querySelector("[data-entry-count]");

	if (subtitle) {
		subtitle.textContent = `${state.entries.length} 条记录`;
	}
}

function updatePublishUi() {
	const publish = state.publish || null;
	const dot = root.querySelector("[data-publish-dot]");
	const label = root.querySelector("[data-publish-label]");
	const logs = root.querySelector("[data-publish-logs]");
	const button = root.querySelector("#publish-button");

	if (dot) {
		dot.className = `status-dot ${publish?.status || "idle"}`;
	}

	if (label) {
		label.textContent = `发布状态：${statusLabel(publish)}`;
	}

	if (logs) {
		logs.textContent = publishLogsText(publish);
	}

	if (button) {
		button.disabled = isPublishStatePending(publish) || publish?.status === "running" || state.action === "publishing";
		button.textContent = publishButtonLabel(publish);
	}
}

function isServerPublishDisabled(publish = state.publish) {
	return !isCloudPublishEnabled(publish) && (publish?.serverBuildEnabled === false || publish?.status === "local-only");
}

function isCloudPublishEnabled(publish = state.publish) {
	return publish?.cloudPublishEnabled === true || publish?.publishMode === "github";
}

function isPublishStatePending(publish = state.publish) {
	return !publish;
}

function publishButtonLabel(publish = state.publish) {
	if (isPublishStatePending(publish)) {
		return "读取发布状态";
	}

	if (isServerPublishDisabled(publish)) {
		return "查看部署提示";
	}

	if (publish?.status === "running" || state.action === "publishing") {
		return "发布中";
	}

	return isCloudPublishEnabled(publish) ? "云端发布" : "开始服务器发布";
}

function publishSummaryText(publish = state.publish) {
	if (isPublishStatePending(publish)) {
		return "正在读取发布配置，内容编辑功能可正常使用。";
	}

	if (isServerPublishDisabled(publish)) {
		return "内容在这里保存，前台上线走本地安全静态部署。";
	}

	if (isCloudPublishEnabled(publish)) {
		return "内容在这里保存，发布交给 GitHub 云端打包，VPS 只接收成品。";
	}

	return "登录后直接改 Markdown 和 YAML；上线方式按当前服务器配置执行。";
}

function publishLogSubtitle(publish = state.publish) {
	if (isPublishStatePending(publish)) {
		return "正在读取当前服务器发布配置。";
	}

	if (isServerPublishDisabled(publish)) {
		return "当前 VPS 不跑现场构建，避免服务器卡死；保存内容后从本地电脑部署前台。";
	}

	if (isCloudPublishEnabled(publish)) {
		return "云端状态会自动刷新。成功后前台静态站点就会更新。";
	}

	return "状态会自动刷新。成功后前台静态站点就会更新。";
}

function publishLogsText(publish) {
	const logs = [...(publish?.logs || [])];

	if (publish?.error && !logs.some(item => item.includes(publish.error))) {
		logs.push(`错误：${publish.error}`);
	}

	return logs.join("\n") || "还没有发布记录。";
}

function updateImageFieldUi(fieldName, imagePath) {
	const field = getCollectionMeta()?.fields.find(item => item.name === fieldName && item.type === "image");
	const helper = root.querySelector(`[data-image-helper="${fieldName}"]`);
	const preview = root.querySelector(`[data-image-preview="${fieldName}"]`);

	if (helper) {
		helper.textContent = imagePath || "还没有图片地址";
	}

	if (preview && field) {
		preview.innerHTML = renderImagePreview(field, imagePath);
	}
}

function publishStateSignature(publish) {
	if (!publish) {
		return "";
	}

	return JSON.stringify({
		status: publish.status,
		serverBuildEnabled: publish.serverBuildEnabled,
		cloudPublishEnabled: publish.cloudPublishEnabled,
		publishMode: publish.publishMode,
		workflowRunId: publish.workflowRunId,
		workflowUrl: publish.workflowUrl,
		commitSha: publish.commitSha,
		startedAt: publish.startedAt,
		endedAt: publish.endedAt,
		error: publish.error,
		logs: publish.logs,
	});
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
	if (!collectionId || state.loadingCollection) {
		return;
	}

	const requestId = ++entriesRequestId;
	entryRequestId++;
	state.activeCollection = collectionId;
	state.entries = [];
	state.currentSlug = "";
	state.currentEntry = null;
	state.loadingCollection = collectionId;
	state.loadingEntry = "";
	setNoticeState("");
	render();

	try {
		const payload = await api(`/api/entries?collection=${encodeURIComponent(collectionId)}`);

		if (requestId !== entriesRequestId) {
			return;
		}

		state.entries = payload.entries;
		state.currentSlug = payload.entries[0]?.slug || "";
		state.loadingCollection = "";

		if (state.currentSlug) {
			await loadEntry(collectionId, state.currentSlug);
			return;
		}

		render();
	} catch (error) {
		if (requestId !== entriesRequestId) {
			return;
		}

		const collection = state.collections.find(item => item.id === collectionId);
		state.entries = [];
		state.currentSlug = "";
		state.currentEntry = null;
		state.loadingCollection = "";
		setNoticeState(`打开${collection?.label || "内容"}失败：${errorMessage(error)}`, "error");
		render();
	}
}

async function loadEntry(collectionId, slug) {
	if (!collectionId || !slug || state.loadingEntry) {
		return;
	}

	const requestId = ++entryRequestId;
	state.currentSlug = slug;
	state.currentEntry = null;
	state.loadingEntry = slug;
	setNoticeState("");
	render();

	try {
		const payload = await api(
			`/api/entry?collection=${encodeURIComponent(collectionId)}&slug=${encodeURIComponent(slug)}`,
		);

		if (requestId !== entryRequestId) {
			return;
		}

		state.currentSlug = payload.entry.slug || slug;
		state.currentEntry = payload.entry;
	} catch (error) {
		if (requestId !== entryRequestId) {
			return;
		}

		state.currentEntry = null;
		setNoticeState(`打开内容失败：${errorMessage(error)}`, "error");
	} finally {
		if (requestId === entryRequestId) {
			state.loadingEntry = "";
			render();
		}
	}
}

async function createEntry() {
	if (state.action || state.loadingCollection || state.loadingEntry) {
		return;
	}

	state.action = "creating";
	setNoticeState("");
	render();

	try {
		const payload = await api(
			`/api/entry?collection=${encodeURIComponent(state.activeCollection)}&slug=__new__`,
		);
		state.currentSlug = "__new__";
		state.currentEntry = payload.entry;
	} catch (error) {
		setNoticeState(`新建失败：${errorMessage(error)}`, "error");
	} finally {
		state.action = "";
		render();
	}
}

function fieldValue(field) {
	const value = state.currentEntry?.meta?.[field.name] ?? field.defaultValue ?? "";

	if (field.type === "date" && value) {
		return String(value).slice(0, 10);
	}

	return value;
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
				<div class="helper mono" data-image-helper="${field.name}">${escapeHtml(imagePath || "还没有图片地址")}</div>
				<div data-image-preview="${field.name}">${renderImagePreview(field, imagePath)}</div>
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
				<p class="muted">这个后台负责保存内容；前台上线走安全静态部署，稳定性会高很多。</p>
				<div class="field">
					<label for="login-username">账号</label>
					<input id="login-username" name="username" value="${escapeHtml(expectedUsername)}" />
				</div>
				<div class="field">
					<label for="login-password">密码</label>
					<input id="login-password" name="password" type="password" />
				</div>
				<div data-notice-slot>${renderNotice()}</div>
				<button class="button primary" type="submit">登录后台</button>
			</form>
		</div>
	`;

	root.querySelector("#login-form").addEventListener("submit", handleLogin);
}

function renderApp() {
	const collection = getCollectionMeta();
	const publish = state.publish;
	const publishStatus = publish?.status || "idle";
	const currentSlug = state.currentSlug === "__new__" ? "" : state.currentSlug;
	const isNew = state.currentSlug === "__new__";
	const isBusy = Boolean(state.loadingCollection || state.loadingEntry || state.action);

	root.innerHTML = `
		<div class="page-shell">
			<div class="shell">
				<div class="topbar">
					<div class="brand">
						<h1>宇少后台</h1>
						<p>${escapeHtml(publishSummaryText(publish))}</p>
					</div>
					<div class="topbar-actions">
						<div class="publish-pill">
							<span class="status-dot ${escapeHtml(publishStatus)}" data-publish-dot></span>
							<span data-publish-label>发布状态：${escapeHtml(statusLabel(publish))}</span>
						</div>
						<button class="button primary" id="publish-button" ${isPublishStatePending(publish) || publishStatus === "running" || state.action === "publishing" ? "disabled" : ""}>${escapeHtml(publishButtonLabel(publish))}</button>
						<button class="button subtle" id="logout-button">退出登录</button>
					</div>
				</div>
				<div data-notice-slot>${renderNotice()}</div>
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
										<button
											class="collection-item ${item.id === state.activeCollection ? "active" : ""} ${item.id === state.loadingCollection ? "loading" : ""}"
											data-collection="${item.id}"
											${isBusy ? "disabled" : ""}
										>
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
								<div class="panel-subtitle" data-entry-count>${escapeHtml(String(state.entries.length))} 条记录</div>
							</div>
							${
								collection?.supportsCreate
									? `<button class="button subtle" id="new-entry-button" ${isBusy ? "disabled" : ""}>${state.action === "creating" ? "新建中" : "新建"}</button>`
									: ""
							}
						</div>
						<div class="entry-list" data-entry-list>
							${renderEntryList()}
						</div>
					</section>
					<section class="panel">
						${
							state.loadingEntry
								? `<div class="loading-state">正在打开内容...</div>`
								: state.action === "creating"
									? `<div class="loading-state">正在准备新内容...</div>`
									: state.currentEntry
								? `
									<form id="editor-form" class="editor">
										<div class="editor-toolbar">
											<div class="editor-title">
												<strong data-editor-title>${isNew ? "新建内容" : escapeHtml(state.currentEntry.meta.title || collection?.label || "")}</strong>
												<div class="helper mono" data-editor-slug>slug: ${escapeHtml(currentSlug || "未生成")}</div>
											</div>
											<div class="editor-actions">
												<button class="button primary" type="submit" ${state.action === "saving" ? "disabled" : ""}>${state.action === "saving" ? "保存中" : "保存"}</button>
												${
													collection?.supportsDelete && !isNew
														? `<button class="button danger" id="delete-entry-button" type="button" ${state.action === "deleting" ? "disabled" : ""}>${state.action === "deleting" ? "删除中" : "删除"}</button>`
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
							<div class="panel-subtitle">${escapeHtml(publishLogSubtitle(publish))}</div>
						</div>
						<button class="button subtle" id="refresh-publish-button">刷新状态</button>
					</div>
					<pre data-publish-logs>${escapeHtml(publishLogsText(publish))}</pre>
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

	wireEntryEvents();

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

function statusLabel(publishOrStatus) {
	const status = typeof publishOrStatus === "string" ? publishOrStatus : publishOrStatus?.status;

	if (!status) {
		return "读取中";
	}

	if (status === "running") {
		return isCloudPublishEnabled(publishOrStatus) ? "云端发布中" : "构建中";
	}

	if (status === "local-only" || publishOrStatus?.serverBuildEnabled === false) {
		if (isCloudPublishEnabled(publishOrStatus)) {
			return "云端发布";
		}

		return "本地部署模式";
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
		setNotice(errorMessage(error, "登录失败"), "error");
	}
}

async function handleLogout() {
	try {
		await api("/api/logout", { method: "POST" });
		state.session = null;
		state.collections = [];
		state.entries = [];
		state.currentEntry = null;
		state.currentSlug = "";
		state.loadingCollection = "";
		state.loadingEntry = "";
		state.action = "";
		setNotice("已经退出后台。");
	} catch (error) {
		setNotice(errorMessage(error, "退出失败"), "error");
	}
}

async function handleSave(event) {
	event.preventDefault();
	if (state.action || state.loadingCollection || state.loadingEntry) {
		return;
	}

	const formData = new FormData(event.currentTarget);
	const collection = getCollectionMeta();
	const data = {};
	const isNew = state.currentSlug === "__new__";

	for (const field of collection.fields) {
		if (field.type === "checkbox") {
			data[field.name] = formData.get(field.name) === "on";
			continue;
		}

		data[field.name] = formData.get(field.name);
	}

	const requestedSlug = isNew ? formData.get("slug") : state.currentSlug;
	state.action = "saving";
	setNoticeState("");
	render();

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
		upsertEntrySummary(payload.entry);
		state.action = "";

		if (isNew) {
			render();
		} else {
			updateEntryListUi();
			updateEditorTitle();
			render();
		}

		setNotice("内容已保存。");
	} catch (error) {
		state.action = "";
		render();
		setNotice(errorMessage(error, "保存失败"), "error");
	}
}

async function handleDelete() {
	if (state.action || state.loadingCollection || state.loadingEntry) {
		return;
	}

	if (!window.confirm("确定要删除这条内容吗？删除前会自动备份原文件。")) {
		return;
	}

	state.action = "deleting";
	setNoticeState("");
	render();

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
		state.action = "";
		await loadEntries(state.activeCollection);
		setNotice("内容已删除。");
	} catch (error) {
		state.action = "";
		render();
		setNotice(errorMessage(error, "删除失败"), "error");
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

		updateImageFieldUi(fieldName, payload.path);
		setNotice(`图片已上传：${payload.path}`);
	} catch (error) {
		setNotice(error.message, "error");
	}
}

async function handlePublish() {
	if (isServerPublishDisabled(state.publish)) {
		setNotice("当前还没有配置 GitHub 云端发布。临时上线请在本地电脑执行 deploy:static。", "info");
		return;
	}

	if (state.action === "publishing" || state.publish?.status === "running") {
		return;
	}

	state.action = "publishing";
	updatePublishUi();
	setNoticeState("");

	try {
		const payload = await api("/api/publish", { method: "POST", body: JSON.stringify({}) });
		state.publish = payload.publish;
		state.action = "";
		updatePublishUi();
		setNotice(isCloudPublishEnabled(state.publish) ? "已经交给 GitHub 云端发布，日志会自动刷新。" : "已经开始构建发布，日志会自动刷新。");
	} catch (error) {
		state.action = "";
		await refreshPublishStatus();
		updatePublishUi();
		setNotice(errorMessage(error, "发布失败"), "error");
	}
}

async function refreshPublishStatus() {
	if (!state.session) {
		return;
	}

	try {
		const previousSignature = publishStateSignature(state.publish);
		const payload = await api("/api/publish/status");
		state.publish = payload.publish;
		if (publishStateSignature(state.publish) !== previousSignature) {
			updatePublishUi();
		}
	} catch (error) {
		setNotice(errorMessage(error, "刷新发布状态失败"), "error");
	}
}

window.setInterval(() => {
	if (state.session && state.publish?.status === "running") {
		refreshPublishStatus();
	}
}, 5000);

boot();
