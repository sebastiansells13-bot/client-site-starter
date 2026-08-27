# client-site-starter

A reusable starting point for client marketing sites: Eleventy (11ty) + Nunjucks,
Pages CMS for non-technical content editing, and GitHub Actions build/deploy to
GitHub Pages with automatic image optimization.

Modeled on the pattern used in [aindaco1/fronteras-website](https://github.com/aindaco1/fronteras-website),
generalized for repeat client work rather than one specific site.

## What's in here

| File/dir | Purpose |
|---|---|
| `METHODOLOGY.md` | How a client request turns into a deployed site, start to finish |
| `INTAKE-WORKSHEET.md` | The client intake form — fill this in first |
| `AGENTS.md` | Instructions for AI coding assistants working in a cloned repo |
| `CONTRIBUTING.md` | Dev conventions, including how to spin up a new client repo from this one |
| `CMS-GUIDE.md` | Client-facing walkthrough for editing content via Pages CMS |
| `.pages.yml` | Pages CMS content model (posts, services, team) |
| `src/_data/business.json` | Client name, tagline, contact info — fill from the worksheet |
| `.github/workflows/build-deploy.yml` | CI: build, optimize images, deploy to GitHub Pages |

## Quick start

```bash
npm install
npm start
```

Visit http://localhost:8080/.

## Using this as a new client site

See "Adding a new client site from this template" in [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Private/internal template — not licensed for redistribution.
