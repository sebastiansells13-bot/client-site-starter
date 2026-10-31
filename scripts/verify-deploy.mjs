#!/usr/bin/env node
// Post-deploy check: proves the live site is serving the build that was just
// deployed, not only that the deploy step reported success.
//
// It loads the live homepage until it references the same content-hashed
// stylesheet the build produced (GitHub Pages can take a minute to switch
// over), then fetches that stylesheet and the first fingerprinted image.
// With CLOUDFLARE_ENABLED=true it also requires one-year immutable caching
// and an edge-cache HIT on a repeat request.
//
// Env: SITE_URL (the live homepage), EXPECTED_STYLESHEET (the stylesheet path
// from the build), optional VERIFY_ATTEMPTS (36) and VERIFY_DELAY_MS (5000).
const siteUrl = process.env.SITE_URL;
const expectedStylesheet = process.env.EXPECTED_STYLESHEET;
const expectCloudflare = process.env.CLOUDFLARE_ENABLED === "true";
const attempts = Number(process.env.VERIFY_ATTEMPTS || 36);
const delayMs = Number(process.env.VERIFY_DELAY_MS || 5000);

if (!siteUrl || !expectedStylesheet) {
  throw new Error("SITE_URL and EXPECTED_STYLESHEET are required");
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function checkCacheHeaders(response, url, { expectHit }) {
  const cacheControl = response.headers.get("cache-control") || "";
  const cacheStatus = (response.headers.get("cf-cache-status") || "").toUpperCase();
  if (!cacheControl.includes("max-age=31536000") || !cacheControl.includes("immutable")) {
    throw new Error(`${url} has Cache-Control "${cacheControl}", expected one-year immutable`);
  }
  if (expectHit && cacheStatus !== "HIT") {
    throw new Error(`${url} did not reach a Cloudflare cache HIT (got "${cacheStatus}")`);
  }
  return { cacheControl, cacheStatus };
}

async function verify() {
  const home = await fetch(`${siteUrl}${siteUrl.includes("?") ? "&" : "?"}verify=${Date.now()}`, {
    headers: { "Cache-Control": "no-cache" },
  });
  if (!home.ok) throw new Error(`Homepage returned ${home.status}`);
  const html = await home.text();

  const stylesheet = html.match(/href="([^"]*\/assets\/css\/index\.[a-f0-9]{12}\.css)"/)?.[1];
  if (stylesheet !== expectedStylesheet) {
    throw new Error(`Live homepage still references ${stylesheet || "no hashed stylesheet"}, waiting for ${expectedStylesheet}`);
  }

  const image = html.match(/(?:src|href|content)="([^"]*\/assets\/img\/[^"?#]+\.[a-f0-9]{12}\.[a-z0-9]+)"/i)?.[1];
  const results = [];
  for (const asset of [stylesheet, image].filter(Boolean)) {
    const url = new URL(asset, siteUrl);
    const first = await fetch(url);
    if (!first.ok) throw new Error(`${url} returned ${first.status}`);
    if (!expectCloudflare) {
      results.push({ asset: url.pathname, status: first.status });
      continue;
    }
    checkCacheHeaders(first, url, { expectHit: false });
    const second = await fetch(url);
    if (!second.ok) throw new Error(`${url} returned ${second.status} on repeat fetch`);
    results.push({ asset: url.pathname, status: second.status, ...checkCacheHeaders(second, url, { expectHit: true }) });
  }
  return results;
}

let lastError;
for (let attempt = 1; attempt <= attempts; attempt++) {
  try {
    const results = await verify();
    console.log(`Verified live deploy at ${siteUrl}:`);
    console.table(results);
    process.exit(0);
  } catch (error) {
    lastError = error;
    if (attempt < attempts) {
      console.log(`Attempt ${attempt}/${attempts}: ${error.message}`);
      await wait(delayMs);
    }
  }
}
throw lastError;
