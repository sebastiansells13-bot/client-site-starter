// Offline tests for the build scripts. Each test builds a tiny fake site in a
// temporary folder and runs the real script against it. No network, no browser.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const run = promisify(execFile);
const require = createRequire(import.meta.url);
const { imageSize } = require("../../lib/image-size.cjs");
const scripts = fileURLToPath(new URL("../../scripts/", import.meta.url));

const page = (body, extra = "") => `<!doctype html><html lang="en"><head>
<meta name="viewport" content="width=device-width"><title>T</title>
<meta name="description" content="D">${extra}</head><body>${body}</body></html>`;

async function fakeSite(files, packageName = "client-site-starter") {
  const root = await mkdtemp(path.join(tmpdir(), "site-"));
  const all = {
    "package.json": JSON.stringify({ name: packageName }),
    "src/_data/business.json": JSON.stringify({ name: "Acme" }),
    "src/_data/metadata.json": JSON.stringify({ title: "Acme" }),
    "docs/sitemap.xml": "<urlset><url><loc>https://acme.test/</loc></url></urlset>",
    ...files,
  };
  for (const [file, contents] of Object.entries(all)) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), contents);
  }
  return root;
}

const png = (width, height) =>
  sharp({ create: { width, height, channels: 3, background: "#c33" } }).png().toBuffer();

// CI sets these for the whole job; clear them so each test controls its own.
const BUILD_ENV_DEFAULTS = {
  ELEVENTY_PATH_PREFIX: "",
  EXPECT_FINGERPRINTED_MEDIA: "",
  MEDIA_ALLOW_LOCAL: "",
};

async function runScript(name, cwd, env = {}, args = []) {
  try {
    const { stdout } = await run("node", [path.join(scripts, name), ...args], {
      cwd,
      env: { ...process.env, ...BUILD_ENV_DEFAULTS, ...env },
    });
    return { code: 0, output: stdout };
  } catch (error) {
    return { code: error.code, output: `${error.stdout}${error.stderr}` };
  }
}

