#!/usr/bin/env node
// Publish guard: checks the built site in docs/ before it can deploy.
// Runs after `npm run build` (locally) or `npm run build:ci` (GitHub Actions).
//
// Checks every page for the basics search engines and screen readers need,
// every local link/asset for a matching file, asset size budgets, and — in
// client repos — that template placeholders were replaced before launch.
//
// Budgets can be raised per site with env vars if a client genuinely needs it:
//   CSS_BUDGET_KB (gzip, default 30), FILE_BUDGET_MB (any single file, default 5)
//
// In CI, EXPECT_FINGERPRINTED_MEDIA=true also requires that optimize-media.mjs
// moved every referenced image/video to a content-hashed /assets/img/ URL.
// ELEVENTY_PATH_PREFIX must match the build's prefix (see eleventy.config.cjs).
import { readdir, readFile, stat } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";

const OUTPUT_DIR = "docs";
const CSS_BUDGET_KB = Number(process.env.CSS_BUDGET_KB || 30);
const FILE_BUDGET_MB = Number(process.env.FILE_BUDGET_MB || 5);
const EXPECT_FINGERPRINTED_MEDIA = process.env.EXPECT_FINGERPRINTED_MEDIA === "true";
const PATH_PREFIX = normalizePrefix(process.env.ELEVENTY_PATH_PREFIX);

function normalizePrefix(value = "/") {
  const trimmed = value.replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}/` : "/";
}

const failures = [];
const fail = (message) => failures.push(message);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

async function exists(filePath) {
  return Boolean(await stat(filePath).catch(() => null));
}

// Resolve a root-relative URL ("/about/", "/assets/css/x.css?v=1#top") to the
// file GitHub Pages would serve for it.
async function resolveLocal(url) {
  let pathname = decodeURI(url.split(/[?#]/)[0]);
  if (!pathname.startsWith(PATH_PREFIX)) return false;
  pathname = `/${pathname.slice(PATH_PREFIX.length)}`;
  const target = path.join(OUTPUT_DIR, pathname);
  if (pathname.endsWith("/")) return exists(path.join(target, "index.html"));
  return (await exists(target)) || exists(path.join(target, "index.html"));
}

function checkPageBasics(file, html) {
  const page = path.relative(OUTPUT_DIR, file);
  if (!/<html[^>]*\blang="[^"]+"/i.test(html)) fail(`${page}: <html> is missing a lang attribute`);
  if (!/<meta[^>]+name="viewport"/i.test(html)) fail(`${page}: missing viewport meta tag`);

  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1].trim();
  if (!title) fail(`${page}: missing or empty <title>`);

  const description = html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1].trim();
  if (!description) fail(`${page}: missing or empty meta description`);

  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1Count !== 1) fail(`${page}: expected exactly one <h1>, found ${h1Count}`);
}

async function checkLocalReferences(file, html) {
  const page = path.relative(OUTPUT_DIR, file);
  // Root-relative href/src values only; protocol-relative (//cdn...) are external.
  const refs = [...html.matchAll(/\s(?:href|src)="(\/(?!\/)[^"]*)"/gi)].map((m) => m[1]);
  for (const ref of new Set(refs)) {
    if (!(await resolveLocal(ref))) fail(`${page}: broken local link or asset ${ref}`);
    if (EXPECT_FINGERPRINTED_MEDIA && ref.startsWith(`${PATH_PREFIX}img/`)) {
      fail(`${page}: ${ref} wasn't fingerprinted by optimize-media.mjs`);
    }
  }
}

// In a client repo (anything not named client-site-starter), the starter's
// placeholder values must be replaced before the site goes live.
async function checkPlaceholders() {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  if (pkg.name === "client-site-starter") return;

  const sitemap = await readFile(path.join(OUTPUT_DIR, "sitemap.xml"), "utf8").catch(() => "");
  if (sitemap.includes("https://example.com")) {
    fail("sitemap.xml still uses https://example.com — set the hostname in eleventy.config.cjs");
  }

  const business = JSON.parse(await readFile("src/_data/business.json", "utf8"));
  if (business.name === "Client Business Name") {
    fail("src/_data/business.json still has the starter's placeholder business name");
  }

  const metadata = JSON.parse(await readFile("src/_data/metadata.json", "utf8"));
  if (metadata.title === "Client Site Starter") {
    fail("src/_data/metadata.json still has the starter's placeholder title");
  }
}

async function main() {
  if (!(await exists(OUTPUT_DIR))) {
    console.error(`[check-publish] ${OUTPUT_DIR}/ not found — run \`npm run build\` first.`);
    process.exit(1);
  }

  const files = await walk(OUTPUT_DIR);
  const htmlFiles = files.filter((f) => f.endsWith(".html"));

  for (const file of htmlFiles) {
    const html = await readFile(file, "utf8");
    checkPageBasics(file, html);
    await checkLocalReferences(file, html);
  }

  for (const file of files) {
    const { size } = await stat(file);
    if (size > FILE_BUDGET_MB * 1024 * 1024) {
      fail(`${path.relative(OUTPUT_DIR, file)} is ${(size / 1024 / 1024).toFixed(1)} MB (budget ${FILE_BUDGET_MB} MB)`);
    }
    if (file.endsWith(".css")) {
      const gzipKb = gzipSync(await readFile(file)).length / 1024;
      if (gzipKb > CSS_BUDGET_KB) {
        fail(`${path.relative(OUTPUT_DIR, file)} is ${gzipKb.toFixed(1)} KB gzipped (budget ${CSS_BUDGET_KB} KB)`);
      }
    }
  }

  if (EXPECT_FINGERPRINTED_MEDIA && (await exists(path.join(OUTPUT_DIR, "img")))) {
    fail("docs/img/ still exists — optimize-media.mjs should have replaced it with docs/assets/img/");
  }

  await checkPlaceholders();

  if (failures.length) {
    console.error(`[check-publish] ${failures.length} problem(s) found:`);
    for (const message of failures) console.error(`  - ${message}`);
    process.exit(1);
  }
  console.log(`[check-publish] Passed: ${htmlFiles.length} pages, ${files.length} files checked.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
