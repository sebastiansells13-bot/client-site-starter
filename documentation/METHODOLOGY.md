# Request-handling methodology

How a submitted intake worksheet turns into a deployed client site, from this template.

## 1. Worksheet → intake fields

[INTAKE-WORKSHEET.md](INTAKE-WORKSHEET.md) is the canonical form. It captures exactly what decides the
template tier and populates the first-pass content:

- Business name, one-line description, 3–5 example sites they like
- Pages needed (Home, About, Services, Blog, Contact, Store…)
- Functionality: static content only? forms? blog/CMS? events/RSVP? selling anything?
- Who edits content after launch — you, or the client themselves?
- Brand assets on hand (logo, colors, fonts) vs. needs-design
- Domain/hosting status
- Timeline and budget tier

## 2. Triage into a template tier

| Signal from worksheet | Template |
|---|---|
| Static pages, maybe a contact form, client won't touch content | This repo as-is, CMS section left unused |
| Client wants to self-edit content regularly | This repo + `.pages.yml` wired to their content types |
| Contact or inquiry form that only needs to reach an inbox | Stay static: Formspree with a `_gotcha` honeypot and a plain HTML POST that works without JavaScript (see `zema-landing`) |
| Form that must store entries or send follow-up email (sign-ups, drawings, waitlists) | Static site + one small Cloudflare Worker with D1 and Resend (see `nob-hill-chile-drop`) |
| Appointment booking | Link to or deploy a self-hosted booking page (see `scheduler`) rather than building one into the site |
| Selling products/tickets/RSVPs (repeat/serious commerce) | Graduate to a Worker + Stripe/Resend stack shared via a platform submodule (see `store`) |
| Selling one simple product | Stay on this static template, embed a Stripe Payment Link — don't build a commerce stack for one SKU |

This triage step is the actual methodology: it stops every request from defaulting to
the heaviest stack. [REFERENCES.md](REFERENCES.md) maps each row to a working example.

## 3. Repo standup (per project)

Follow "Adding a new client site from this template" in
[CONTRIBUTING.md](../CONTRIBUTING.md#adding-a-new-client-site-from-this-template). In
short: generate the repo from the template, set the domain and site data from the
worksheet, switch Pages to GitHub Actions, and record the client's non-negotiables
(content that must never be published, which data file owns which copy) in `AGENTS.md`.
The build refuses to pass while the starter's placeholders are still in place.

## 4. Build phase

Populate the template from worksheet answers into **content files** (`src/_data/`,
Markdown posts, CMS collections) — not hardcoded HTML — so the CMS handoff in the next
step works for free instead of requiring a rebuild.

## 5. Client handoff via CMS

If the client is self-editing: point them to Pages CMS
(`pagescms.org/edit/<org>/<repo>`), signed in with their own GitHub account, editing
structured content types with no code exposure. Adapt [CMS-GUIDE.md](CMS-GUIDE.md) in plain language
before handoff.

## 6. Deploy pipeline

[build-deploy.yml](../.github/workflows/build-deploy.yml) — push to `main` → offline
tests → build → optimize and fingerprint media → publish guard + browser checks →
deploy to GitHub Pages → (Cloudflare only) sync cache rules and purge → verify the live
site serves the new build. Pull requests run everything up to the checks without
deploying. Written once here, reused per client repo without changes; see
[DEVELOPMENT.md](DEVELOPMENT.md#deployment).

## 7. Launch check

Before telling the client a site or change is live:

- The **Build and Deploy** run for that commit succeeded, including its final
  **Verify the live site serves this build** step
- The live URL shows the change over HTTPS on the custom domain
- Contact forms deliver a real test submission

CI already blocks a deploy if any page fails the publish guard (missing title,
description or `<h1>`, broken local links, oversized files, starter placeholders left
in) or the browser checks (WCAG 2.2 AA via axe, sideways scrolling from 320px to
1920px, script errors). Run `npm run check` locally to see the same results before
pushing; [TESTING.md](TESTING.md) covers what each check does and what isn't automated.

## 8. Scaling past one-off sites

Once you've built 2–3 of these, pull shared pieces (build scripts, media optimization,
CI workflow, base layout) into your own platform repo and consume it as a git submodule
in each client repo, instead of copy-pasting boilerplate forward.

`dust-wave-platform` is the worked example: each site pins one submodule commit, and a
piece only moves into the platform once two sites have an identical, tested copy of it.
Sites keep their own content, templates, and deploys, and upgrade or roll back on their
own schedule.
