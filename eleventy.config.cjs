const { DateTime } = require("luxon");
const { createHash } = require("node:crypto");
const { readFileSync, existsSync } = require("node:fs");
const pluginRss = require("@11ty/eleventy-plugin-rss").default;
const pluginNavigation = require("@11ty/eleventy-navigation");
const markdownIt = require("markdown-it");
const markdownItAnchor = require("markdown-it-anchor");
const sitemap = require("@quasibit/eleventy-plugin-sitemap");
const { HtmlBasePlugin } = require("@11ty/eleventy");
const { imageSize } = require("./lib/image-size.cjs");

const isProduction = process.env.ELEVENTY_ENV === "production";
const outputDirectory = isProduction ? "docs" : "dev";

// Sites on a custom domain (the normal case) are served from "/". GitHub
// Pages project sites without one are served from "/<repo>/"; the workflow
// sets ELEVENTY_PATH_PREFIX for that case and HtmlBasePlugin rewrites
// root-relative URLs in the HTML, so templates can keep using "/about/".
const pathPrefix = process.env.ELEVENTY_PATH_PREFIX || "/";

// Content-address an asset so production caching can be immutable and
// far-future without ever serving a stale file after a deploy.
function contentHash(filePath) {
  if (!existsSync(filePath)) return "dev";
  return createHash("sha256").update(readFileSync(filePath)).digest("hex").slice(0, 12);
}

const assetFiles = {
  stylesheet: "src/_includes/css/index.css",
};
const assetPaths = {
  stylesheet: `/assets/css/index.${contentHash(assetFiles.stylesheet)}.css`,
};

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(HtmlBasePlugin);
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPlugin(pluginNavigation);
  eleventyConfig.addPlugin(sitemap, {
    sitemap: {
      // Set this to the client's real production domain before launch.
      hostname: "https://example.com",
    },
  });

  eleventyConfig.setUseGitIgnore(false);
  eleventyConfig.ignores.add("**/.DS_Store");
  eleventyConfig.watchIgnores.add("**/.DS_Store");
  eleventyConfig.setDataDeepMerge(true);
  eleventyConfig.addGlobalData("assetPaths", assetPaths);

  eleventyConfig.addLayoutAlias("page", "layouts/page.njk");
  eleventyConfig.addLayoutAlias("post", "layouts/post.njk");

  eleventyConfig.addFilter("readableDate", (dateObj) =>
    DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("dd LLL yyyy")
  );

  // https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-date-string
  eleventyConfig.addFilter("htmlDateString", (dateObj) =>
    DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat("yyyy-LL-dd")
  );

  eleventyConfig.addFilter("head", (array, n) => {
    if (n < 0) return array.slice(n);
    return array.slice(0, n);
  });

  eleventyConfig.addFilter("slugify", (str) => {
    if (!str) return "";
    return str
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  });

  // During `npm start`, serve source images directly instead of copying
  // them into `dev/` on every rebuild. Production media is optimized by
  // the CI pipeline (scripts/optimize-media.mjs) after Eleventy runs.
  eleventyConfig.setServerPassthroughCopyBehavior("passthrough");
  eleventyConfig.addPassthroughCopy({ "src/_includes/img": "img" });
  eleventyConfig.addPassthroughCopy({
    [assetFiles.stylesheet]: assetPaths.stylesheet.slice(1),
  });
  eleventyConfig.addPassthroughCopy({ "src/_includes/favicons": "favicons" });
  eleventyConfig.addPassthroughCopy("CNAME");
  eleventyConfig.addPassthroughCopy(".nojekyll");

  let markdownLibrary = markdownIt({
    html: true,
    breaks: true,
    linkify: true,
  }).use(markdownItAnchor, {
    permalink: markdownItAnchor.permalink.headerLink({ class: "direct-link", symbol: "#" }),
  });
  eleventyConfig.setLibrary("md", markdownLibrary);

  // `<img src="{{ src }}" {% imageSize src %}>` → width/height attributes.
  eleventyConfig.addAsyncShortcode("imageSize", (src) => imageSize(src));

  eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

  return {
    templateFormats: ["md", "njk", "html", "liquid"],
    pathPrefix,
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    dataTemplateEngine: "njk",
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: outputDirectory,
    },
  };
};
