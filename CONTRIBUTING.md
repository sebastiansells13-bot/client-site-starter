# Contributing

Conventions for developers (human or AI) working in this repo.

## Content editors

Follow the [CMS guide](documentation/CMS-GUIDE.md) to edit content through Pages CMS.

## Branching

- `main` is always deployable — pushes to it trigger a production deploy
- Work in feature branches: `feature/<short-description>` or `fix/<short-description>`
- Open a pull request into `main`; the build workflow runs every check and must pass
  before merging

## Commits

- Keep commits scoped to one logical change
- Use an imperative subject line ("Add services page", not "Added services page")

## Before opening a PR

- `npm run check` locally: offline tests, production build with the publish guard, and
  browser checks (the same checks run in CI and block the deploy)
- Check that any new page is reachable from navigation (or intentionally isn't)
- Check that any client-editable content was added to `.pages.yml`, not hardcoded

## Dependencies

Dependabot opens weekly PRs for npm packages (grouped) and GitHub Actions. Actions are
pinned to full commit SHAs with the version in a comment; keep that format when editing
the workflow by hand.

## Documentation changes

- Keep `README.md`, `AGENTS.md`, and `CONTRIBUTING.md` at the root as entry points, plus
  a license file when there is one. Maintained guides live in `documentation/` with
  uppercase names such as `DEVELOPMENT.md`. Never put guides in `docs/`: it's build output.
- Update a guide in the same commit as the behavior it describes. When moving or
  renaming a guide, update the README's "Start here" table and every incoming link.
- Link to shared instructions instead of copying them.
- Documentation-only changes need a link check and `git diff --check`, not a site build.

## After merging

A green push isn't proof the site changed. The deploy job's **Verify the live site serves
this build** step loads the live homepage until it references the stylesheet this build
produced. If it fails, the site is still serving the previous version.

## Adding a new client site from this template

1. On GitHub, **Use this template → Create a new repository**, named for the client
2. Update `package.json` name, the sitemap `hostname` in `eleventy.config.cjs`,
   `src/_data/metadata.json`, and `CNAME` (the client's domain)
3. Fill in `src/_data/business.json` from the client's
   [intake worksheet](documentation/INTAKE-WORKSHEET.md)
4. Replace placeholder images/favicons under `src/_includes/`
5. Update `AGENTS.md` (site-specific rules) and the CMS guide for anything client-specific
6. In the new repo's **Settings → Pages**, choose **GitHub Actions** as the source, and
   set the custom domain to match `CNAME`
7. Set `CLOUDFLARE_ENABLED`, `CLOUDFLARE_ZONE` and `CLOUDFLARE_API_TOKEN` only if the
   site sits behind Cloudflare (see [DEVELOPMENT.md](documentation/DEVELOPMENT.md#cloudflare))

Until steps 2–3 are done the publish guard fails the build on purpose, so a client site
can't go live with the starter's placeholder name or `example.com` sitemap.
