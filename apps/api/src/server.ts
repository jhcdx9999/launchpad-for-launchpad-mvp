import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { getConfig, publicConfigScript } from "./config.ts";
import { JsonStore } from "./store.ts";

const config = getConfig();
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = resolve(__dirname, "../../web/public");
const store = new JsonStore(config);
const port = config.port;
const host = config.host;
const adminCookieName = "o1_admin_session";
const adminSessionDurationMs = 24 * 60 * 60 * 1000;

interface AdminSession {
  authenticated: boolean;
  expiresAt?: string;
}

function sendJson(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", ...headers });
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        req.destroy(new Error("Request body too large."));
      }
    });
    req.on("end", () => {
      if (!raw) return resolveBody({});
      try {
        resolveBody(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function parseCookies(req: IncomingMessage): Record<string, string> {
  return String(req.headers.cookie || "")
    .split(";")
    .map((cookie) => cookie.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((cookies, cookie) => {
      const separator = cookie.indexOf("=");
      if (separator === -1) return cookies;
      const name = decodeURIComponent(cookie.slice(0, separator));
      cookies[name] = decodeURIComponent(cookie.slice(separator + 1));
      return cookies;
    }, {});
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function signAdminPayload(payload: string): string {
  return createHmac("sha256", config.adminSessionSecret).update(payload).digest("base64url");
}

function createAdminSessionCookie(): { cookie: string; session: AdminSession } {
  const expiresAtMs = Date.now() + adminSessionDurationMs;
  const payload = Buffer.from(JSON.stringify({ sub: config.adminUsername, exp: expiresAtMs })).toString("base64url");
  const token = `${payload}.${signAdminPayload(payload)}`;
  return {
    cookie: serializeAdminCookie(token, Math.floor(adminSessionDurationMs / 1000)),
    session: {
      authenticated: true,
      expiresAt: new Date(expiresAtMs).toISOString()
    }
  };
}

function serializeAdminCookie(value: string, maxAgeSeconds: number): string {
  const parts = [
    `${adminCookieName}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`
  ];
  if (config.publicAppUrl.startsWith("https://")) parts.push("Secure");
  return parts.join("; ");
}

function readAdminSession(req: IncomingMessage): AdminSession {
  const token = parseCookies(req)[adminCookieName];
  if (!token) return { authenticated: false };

  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, signAdminPayload(payload))) {
    return { authenticated: false };
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: string; exp?: number };
    if (session.sub !== config.adminUsername || !session.exp || Date.now() > session.exp) {
      return { authenticated: false };
    }
    return {
      authenticated: true,
      expiresAt: new Date(session.exp).toISOString()
    };
  } catch {
    return { authenticated: false };
  }
}

function readStringField(body: unknown, key: string): string {
  return typeof body === "object" && body !== null && key in body ? String((body as Record<string, unknown>)[key] || "") : "";
}

async function routeApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  if (!url.pathname.startsWith("/api/")) return false;

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true, stats: store.getStats() });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/session") {
      sendJson(res, 200, { session: readAdminSession(req) });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/login") {
      const body = await readBody(req);
      const username = readStringField(body, "username");
      const password = readStringField(body, "password");
      const validUsername = safeEqual(username, config.adminUsername);
      const validPassword = safeEqual(password, config.adminPassword);

      if (!validUsername || !validPassword) {
        sendJson(res, 401, { error: "Invalid admin username or password." });
        return true;
      }

      const { cookie, session } = createAdminSessionCookie();
      sendJson(res, 200, { session }, { "set-cookie": cookie });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/logout") {
      sendJson(res, 200, { session: { authenticated: false } }, { "set-cookie": serializeAdminCookie("", 0) });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/clear") {
      if (!readAdminSession(req).authenticated) {
        sendJson(res, 403, { error: "Admin login required." });
        return true;
      }
      sendJson(res, 200, store.resetDemo());
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/launchpads") {
      sendJson(res, 200, { launchpads: store.listLaunchpads() });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/launchpads/popular") {
      const requestedLimit = Number(url.searchParams.get("limit") || 5);
      const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 20) : 5;
      sendJson(res, 200, { popularLaunchpads: store.listPopularLaunchpads(limit) });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/stats") {
      sendJson(res, 200, { stats: store.getMaterializedStats() });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/launchpads") {
      const launchpad = store.createLaunchpad((await readBody(req)) as any);
      sendJson(res, 201, { launchpad });
      return true;
    }

    const launchpadSlugMatch = url.pathname.match(/^\/api\/launchpads\/slug\/([^/]+)$/);
    if (req.method === "GET" && launchpadSlugMatch) {
      const launchpad = store.getLaunchpadBySlug(decodeURIComponent(launchpadSlugMatch[1]));
      if (!launchpad) {
        sendJson(res, 404, { error: "Launchpad not found." });
        return true;
      }
      sendJson(res, 200, { launchpad, tokens: store.listTokens(launchpad.id) });
      return true;
    }

    const launchpadIdMatch = url.pathname.match(/^\/api\/launchpads\/([^/]+)$/);
    if (req.method === "PATCH" && launchpadIdMatch) {
      const launchpad = store.updateLaunchpad(decodeURIComponent(launchpadIdMatch[1]), (await readBody(req)) as any);
      sendJson(res, 200, { launchpad });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/tokens") {
      sendJson(res, 200, { tokens: store.listTokens(url.searchParams.get("launchpadId") || undefined) });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/tokens/launch") {
      const token = store.launchToken((await readBody(req)) as any);
      sendJson(res, 201, { token });
      return true;
    }

    sendJson(res, 404, { error: "Unknown API route." });
    return true;
  } catch (error) {
    sendJson(res, 400, { error: error instanceof Error ? error.message : "Unknown error." });
    return true;
  }
}

function serveStatic(res: ServerResponse, pathname: string): void {
  if (pathname === "/config.js") {
    res.writeHead(200, { "content-type": "text/javascript; charset=utf-8" });
    res.end(publicConfigScript(config));
    return;
  }

  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = join(publicDir, relative);

  if (!filePath.startsWith(publicDir) || !existsSync(filePath) || !statSync(filePath).isFile()) {
    const indexPath = join(publicDir, "index.html");
    createReadStream(indexPath).pipe(res.writeHead(200, { "content-type": "text/html; charset=utf-8" }));
    return;
  }

  const types: Record<string, string> = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8"
  };

  createReadStream(filePath).pipe(res.writeHead(200, { "content-type": types[extname(filePath)] || "text/plain" }));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (await routeApi(req, res, url)) return;
  serveStatic(res, url.pathname);
});

server.listen(port, host, () => {
  console.log(`o1 Launchpad MVP running at ${config.publicAppUrl}`);
});
