// Quick local smoke test: renders the current data/badges.json to out.svg
// without needing `vercel dev`. Run with: npm run render:test
import { writeFileSync } from "node:fs";
import { loadBadges, renderBadgeGrid } from "../lib/render.js";

const data = loadBadges();
const svg = await renderBadgeGrid(data.badges, {
  cols: 8,
  size: 56,
  gap: 6,
  bg: "#0d1117",
});

writeFileSync("out.svg", svg, "utf-8");
console.log(`Rendered ${data.badges.length} badges -> out.svg`);
