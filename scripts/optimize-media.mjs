#!/usr/bin/env node
// Post-build media optimization for CI. Runs after `npm run build` has copied
// original media into docs/img/:
//
//   - JPG/PNG referenced by the site become WebP when that is smaller.
//   - MP4/MOV/WebM referenced by the site become VP9/Opus WebM (needs FFmpeg).
//   - GIF/SVG/WebP/AVIF are kept as-is.
//   - Every referenced file is written to /assets/img/ with a content hash in
//     its name, references in HTML/CSS/XML/JSON are rewritten, and the raw
//     docs/img/ directory is removed, so all media can be cached as immutable.
//
// Originals in src/ are never modified. Results are cached in .cache/media/
// (restored by the workflow) so unchanged media isn't re-encoded every deploy.
//
// Usage:
//   node scripts/optimize-media.mjs           optimize docs/ (GitHub Actions only)
//   node scripts/optimize-media.mjs --check   fail early if a required tool is missing
//
// Set MEDIA_ALLOW_LOCAL=1 to run outside GitHub Actions (for debugging the
// pipeline itself). Tunables: MEDIA_IMAGE_QUALITY (80), MEDIA_VIDEO_CRF (40),
// MEDIA_VIDEO_MAX_DIMENSION (1280).
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const run = promisify(execFile);

const OUTPUT_DIR = "docs";
const SOURCE_DIR = "src/_includes/img";
const CACHE_DIR = ".cache/media";
const RAW_PREFIX = "img/";
const ASSET_PREFIX = "assets/img/";

const IMAGE_QUALITY = Number(process.env.MEDIA_IMAGE_QUALITY || 80);
const VIDEO_CRF = Number(process.env.MEDIA_VIDEO_CRF || 40);
const VIDEO_MAX_DIMENSION = Number(process.env.MEDIA_VIDEO_MAX_DIMENSION || 1280);
const SETTINGS = `q${IMAGE_QUALITY}-crf${VIDEO_CRF}-max${VIDEO_MAX_DIMENSION}-v1`;

const CONVERT_TO_WEBP = /\.(jpe?g|png)$/i;
const VIDEO = /\.(mp4|mov|m4v|webm)$/i;
const KEEP = /\.(gif|svg|webp|avif|ico|pdf)$/i;
const REWRITABLE = /\.(html|css|xml|json|webmanifest|txt)$/i;

// Matches the site's path prefix (see eleventy.config.cjs), e.g. "/" or "/client-site-starter/".
const pathPrefix = normalizePrefix(process.env.ELEVENTY_PATH_PREFIX);

function normalizePrefix(value = "/") {
  const trimmed = value.replace(/^\/+|\/+$/g, "");
  return trimmed ? `/${trimmed}/` : "/";
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else if (entry.name !== ".gitkeep") files.push(full);
  }
  return files;
}

async function hasFfmpeg() {
  try {
    await run("ffmpeg", ["-version"]);
    return true;
  } catch {
    return false;
  }
}

async function check() {
  const videos = (await walk(SOURCE_DIR)).filter((f) => VIDEO.test(f));
  if (videos.length && !(await hasFfmpeg())) {
    throw new Error(`${videos.length} video file(s) under ${SOURCE_DIR} need FFmpeg, which isn't installed.`);
  }
  console.log(`[optimize-media] Check passed (${videos.length} video file(s) found).`);
}

const sha = (buffer) => createHash("sha256").update(buffer).digest("hex");

