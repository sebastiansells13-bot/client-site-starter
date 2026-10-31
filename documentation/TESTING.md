# Testing guide

Three layers of checks run on every pull request and before every deploy. Run them all
locally with `npm run check` (first time only: `npx playwright install chromium`). Stop
`npm start` first; the browser checks serve `docs/` on port 8181.

## 1. Offline unit tests — `npm test`

[tests/unit/](../tests/unit/) uses Node's built-in test runner. Each test builds a tiny
fake site in a temporary folder and runs the real script against it, covering the media
optimizer, the publish guard, path-prefix handling, and the `imageSize` helper. No
browser or network is needed.

Add a test here when you change a script in `scripts/` or `lib/`.

## 2. Publish guard — `npm run check:publish`

[check-publish.mjs](../scripts/check-publish.mjs) runs at the end of every
`npm run build` and checks the generated `docs/` folder:

- every page has a `lang`, a viewport tag, a non-empty `<title>` and meta description,
  and exactly one `<h1>`;
- every root-relative link and asset resolves to a built file;
- no file is over 5 MB and the CSS is under 30 KB gzipped (`FILE_BUDGET_MB` and
  `CSS_BUDGET_KB` raise these for a site that genuinely needs it — say why in the commit);
- in a client repo (any package name other than `client-site-starter`), the starter's
  placeholders are gone: `example.com` in the sitemap, "Client Business Name", and
  "Client Site Starter".

In CI, `build:ci` runs it again with `EXPECT_FINGERPRINTED_MEDIA=true`, which also
requires every image and video reference to point at a content-hashed `/assets/img/` file.

## 3. Browser checks — `npm run test:browser`

[site.spec.js](../tests/site.spec.js) runs in Chromium through Playwright against every
page in `docs/sitemap.xml` plus the 404 page, so new pages are covered automatically:

- **Accessibility:** axe-core WCAG 2.0/2.1/2.2 A and AA rules at 1440px and 390px,
  with reduced motion.
- **Mobile layout:** no sideways scrolling at 320, 375, 390, 768, 1024, 1440 and 1920px.
- **Errors:** no uncaught script errors and no failed requests to the site itself.

Failures in CI upload `test-results/` (screenshots and traces) as a workflow artifact.
Open a trace with `npx playwright show-trace <path-to-trace.zip>`.

### Client-specific tests

Put tests for a client's own features (a contact form, a menu, a gallery, booking links)
in new `tests/*.spec.js` files rather than editing `site.spec.js`. Base them on what a
visitor needs to accomplish, as in
[body-and-blood-landing's tests](https://github.com/aindaco1/body-and-blood-landing/blob/main/tests/e2e/site.spec.js).

## What isn't automated

- **Visual design.** There are no screenshot baselines; review layout changes by eye at
  phone and desktop widths. `fronteras-website` shows how to add reviewed baselines in a
  pinned Playwright container if a client site needs them.
- **Form delivery.** Submit a real test message through any contact form after launch.
- **Content quality.** Spelling, tone and accuracy still need a human read.
