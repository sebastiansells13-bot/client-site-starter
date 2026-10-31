# Development guide

For developers maintaining a site built from this template. See the
[CMS guide](CMS-GUIDE.md) for content editing, [TESTING.md](TESTING.md) for the checks,
and [CONTRIBUTING.md](../CONTRIBUTING.md) for workflow and documentation conventions.

## Local setup

Use Node.js 24, matching [.nvmrc](../.nvmrc) and the
[Build and Deploy workflow](../.github/workflows/build-deploy.yml). From the repository root:

```bash
npm ci
npm start
```

The site is at http://localhost:8080/ with Sass and Eleventy watching for changes. The
[development runner](../scripts/start.js) writes generated pages to `dev/`, serves media
straight from `src/`, and removes both `dev/` and `docs/` at startup and shutdown.

## Commands and output

| Command | Behavior |
|---|---|
| `npm start` | Local development server with live reload |
| `npm run build` | Cleans output, compiles Sass, builds the production site into `docs/`, runs the publish guard |
| `npm test` | Offline unit tests for the build scripts (`tests/unit/`) |
| `npm run test:browser` | Browser checks against an existing `docs/` build |
| `npm run check` | `npm test`, `npm run build`, then `npm run test:browser` |
| `npm run check:publish` | Publish guard on an existing build; already part of `build` |
| `npm run build:ci` | GitHub Actions only: media tool check, build, media optimization, stricter publish guard |
| `npm run clean` | Removes `dev/` and `docs/` |
| `npm run clean:artifacts` | Also removes test output and the local media cache |

`docs/` is the website artifact uploaded to GitHub Pages, not documentation. Both
output directories are ignored by Git.

## Architecture

- **Static site generator:** Eleventy 3, configured in
  [eleventy.config.cjs](../eleventy.config.cjs). Nunjucks layouts and pages, Markdown
  posts. No server runtime.
- **Styling:** Sass from [index.scss](../src/_includes/css/index.scss), compiled to
  `index.<hash>.css` under `/assets/css/` (see `assetPaths` in the config).
- **CMS:** Pages CMS, configured in [.pages.yml](../.pages.yml).
- **Site data:** [business.json](../src/_data/business.json) (name, contact, social),
  [metadata.json](../src/_data/metadata.json) (title, description, language),
  [navigation.json](../src/_data/navigation.json), plus `services.json` and `team.json`
  edited through the CMS.
- **Images:** the `imageSize` shortcode ([lib/image-size.cjs](../lib/image-size.cjs))
  reads width/height from the original file so pages don't shift while images load.

| Location | Purpose |
|---|---|
| `src/_data/` | Site, business, navigation, and CMS-edited data |
| `src/_includes/layouts/` | Base, page, and post layouts |
| `src/_includes/components/` | Header and footer |
| `src/_includes/css/` | Sass source (compiled `index.css` is ignored) |
| `src/_includes/img/` | Original media, organized by CMS upload folder |
| `src/_includes/favicons/` | Favicons |
| `src/posts/` | Blog posts in Markdown |
| `scripts/` | Dev runner, media optimizer, publish guard, deploy verification, Cloudflare sync |
| `tests/unit/` | Offline tests for the build scripts |
| `tests/*.spec.js` | Playwright browser checks |

### Path prefix

A client site with a custom domain is served from `/`. A GitHub Pages site without one
(such as this starter's own demo) is served from `/<repo>/`. The workflow sets
`ELEVENTY_PATH_PREFIX` from `CNAME`: empty file → `/<repo>/`, domain → `/`. Eleventy's
HtmlBasePlugin then rewrites root-relative URLs in the HTML, so templates always use
`/about/` style links. To reproduce a prefixed build locally:

```bash
ELEVENTY_PATH_PREFIX=/client-site-starter/ npm run build
ELEVENTY_PATH_PREFIX=/client-site-starter/ npm run test:browser
```

## Media pipeline

[optimize-media.mjs](../scripts/optimize-media.mjs) runs only in GitHub Actions
(`MEDIA_ALLOW_LOCAL=1` overrides that for debugging the script itself). After the
production build it:

- converts referenced JPG and PNG files to WebP when that's smaller;
- transcodes referenced MP4, MOV, M4V and WebM files to VP9/Opus WebM with FFmpeg,
  which the workflow installs only when the site has video;
- writes every referenced file under `/assets/img/` with a content hash in its name,
  rewrites references in HTML/CSS/XML/JSON, and removes the raw `docs/img/` directory;
- caches results in `.cache/media/`, which the workflow restores between runs.

Media nothing references is dropped from the published site. Originals in `src/` are
never modified. Tunables: `MEDIA_IMAGE_QUALITY` (80), `MEDIA_VIDEO_CRF` (40),
`MEDIA_VIDEO_MAX_DIMENSION` (1280 pixels).

## Deployment

The [Build and Deploy workflow](../.github/workflows/build-deploy.yml) runs on pull
requests into `main`, pushes to `main`, and manual dispatch. Pull requests run every
check without deploying.

Build job: Node from `.nvmrc` → `npm ci` → offline tests → restore media cache →
FFmpeg if needed → `npm run build:ci` → browser checks → upload the Pages artifact.

Deploy job: deploy to Pages → (Cloudflare only) sync cache rules and purge →
[verify-deploy.mjs](../scripts/verify-deploy.mjs), which loads the live homepage until
it references the stylesheet this build produced, then fetches that stylesheet and the
first fingerprinted image. A deploy that GitHub reports as successful but that isn't
actually live fails here.

All actions are pinned to full commit SHAs; Dependabot proposes updates weekly.

### Repository settings

In **Settings → Pages**, choose **GitHub Actions** as the source. For a client domain,
set the custom domain there and put the same domain in `CNAME`.

### Cloudflare

Only for sites that sit behind Cloudflare. Set the repository variable
`CLOUDFLARE_ENABLED` to `true` and the secrets `CLOUDFLARE_ZONE` (zone ID) and
`CLOUDFLARE_API_TOKEN` (a token scoped to that zone with Cache Rules: Edit and Cache
Purge). The deploy job then:

1. runs [sync-cloudflare-cache-rules.mjs](../scripts/sync-cloudflare-cache-rules.mjs),
   which creates or updates two rules giving `/assets/` one-year, immutable caching for
   the `CNAME` host, and leaves any other rules in the zone alone;
2. purges the Cloudflare cache so HTML changes show up immediately;
3. has the deploy verification also require `max-age=31536000, immutable` and a
   Cloudflare cache `HIT` on a repeat request.

HTML isn't cached long-term, so content edits appear after the purge, while
content-hashed assets never need purging.
