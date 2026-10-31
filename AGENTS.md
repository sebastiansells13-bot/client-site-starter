# AGENTS.md

Instructions for AI coding assistants (Claude Code, Copilot, etc.) working in this repo.
This file describes **this specific client site**, cloned from `client-site-starter`.
Keep it up to date as the site diverges from the template.

## Before you change anything

1. Read this file completely, then the guide for the area you're changing:
   - [DEVELOPMENT.md](documentation/DEVELOPMENT.md) for architecture, build, media and deploy
   - [TESTING.md](documentation/TESTING.md) for the checks and how to extend them
   - [CMS-GUIDE.md](documentation/CMS-GUIDE.md) when changing content or CMS fields
     (the schema is `.pages.yml`)
   - [CONTRIBUTING.md](CONTRIBUTING.md) for branches, PRs and documentation placement
2. Check `git status` and leave unrelated work alone.
3. A visual or copy request doesn't authorize a new framework, backend, analytics
   service, or history rewrite. Ask first.

## Site-specific rules

<!-- Replace with this client's non-negotiables: content that must never be
published, which data file owns which copy, wording that must stay verbatim. -->

- `src/_data/business.json` owns the business name, contact details, and social links.
- `src/_data/metadata.json` owns the site title, description, and language.

## Commands

- **Dev**: `npm start` (Sass + Eleventy at http://localhost:8080/)
- **Build**: `npm run build` (production build into `docs/`, then the publish guard)
- **Offline tests**: `npm test` (unit tests for the build scripts; no browser, no network)
- **Browser checks**: `npm run test:browser` (against an existing `docs/` build)
- **Everything**: `npm run check` (offline tests, build, browser checks)
- **CI build**: `npm run build:ci` (GitHub Actions only: media optimization and the
  stricter publish guard)
- **Cleanup**: `npm run clean:artifacts`

## Generated output

- `src/` is the website source; `documentation/` holds maintained guides.
- `dev/` and `docs/` are disposable, ignored build output. Never edit `docs/` to fix
  something; change `src/` and rebuild.
- Keep original media in `src/_includes/img/`. Media is optimized only in GitHub Actions.
- `test-results/`, `playwright-report/` and `.cache/` are generated and ignored.

## Code style

- 2-space indentation, LF line endings, trim trailing whitespace, UTF-8 (per `.editorconfig`)
- Write links as root-relative (`/about/`); the build adds the GitHub Pages path prefix
  when the site has no custom domain.
- Images: `<img src="{{ src }}" alt="…" {% imageSize src %}>` so the browser reserves
  space. Add `loading="lazy" decoding="async"` below the fold.
- Don't hardcode content that a non-technical client might want to change — put it in
  `src/_data/` or a Pages CMS collection instead.

## Adding a new page

1. Create `src/<page-name>.njk` with front matter `layout: layouts/page.njk` and exactly
   one `<h1>`
2. Add it to `src/_data/navigation.json` if it belongs in the nav
3. If the client should be able to edit its content, add a matching entry to `.pages.yml`
   and document it in the CMS guide

New pages are picked up by the browser checks automatically through the sitemap.

## Verifying a change

- Code, template, or content changes: `npm run check`, then look at the affected pages in
  `npm start` at phone and desktop widths. Fix failures in `src/`; don't loosen a check
  or raise a budget without saying why in the commit.
- Documentation-only changes: check relative links and run `git diff --check`.
- After a merge to `main`, the deploy job's **Verify the live site serves this build**
  step must pass before reporting the change as shipped.
- Update the relevant guide in the same commit as the behavior it describes.

## What NOT to do

- Don't commit `dev/`, `docs/`, or test output
- Don't add a runtime backend/server — this is a static site by design (see the
  reference repos in [REFERENCES.md](documentation/REFERENCES.md) when a client needs one)
- Don't remove content hashing from CSS or media — it's what makes far-future,
  immutable caching safe
- Don't run `scripts/optimize-media.mjs` locally to "fix" media; it's a CI step
