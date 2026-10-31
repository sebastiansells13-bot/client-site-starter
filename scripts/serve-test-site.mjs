#!/usr/bin/env node
// Minimal static server for browser tests: serves the production build in
// docs/ the way GitHub Pages does ("/about/" → about/index.html, unknown
// paths → 404.html with a 404 status). No dependencies, no live reload.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve("docs");
const PORT = Number(process.env.PORT || 8181);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

async function findFile(urlPath) {
  const target = path.join(ROOT, decodeURIComponent(urlPath));
  if (!target.startsWith(ROOT)) return null;
  const info = await stat(target).catch(() => null);
  if (info?.isFile()) return target;
  const index = path.join(target, "index.html");
  if ((await stat(index).catch(() => null))?.isFile()) return index;
  return null;
}

createServer(async (req, res) => {
  const urlPath = new URL(req.url, "http://localhost").pathname;
  const file = await findFile(urlPath);
  const status = file ? 200 : 404;
  const body = await readFile(file || path.join(ROOT, "404.html")).catch(() => "Not found");
  res.writeHead(status, { "Content-Type": TYPES[path.extname(file || ".html")] || "application/octet-stream" });
  res.end(body);
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Serving ${ROOT} at http://127.0.0.1:${PORT}/`);
});
