# kaggle-readme-badges

A tiny serverless SVG card that renders your earned Kaggle badges as a single
image, in the same packed-hexagon-grid style as Kaggle's own profile "Badges"
section — embeddable in a GitHub README the same way
[github-readme-stats](https://github.com/anuraghazra/github-readme-stats) or
[streak-stats](https://github.com/DenverCoder1/github-readme-streak-stats) are.

Why this exists instead of a hand-downloaded screenshot: a static PNG goes
stale the moment you earn a new badge, and re-cropping a screenshot every time
is annoying. This regenerates the card from a small JSON manifest on every
request (cached), so updating `data/badges.json` and pushing is the whole
update flow.

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

Kaggle doesn't expose badges through its public API, and a plain
unauthenticated HTTP request to a profile page returns an empty shell — the
badge grid only renders after the page hydrates with an authenticated (or
real anonymous-session) client. Rather than storing a live Kaggle session
somewhere to re-scrape that on a schedule, this repo just keeps a manifest
(`data/badges.json`) that you refresh manually, in about 30 seconds, whenever
you earn a new badge:

1. Open `https://www.kaggle.com/<username>` (About tab) while logged in.
2. Open DevTools Console, paste the contents of
   `scripts/refresh-badges.console.js`, hit Enter.
3. It downloads `kaggle-badges-manifest.json` with every badge's name and its
   public icon URL. Drop that array into `data/badges.json`'s `"badges"`
   field (update `"updated"` too).
4. Commit + push — Vercel redeploys automatically.

The per-badge icon URLs themselves (`googleapis.com/download/storage/...`)
*are* public, unauthenticated GCS objects once you know them — it's only the
name → URL mapping that requires an authenticated page load to discover.

## Local dev

No external dependencies — just Node's built-in `fetch`.

```
npm run render:test   # renders data/badges.json -> out.svg, no Vercel needed
vercel dev            # full local API server at /api/kaggle-badges
```

## Deploy

```
vercel --prod
```

Or connect the repo in the Vercel dashboard for auto-deploy on every push.
