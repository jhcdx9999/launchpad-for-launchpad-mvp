import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
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

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
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

async function routeApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<boolean> {
  if (!url.pathname.startsWith("/api/")) return false;

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true, stats: store.getStats() });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/demo/reset") {
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
