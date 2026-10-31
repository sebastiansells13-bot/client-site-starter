# AGENTS.md

Instructions for AI coding assistants (Claude Code, Copilot, etc.) working in this repo.
This file describes **this specific client site**, cloned from `client-site-starter`.
Keep it up to date as the site diverges from the template.

## Before you change anything

1. Read this file, then `README.md`, then the guide for the area you're changing
   (`CMS-GUIDE.md` for content or CMS fields, `CONTRIBUTING.md` for workflow).
2. Check `git status` and leave unrelated work alone.
3. A visual or copy request doesn't authorize a new framework, backend, analytics
   service, or history rewrite. Ask first.

## Site-specific rules

<!-- Replace with this client's non-negotiables: content that must never be
published, which data file owns which copy, wording that must stay verbatim. -->

- `src/_data/business.json` owns the business name, contact details, and social links.

## Commands

- **Dev**: `npm start` (runs Sass + Eleventy with hot reload at http://localhost:8080/;
  writes generated pages to `dev/`, serves images/CSS/fonts straight from `src/`, and
  cleans `dev/` and `docs/` on startup and shutdown)
- **Build**: `npm run build` (cleans output, compiles Sass, builds the Eleventy site with
  original, unoptimized media into `docs/`)
- **CI build**: `npm run build:ci` (GitHub Actions only — runs `npm run build`, then
  optimizes referenced images with `scripts/optimize-media.mjs`)
- **Test**: `npm test` (production build, then `check:publish`, then `test:browser`).
  First run needs `npx playwright install chromium`. Stop `npm start` first: tests
  serve `docs/` on port 8181.
- **Publish guard**: `npm run check:publish` (`scripts/check-publish.mjs`; checks an
  existing `docs/` build for page titles, descriptions, one `<h1>` per page, broken local
  links, file/CSS size budgets, and leftover starter placeholders in client repos)
- **Browser checks**: `npm run test:browser` (`tests/site.spec.js`; every sitemap page
  plus 404: axe WCAG 2.2 AA, no sideways scrolling at 320–1920px, no script errors or
  broken local requests). Put client-specific tests in their own files under `tests/`.

## Architecture

- **SSG**: Eleventy (11ty) v3, static output, no server runtime
- **Input**: `src/` — Markdown and Nunjucks (`.njk`) templates
- **Dev output**: `dev/` (generated pages only; removed when `npm start` stops)
- **Production output**: `docs/` (generated, not committed; built in CI, deployed via
  GitHub Actions to GitHub Pages)
- **Templates**: Nunjucks for layouts and pages; Markdown for blog posts
- **Styling**: Sass, compiled from `src/_includes/css/index.scss` to a content-hashed,
  cache-busted `index.<hash>.css` (see `assetPaths` in `eleventy.config.cjs`)
- **Content editing**: Pages CMS (`.pages.yml`) — the client edits structured content
  (posts, services, team members, etc.) through a GitHub-authenticated web UI with no
  code exposure. See `CMS-GUIDE.md` for the client-facing walkthrough.
- **Data**: `src/_data/business.json` holds the client's name, tagline, contact info,
  and social links — pulled from the intake worksheet. Reference it in templates rather
  than hardcoding business details.
- **Deployment**: pushes to `main` build the site and deploy to GitHub Pages;
  pull requests run the build to catch errors but do not deploy.

## Code style

- 2-space indentation, LF line endings, trim trailing whitespace, UTF-8 (per `.editorconfig`)
- Template formats: `.md`, `.njk`, `.html`
- Dates: UTC, Luxon filters `readableDate` (display) / `htmlDateString` (machine-readable)
- Passthrough assets live under `src/_includes/{img,favicons}`; don't reference images
  from anywhere else or the build won't copy them
- Don't hardcode content that a non-technical client might want to change — put it in
  `src/_data/` or a Pages CMS collection instead

## Adding a new page

1. Create `src/<page-name>.njk` with front matter `layout: layouts/page.njk`
2. Add it to `src/_data/navigation.json` if it belongs in the nav
3. If the client should be able to edit its content, add a matching entry to `.pages.yml`

## Adding a new content type to the CMS

1. Add a `collection` block to `.pages.yml` (see the `posts` entry as a template)
2. Create the corresponding Nunjucks layout under `src/_includes/layouts/`
3. Add a listing/index template if the content type needs its own index page
4. Document the new field set in `CMS-GUIDE.md` in plain language for the client

## Verifying a change

- Code, template, or content changes: `npm test`, then look at the affected pages in
  `npm start` at phone and desktop widths. Fix failures in `src/`; don't loosen a check
  or raise a budget without saying why in the commit.
- Documentation-only changes: check relative links and run `git diff --check`; no site
  build is needed.
- After a merge to `main`, check that the Build and Deploy run succeeded and the live
  page shows the change before reporting it as shipped.
- Update the relevant guide (`AGENTS.md`, `CMS-GUIDE.md`, `README.md`) in the same
  commit as the behavior it describes.

## What NOT to do

- Don't commit `dev/` or `docs/` — both are build output
- Don't edit files in `docs/` to fix something; change `src/` and rebuild
- Don't add a runtime backend/server — this is a static site by design
- Don't remove the `assetPaths` content-hashing — it's what makes the CDN cache safe
  to set far-future/immutable
