import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { parse as parseCookie, serialize as serializeCookie } from "cookie";
import {
	adminPassword,
	adminUsername,
	isSecureCookie,
	sessionTtlMs,
} from "./config.js";

const sessionCookieName = "homepage_admin_session";
const sessions = new Map();

function digest(value) {
	return createHash("sha256").update(String(value)).digest();
}

function safeEqual(left, right) {
	return timingSafeEqual(digest(left), digest(right));
}

function readSessionToken(req) {
	const cookies = parseCookie(req.headers.cookie || "");
	return cookies[sessionCookieName] || "";
}

function getValidSession(req) {
	const token = readSessionToken(req);
	const session = sessions.get(token);

	if (!session) {
		return null;
	}

	if (Date.now() - session.createdAt > sessionTtlMs) {
		sessions.delete(token);
		return null;
	}

	return session;
}

export function login(req, res, username, password) {
	if (!safeEqual(username, adminUsername) || !safeEqual(password, adminPassword)) {
		throw new Error("账号或密码不正确");
	}

	const token = randomBytes(24).toString("hex");
	sessions.set(token, {
		username: adminUsername,
		createdAt: Date.now(),
	});

	res.setHeader(
		"Set-Cookie",
		serializeCookie(sessionCookieName, token, {
			httpOnly: true,
			secure: isSecureCookie,
			sameSite: "lax",
			path: "/",
			maxAge: Math.floor(sessionTtlMs / 1000),
		}),
	);

	return { username: adminUsername };
}

export function logout(req, res) {
	const token = readSessionToken(req);
	sessions.delete(token);
	res.setHeader(
		"Set-Cookie",
		serializeCookie(sessionCookieName, "", {
			httpOnly: true,
			secure: isSecureCookie,
			sameSite: "lax",
			path: "/",
			maxAge: 0,
		}),
	);
}

export function getSessionUser(req) {
	return getValidSession(req);
}

export function requireAuth(req, res, next) {
	const session = getValidSession(req);

	if (!session) {
		res.status(401).json({ error: "请先登录后台" });
		return;
	}

	req.session = session;
	next();
}
