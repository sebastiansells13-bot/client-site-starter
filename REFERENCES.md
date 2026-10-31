# Reference repos

Public repos from [aindaco1](https://github.com/aindaco1?tab=repositories) worth reading
when a client request goes beyond what this template covers. They are references, not
starting points: new client sites still start from this template.

Last reviewed: 2026-10-30.

## Static sites like ours

| Repo | Stack | Look here for |
|---|---|---|
| [fronteras-website](https://github.com/aindaco1/fronteras-website) | Eleventy 3 + Nunjucks + Pages CMS | The original this template is based on. `documentation/DEVELOPMENT.md` (CI media optimization, Cloudflare immutable cache rules + post-deploy asset check), `scripts/validate-performance.mjs` (build output checks), Playwright screenshot baselines |
| [body-and-blood-landing](https://github.com/aindaco1/body-and-blood-landing) | Jekyll + GitHub Pages | Smallest complete example: one data file owns all copy, `scripts/check-publish.js` (allowed-files list, CSS/JS size budgets, no stray embeds), `tests/e2e/site.spec.js` (axe WCAG 2.2 AA, no horizontal overflow from 320px to 1920px, reduced motion). Docs split into ARCHITECTURE / EDITING / DESIGN / OPERATIONS |
| [zema-landing](https://github.com/aindaco1/zema-landing) | Jekyll + Pages CMS | Venue landing page. Formspree contact form with `_gotcha` honeypot and a no-JavaScript POST fallback; `.pages.yml` with commit message templates, `rename: safe` media and an image focal-point component; `docs/AGENT_PLAYBOOK.md` (a "request type → file → required check" routing table) |
| [nob-hill-chile-drop](https://github.com/aindaco1/nob-hill-chile-drop) | Jekyll + Cloudflare Worker + D1 + Resend | Static site plus one small backend (event sign-ups, organizer desk). The pattern to use when a client needs a form that stores data, without moving to a full commerce stack |
| [restaurant-locations](https://github.com/aindaco1/restaurant-locations) | Jekyll + Alpine.js + Python | Data pulled on a schedule by GitHub Actions and published as a static, filterable site |

## When a client needs more than a brochure site

| Need | Repo | Notes |
|---|---|---|
| Selling products, tickets, RSVPs, downloads | [store](https://github.com/aindaco1/store) (MIT) | Jekyll storefront + Cloudflare Worker for pricing, inventory, Stripe, orders, Resend email. Replaced the older Snipcart-based [dust-wave-shop](https://github.com/aindaco1/dust-wave-shop) |
| Crowdfunding / pre-orders | [pool](https://github.com/aindaco1/pool) (MIT) | All-or-nothing campaigns; cards saved now, charged only if funded |
| Appointment booking | [scheduler](https://github.com/aindaco1/scheduler) (MIT) | Self-hosted, one-person booking page on Cloudflare with Google/iCloud calendars, Meet/Zoom, Resend reminders, optional Spanish |
| Shared code across many sites | [dust-wave-platform](https://github.com/aindaco1/dust-wave-platform) (MIT) | Pinned as a git submodule by each site. Packages added only once two consumers share a tested duplicate: `site-shell`, `build-core` (minification), `test-core` (mobile overflow assertions), `design-core` (Sass components), `worker-core`, `tax-core`, `shipping-core` |
| Repo health across all client repos | [github-repo-scan](https://github.com/aindaco1/github-repo-scan) | Weekly email report over every repo via a read-only GitHub App on Cloudflare |

## Doc conventions they share

- `README.md`, `AGENTS.md`, `CONTRIBUTING.md` at the root as entry points; longer guides
  in a docs folder with uppercase names (`DEVELOPMENT.md`, `OPERATIONS.md`).
- `AGENTS.md` lists the site's non-negotiables (what must never be published, which
  data file owns which copy) and tells agents which guide to read for which change.
- Behavior and its guide change in the same commit.
- "A successful push does not mean the live site changed": check the workflow run and
  the live page before calling a change shipped.