// Produce the optimized version of one raw file, using the cache when possible.
// Returns the path of a file whose bytes should be published, and its extension.
async function optimize(rawPath) {
  const source = await readFile(rawPath);
  const ext = path.extname(rawPath).toLowerCase();
  const key = sha(Buffer.concat([source, Buffer.from(SETTINGS)])).slice(0, 24);

  if (KEEP.test(rawPath)) return { file: rawPath, ext };

  if (CONVERT_TO_WEBP.test(rawPath)) {
    const cached = path.join(CACHE_DIR, `${key}.webp`);
    if (!(await stat(cached).catch(() => null))) {
      await sharp(source).rotate().webp({ quality: IMAGE_QUALITY }).toFile(cached);
    }
    // Keep the original format if WebP didn't actually save anything.
    return (await stat(cached)).size < source.length ? { file: cached, ext: ".webp" } : { file: rawPath, ext };
  }

  if (VIDEO.test(rawPath)) {
    const cached = path.join(CACHE_DIR, `${key}.webm`);
    if (!(await stat(cached).catch(() => null))) {
      const scale = `scale='min(${VIDEO_MAX_DIMENSION},iw)':'min(${VIDEO_MAX_DIMENSION},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2`;
      await run("ffmpeg", [
        "-y", "-loglevel", "error", "-i", rawPath,
        "-vf", scale,
        "-c:v", "libvpx-vp9", "-crf", String(VIDEO_CRF), "-b:v", "0", "-row-mt", "1",
        "-c:a", "libopus", "-b:a", "96k",
        cached,
      ], { maxBuffer: 16 * 1024 * 1024 });
    }
    return { file: cached, ext: ".webm" };
  }

  return { file: rawPath, ext };
}

async function main() {
  if (process.argv.includes("--check")) return check();

  if (!process.env.GITHUB_ACTIONS && process.env.MEDIA_ALLOW_LOCAL !== "1") {
    throw new Error("Media optimization runs in GitHub Actions only (set MEDIA_ALLOW_LOCAL=1 to debug locally).");
  }

  const rawDir = path.join(OUTPUT_DIR, RAW_PREFIX);
  const rawFiles = await walk(rawDir);
  const textFiles = (await walk(OUTPUT_DIR)).filter((f) => REWRITABLE.test(f));
  const texts = new Map();
  for (const file of textFiles) texts.set(file, await readFile(file, "utf8"));

  await mkdir(CACHE_DIR, { recursive: true });

  // Map each referenced raw URL ("/img/team/a.jpg") to its fingerprinted URL.
  const replacements = new Map();
  let skipped = 0;
  let published = 0;
  for (const rawPath of rawFiles) {
    const relative = path.relative(rawDir, rawPath).split(path.sep).join("/");
    const rawUrl = `${pathPrefix}${RAW_PREFIX}${relative}`;
    const referenced = [...texts.values()].some((text) => text.includes(rawUrl) || text.includes(encodeURI(rawUrl)));
    if (!referenced) {
      skipped++;
      continue;
    }

    const { file, ext } = await optimize(rawPath);
    const hash = sha(await readFile(file)).slice(0, 12);
    const base = relative.slice(0, -path.extname(relative).length);
    const assetRelative = `${ASSET_PREFIX}${base}.${hash}${ext}`;
    const target = path.join(OUTPUT_DIR, assetRelative);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(file, target);
    replacements.set(rawUrl, `${pathPrefix}${assetRelative}`);
    replacements.set(encodeURI(rawUrl), `${pathPrefix}${encodeURI(assetRelative)}`);
    published++;
  }

  // Longest first so "/img/a.jpg" can't clobber part of "/img/a.jpg.bak".
  const ordered = [...replacements].sort((a, b) => b[0].length - a[0].length);
  for (const [file, text] of texts) {
    let updated = text;
    for (const [from, to] of ordered) updated = updated.split(from).join(to);
    if (updated !== text) await writeFile(file, updated);
  }

  await rm(rawDir, { recursive: true, force: true });
  console.log(
    `[optimize-media] Published ${published} referenced file(s) under /${ASSET_PREFIX}; ` +
      `dropped ${skipped} unreferenced file(s).`
  );
}

main().catch((err) => {
  console.error("[optimize-media] Failed:", err.message);
  process.exit(1);
});
