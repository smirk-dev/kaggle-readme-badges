# kaggle-readme-badges

A tiny serverless SVG card that renders your earned Kaggle badges as a single
image, in the same packed-hexagon-grid style as Kaggle's own profile "Badges"
section — embeddable in a GitHub README the same way
[github-readme-stats](https://github.com/anuraghazra/github-readme-stats) or
[streak-stats](https://github.com/DenverCoder1/github-readme-streak-stats) are.

Why this exists instead of a hand-downloaded screenshot: a static PNG goes
stale the moment you earn a new badge, and re-cropping a screenshot every time
is annoying. This regenerates the card from a small JSON manifest
(`data/badges.json`), and a scheduled heartbeat (`scripts/heartbeat.mjs`)
keeps that manifest current on its own — see below.

## Embed it

```md
<img src="https://<your-deployment>.vercel.app/api/kaggle-badges" alt="Kaggle Badges" />
```

Query params (all optional):

| param      | default              | what it does                                  |
|------------|----------------------|------------------------------------------------|
| `cols`     | `8`                  | badges per row                                  |
| `size`     | `56`                 | badge size in px                                |
| `gap`      | `6`                  | spacing between badges in px                    |
| `bg`       | `#0d1117`            | background color, or `none` for transparent     |
| `title`    | off                  | `1` to draw a heading above the grid            |
| `titleText`| `"<user>'s Kaggle Badges"` | heading text, only used when `title=1`   |

Example: `?cols=10&bg=none&title=1`

## How the data gets here

Kaggle's profile page is a client-hydrated SPA — a plain HTTP request (curl,
`fetch()`) only ever gets an empty ~6KB shell, no matter what headers or auth
you send, because the badge grid is built by client-side JS after the page
loads. But that hydration doesn't require being *logged in*: a real browser
with **zero cookies** (same as any logged-out visitor) still renders the
badges via Kaggle's own anonymous-session flow. Verified directly — a fresh
Playwright context with no stored state, pointed at the public profile URL,
sees all of them.

So `scripts/heartbeat.mjs` needs no credentials, no session, no login step:
it launches a throwaway headless Chromium, loads `kaggle.com/<username>`,
extracts the current badge grid, and diffs it against `data/badges.json`. If
the badge set actually changed, it updates the manifest and pushes — Vercel
redeploys automatically. If nothing changed, it's a silent no-op (logged to
`heartbeat.log`).

Run it on a schedule (a daily Windows Scheduled Task, cron, a GitHub Actions
cron job — anything that can run `npm run heartbeat` periodically works,
since it needs no secrets):

```
npm run heartbeat
```

A manual one-off refresh is also still there for a quick check without
waiting for the schedule: `scripts/refresh-badges.console.js`, pasted into
DevTools on the profile page (see the script's own header comment).

## Local dev

The API itself (`api/kaggle-badges.js`) has zero external dependencies — just
Node's built-in `fetch`. `scripts/heartbeat.mjs` is the only thing that needs
`playwright` (for the headless browser), installed via `npm install`.

```
npm run render:test   # renders data/badges.json -> out.svg, no Vercel needed
npm run heartbeat     # one manual check-and-update run
vercel dev            # full local API server at /api/kaggle-badges
```

## Deploy

```
vercel --prod
```

Or connect the repo in the Vercel dashboard for auto-deploy on every push.