test("imageSize reads dimensions of local images and ignores everything else", async () => {
  const root = await fakeSite({ "src/_includes/img/team/a.png": await png(40, 30) });
  try {
    assert.equal(await imageSize("/img/team/a.png", path.join(root, "src/_includes")), 'width="40" height="30"');
    assert.equal(await imageSize("/img/missing.png", path.join(root, "src/_includes")), "");
    assert.equal(await imageSize("https://example.com/a.png"), "");
    assert.equal(await imageSize(undefined), "");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("optimize-media fingerprints referenced media and drops the rest", async () => {
  const root = await fakeSite({
    "docs/index.html": page('<h1>x</h1><img src="/site/img/team/a.png"><a href="https://other.test/b.png">b</a>'),
    "docs/img/team/a.png": await png(400, 300),
    "docs/img/unused.png": await png(10, 10),
  });
  try {
    const result = await runScript("optimize-media.mjs", root, { MEDIA_ALLOW_LOCAL: "1", ELEVENTY_PATH_PREFIX: "/site/" });
    assert.equal(result.code, 0, result.output);

    const html = await readFile(path.join(root, "docs/index.html"), "utf8");
    const fingerprinted = html.match(/src="\/site\/assets\/img\/team\/a\.([a-f0-9]{12})\.(webp|png)"/);
    assert.ok(fingerprinted, html);
    assert.ok(html.includes("https://other.test/b.png"), "external URLs must not be rewritten");

    const published = await readdir(path.join(root, "docs/assets/img/team"));
    assert.deepEqual(published, [`a.${fingerprinted[1]}.${fingerprinted[2]}`]);
    await assert.rejects(readdir(path.join(root, "docs/img")), "raw docs/img/ should be removed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("optimize-media keeps icon and social preview images in their original format", async () => {
  const root = await fakeSite({
    "docs/index.html": page(
      '<h1>x</h1><img src="/img/hero.png">',
      '<meta property="og:image" content="https://acme.test/img/hero.png">' +
        '<link rel="apple-touch-icon" href="/img/icon.png">'
    ),
    "docs/img/hero.png": await png(400, 300),
    "docs/img/icon.png": await png(180, 180),
  });
  try {
    const result = await runScript("optimize-media.mjs", root, { MEDIA_ALLOW_LOCAL: "1" });
    assert.equal(result.code, 0, result.output);
    const html = await readFile(path.join(root, "docs/index.html"), "utf8");
    assert.match(html, /content="https:\/\/acme\.test\/assets\/img\/hero\.[a-f0-9]{12}\.png"/);
    assert.match(html, /<img src="\/assets\/img\/hero\.[a-f0-9]{12}\.png"/, "same file stays one format");
    assert.match(html, /href="\/assets\/img\/icon\.[a-f0-9]{12}\.png"/);
    assert.doesNotMatch(html, /\.webp/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("optimize-media refuses to run outside GitHub Actions by default", async () => {
  const root = await fakeSite({ "docs/index.html": page("<h1>x</h1>") });
  try {
    const result = await runScript("optimize-media.mjs", root, { GITHUB_ACTIONS: "", MEDIA_ALLOW_LOCAL: "" });
    assert.notEqual(result.code, 0);
    assert.match(result.output, /GitHub Actions only/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("check-publish passes a complete page", async () => {
  const root = await fakeSite({
    "docs/index.html": page('<h1>Home</h1><a href="/about/">About</a>'),
    "docs/about/index.html": page("<h1>About</h1>"),
  });
  try {
    const result = await runScript("check-publish.mjs", root);
    assert.equal(result.code, 0, result.output);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("check-publish reports missing basics, broken links and raw media", async () => {
  const root = await fakeSite({
    "docs/index.html": '<html><body><a href="/missing/">x</a><img src="/img/a.png"></body></html>',
    "docs/img/a.png": "x",
  });
  try {
    const result = await runScript("check-publish.mjs", root, { EXPECT_FINGERPRINTED_MEDIA: "true" });
    assert.notEqual(result.code, 0);
    for (const expected of [
      /missing a lang attribute/,
      /missing or empty <title>/,
      /missing or empty meta description/,
      /exactly one <h1>, found 0/,
      /broken local link or asset \/missing\//,
      /\/img\/a\.png wasn't fingerprinted/,
      /docs\/img\/ still exists/,
    ]) {
      assert.match(result.output, expected);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("check-publish flags starter placeholders only in client repos", async () => {
  const files = {
    "docs/index.html": page("<h1>Home</h1>"),
    "docs/sitemap.xml": "<urlset><url><loc>https://example.com/</loc></url></urlset>",
    "src/_data/business.json": JSON.stringify({ name: "Client Business Name" }),
    "src/_data/metadata.json": JSON.stringify({ title: "Client Site Starter" }),
  };
  const starter = await fakeSite(files);
  const client = await fakeSite(files, "acme-site");
  try {
    assert.equal((await runScript("check-publish.mjs", starter)).code, 0);
    const result = await runScript("check-publish.mjs", client);
    assert.notEqual(result.code, 0);
    assert.match(result.output, /example\.com/);
    assert.match(result.output, /placeholder business name/);
    assert.match(result.output, /placeholder title/);
  } finally {
    await rm(starter, { recursive: true, force: true });
    await rm(client, { recursive: true, force: true });
  }
});

test("check-publish resolves links under a path prefix", async () => {
  const root = await fakeSite({
    "docs/index.html": page('<h1>Home</h1><a href="/site/about/">About</a><a href="/about/">Unprefixed</a>'),
    "docs/about/index.html": page("<h1>About</h1>"),
  });
  try {
    const result = await runScript("check-publish.mjs", root, { ELEVENTY_PATH_PREFIX: "/site/" });
    assert.notEqual(result.code, 0);
    assert.doesNotMatch(result.output, /\/site\/about\//);
    assert.match(result.output, /broken local link or asset \/about\//);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
