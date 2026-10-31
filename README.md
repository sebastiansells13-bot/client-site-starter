# client-site-starter

A reusable starting point for client marketing sites: Eleventy 3 + Nunjucks, Pages CMS
for non-technical content editing, and GitHub Actions that test the site, optimize
media, deploy to GitHub Pages, and confirm the live site changed.

Modeled on [aindaco1/fronteras-website](https://github.com/aindaco1/fronteras-website),
generalized for repeat client work rather than one specific site.

- [Live demo of the starter](https://sebastiansells13-bot.github.io/client-site-starter/)
- [Builds and deployments](https://github.com/sebastiansells13-bot/client-site-starter/actions)

## Start here

| Task | Guide |
|---|---|
| Turn a client request into a site | [Methodology](documentation/METHODOLOGY.md) and the [intake worksheet](documentation/INTAKE-WORKSHEET.md) |
| Create a new client repo from this one | [CONTRIBUTING.md](CONTRIBUTING.md#adding-a-new-client-site-from-this-template) |
| Understand the build, media pipeline, or deploy | [Development](documentation/DEVELOPMENT.md) |
| Run or extend the checks | [Testing](documentation/TESTING.md) |
| Hand content editing to the client | [CMS guide](documentation/CMS-GUIDE.md) |
| Handle forms, booking, commerce, or shared code | [Reference repos](documentation/REFERENCES.md) |
| Work as a coding agent | [AGENTS.md](AGENTS.md) |

## Quick start

Use Node.js 24 (`.nvmrc` selects it for nvm/fnm users).

```bash
npm ci
npm start
```

Visit http://localhost:8080/.

Before pushing, run everything CI runs except media optimization
(first time only: `npx playwright install chromium`):

```bash
npm run check
```

## License

No license is granted yet. The repository is public so client repos can be generated
from it and the demo can be served by GitHub Pages.
