import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import request from "supertest";
import { createApp } from "./server.js";
import {
	adminBasePath,
	adminPassword,
	adminUsername,
	projectPublicDir,
	projectRoot,
} from "./config.js";

const app = createApp();
const agent = request.agent(app);
const tempSlug = "admin-test-post";
let uploadedFilePath = "";

after(async () => {
	await rm(resolve(projectRoot, "src", "content", "posts", `${tempSlug}.md`), {
		force: true,
	}).catch(() => {});

	if (uploadedFilePath) {
		await rm(uploadedFilePath, { force: true }).catch(() => {});
	}
});

test("rejects unauthorized collection access", async () => {
	const response = await request(app).get(`${adminBasePath}/api/collections`);
	assert.equal(response.status, 401);
});

test("supports login, content edits, uploads, and publish status checks", async () => {
	const loginResponse = await agent.post(`${adminBasePath}/api/login`).send({
		username: adminUsername,
		password: adminPassword,
	});

	assert.equal(loginResponse.status, 200);

	const collectionsResponse = await agent.get(`${adminBasePath}/api/collections`);
	assert.equal(collectionsResponse.status, 200);
	assert.ok(collectionsResponse.body.collections.length >= 5);
	assert.equal(
		collectionsResponse.body.collections.find(collection => collection.id === "posts")?.sortField,
		"published",
	);

	const entryResponse = await agent.get(`${adminBasePath}/api/entry`).query({
		collection: "posts",
		slug: "hello-world",
	});
	assert.equal(entryResponse.status, 200);
	assert.equal(entryResponse.body.entry.meta.title, "我的第一篇博客");

	const saveResponse = await agent.post(`${adminBasePath}/api/entry`).send({
		collection: "posts",
		slug: tempSlug,
		data: {
			title: "后台自动化测试文章",
			published: "2026-06-07",
			updated: "",
			description: "测试保存是否正常。",
			image: "",
			tags: "测试, 后台",
			category: "测试",
			draft: true,
			lang: "zh-CN",
			body: "这是一条临时测试内容。",
		},
	});

	assert.equal(saveResponse.status, 200);
	assert.equal(saveResponse.body.entry.slug, tempSlug);

	const savedMarkdown = await readFile(
		resolve(projectRoot, "src", "content", "posts", `${tempSlug}.md`),
		"utf8",
	);
	assert.match(savedMarkdown, /published: 2026-06-07T00:00:00\.000Z/);
	assert.doesNotMatch(savedMarkdown, /published: '2026-06-07'/);
	assert.doesNotMatch(savedMarkdown, /updated: ''/);

	const listResponse = await agent.get(`${adminBasePath}/api/entries`).query({ collection: "posts" });
	assert.equal(listResponse.status, 200);
	assert.ok(listResponse.body.entries.some(item => item.slug === tempSlug));
	assert.ok(
		listResponse.body.entries.some(
			item => item.slug === "hello-world" && item.title === "我的第一篇博客",
		),
	);

	const slugifyResponse = await agent.get(`${adminBasePath}/api/slugify`).query({
		value: "完美世界",
	});
	assert.equal(slugifyResponse.status, 200);
	assert.equal(slugifyResponse.body.slug, "完美世界");

	const animeListResponse = await agent.get(`${adminBasePath}/api/entries`).query({
		collection: "anime",
	});
	assert.equal(animeListResponse.status, 200);
	assert.ok(animeListResponse.body.entries.some(item => item.slug === "完美世界"));

	const animeEntryResponse = await agent.get(`${adminBasePath}/api/entry`).query({
		collection: "anime",
		slug: "完美世界",
	});
	assert.equal(animeEntryResponse.status, 200);
	assert.equal(animeEntryResponse.body.entry.meta.title, "完美世界");

	const uploadResponse = await agent
		.post(`${adminBasePath}/api/upload`)
		.attach("file", Buffer.from("fakepng"), "admin-test.png");

	assert.equal(uploadResponse.status, 200);
	assert.match(uploadResponse.body.path, /^\/uploads\/.+\.png$/);
	uploadedFilePath = resolve(projectPublicDir, uploadResponse.body.path.slice(1));

	const publishStatusResponse = await agent.get(`${adminBasePath}/api/publish/status`);
	assert.equal(publishStatusResponse.status, 200);
	assert.equal(publishStatusResponse.body.publish.status, "idle");

	const deleteResponse = await agent.delete(`${adminBasePath}/api/entry`).send({
		collection: "posts",
		slug: tempSlug,
	});
	assert.equal(deleteResponse.status, 200);
});

test("serves the admin shell from the configured base path", async () => {
	const response = await request(app).get(`${adminBasePath}/`);
	assert.equal(response.status, 200);
	assert.match(response.text, /__ADMIN_CONFIG__|basePath/);
	assert.match(response.text, new RegExp(adminBasePath));
});
