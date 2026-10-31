// Site-wide browser checks. Every page in the built sitemap (plus the 404
// page) is tested, so new pages are covered without editing this file.
// Add client-specific tests (forms, galleries, menus) in their own spec files.
import { readFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Matches the build's ELEVENTY_PATH_PREFIX ("/" on a custom domain).
const PREFIX = `/${(process.env.ELEVENTY_PATH_PREFIX || "/").replace(/^\/+|\/+$/g, "")}/`.replace("//", "/");
const withPrefix = (pathname) =>
  pathname.startsWith(PREFIX) ? pathname : `${PREFIX}${pathname.replace(/^\//, "")}`;

const sitemap = readFileSync("docs/sitemap.xml", "utf8");
const pages = [
  ...[...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname),
  "/404.html",
].map(withPrefix);

// Small phone → large desktop.
const WIDTHS = [320, 375, 390, 768, 1024, 1440, 1920];

for (const pagePath of pages) {
  test.describe(pagePath, () => {
    test("loads without script errors or broken local requests", async ({ page }) => {
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => {
        const url = new URL(response.url());
        if (url.hostname === "127.0.0.1" && response.status() >= 400 && url.pathname !== pagePath) {
          errors.push(`${response.status()} ${url.pathname}`);
        }
      });
      await page.goto(pagePath);
      await expect(page.locator("h1")).toHaveCount(1);
      expect(errors).toEqual([]);
    });

    test("fits every screen width without sideways scrolling", async ({ page }) => {
      await page.goto(pagePath);
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await page.evaluate(() => document.fonts.ready);
        const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        expect(scrollWidth, `page width at ${width}px viewport`).toBeLessThanOrEqual(width);
      }
    });

    test("passes automated WCAG 2.2 AA checks on desktop and phone", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(pagePath);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        const summary = results.violations.map(
          (v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`
        );
        expect(summary, `axe violations at ${width}px`).toEqual([]);
      }
    });
  });
}
