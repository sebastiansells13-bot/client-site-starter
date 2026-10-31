#!/usr/bin/env node
// Creates or updates two Cloudflare cache rules so everything under /assets/
// (content-hashed CSS and media, which never changes at a given URL) is
// cached for a year at the edge and in browsers, with an immutable header.
// HTML is left alone so content edits show up after the post-deploy purge.
//
// Only runs when a client site sits behind Cloudflare (the workflow checks
// CLOUDFLARE_ENABLED). The hostname comes from CNAME.
//
// Env: CLOUDFLARE_ZONE (zone ID) and CLOUDFLARE_API_TOKEN, a token scoped to
// that zone with "Zone → Cache Rules: Edit" (plus "Cache Purge" for the purge step).
import { readFileSync } from "node:fs";

const zoneId = process.env.CLOUDFLARE_ZONE;
const apiToken = process.env.CLOUDFLARE_API_TOKEN;
const host = readFileSync("CNAME", "utf8").trim();

if (!zoneId || !apiToken) throw new Error("CLOUDFLARE_ZONE and CLOUDFLARE_API_TOKEN are required");
if (!host) throw new Error("CNAME is empty — set the client's domain before enabling Cloudflare");

const ONE_YEAR = 31536000;
const assetPaths = `(http.host eq "${host}" and starts_with(http.request.uri.path, "/assets/"))`;

const managedRules = [
  {
    phase: "http_request_cache_settings",
    rulesetName: "Content-addressed asset caching",
    rule: {
      description: "client-site-starter: cache /assets/ for one year",
      expression: assetPaths,
      action: "set_cache_settings",
      action_parameters: {
        cache: true,
        edge_ttl: { mode: "override_origin", default: ONE_YEAR },
        browser_ttl: { mode: "override_origin", default: ONE_YEAR },
      },
      enabled: true,
    },
  },
  {
    phase: "http_response_cache_settings",
    rulesetName: "Immutable asset response headers",
    rule: {
      description: "client-site-starter: immutable Cache-Control on /assets/",
      expression: `(http.host eq "${host}" and starts_with(http.request.uri.path, "/assets/") and http.response.code eq 200)`,
      action: "set_cache_control",
      action_parameters: {
        immutable: { operation: "set" },
        "max-age": { operation: "set", value: ONE_YEAR },
        "s-maxage": { operation: "set", value: ONE_YEAR, cloudflare_only: true },
      },
      enabled: true,
    },
  },
];

async function cloudflare(pathname, options = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}${pathname}`, {
    ...options,
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
  });
  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    const details = (payload.errors || []).map((e) => `${e.code}: ${e.message}`).join("; ");
    throw new Error(`Cloudflare ${options.method || "GET"} ${pathname} failed (${response.status}): ${details}`);
  }
  return payload.result;
}

async function sync({ phase, rulesetName, rule }) {
  const rulesets = await cloudflare("/rulesets");
  const existing = rulesets.find((r) => r.kind === "zone" && r.phase === phase);

  if (!existing) {
    await cloudflare("/rulesets", {
      method: "POST",
      body: JSON.stringify({ kind: "zone", name: rulesetName, phase, rules: [rule] }),
    });
    return console.log(`Created: ${rule.description}`);
  }

  // Only touch our own rule; leave any other rules in the zone's ruleset alone.
  const { rules = [] } = await cloudflare(`/rulesets/${existing.id}`);
  const ours = rules.find((r) => r.description === rule.description);
  if (ours) {
    await cloudflare(`/rulesets/${existing.id}/rules/${ours.id}`, { method: "PATCH", body: JSON.stringify(rule) });
    return console.log(`Updated: ${rule.description}`);
  }
  await cloudflare(`/rulesets/${existing.id}/rules`, { method: "POST", body: JSON.stringify(rule) });
  console.log(`Created: ${rule.description}`);
}

for (const managed of managedRules) await sync(managed);
