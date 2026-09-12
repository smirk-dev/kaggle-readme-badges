import { loadBadges, renderBadgeGrid } from "../lib/render.js";

export default async function handler(req, res) {
  try {
    const data = loadBadges();
    const q = req.query ?? {};

    const cols = q.cols ? parseInt(q.cols, 10) : 8;
    const size = q.size ? parseInt(q.size, 10) : 56;
    const gap = q.gap ? parseInt(q.gap, 10) : 6;
    const bg = q.bg ?? "#0d1117";
    const showTitle = q.title === "1" || q.title === "true";

    const svg = await renderBadgeGrid(data.badges, {
      cols: Number.isFinite(cols) ? cols : 8,
      size: Number.isFinite(size) ? size : 56,
      gap: Number.isFinite(gap) ? gap : 6,
      bg,
      showTitle,
      title: q.titleText ?? `${data.username}'s Kaggle Badges`,
    });

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
    );
    res.status(200).send(svg);
  } catch (err) {
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.status(500).send(
      `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="60"><rect width="100%" height="100%" fill="#0d1117"/><text x="12" y="35" fill="#f85149" font-family="monospace" font-size="13">kaggle-readme-badges error: ${String(
        err.message || err
      ).slice(0, 60)}</text></svg>`
    );
  }
}
