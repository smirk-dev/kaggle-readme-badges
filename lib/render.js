import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "data", "badges.json");

// Kaggle badge SVGs are self-contained (viewBox 0 0 56 56) but each defines
// its own local ids (mask0_XXXX_YYYY, clip0_XXXX_YYYY). Concatenating several
// into one document without namespacing them makes later badges' masks/clips
// silently apply to earlier ones. Every id and every url(#id)/href="#id"
// reference gets a per-badge prefix before the icon is placed in the grid.
function namespaceIds(svgInner, prefix) {
  const ids = new Set();
  const idRe = /\bid="([^"]+)"/g;
  let m;
  while ((m = idRe.exec(svgInner))) ids.add(m[1]);

  let out = svgInner;
  for (const id of ids) {
    const safe = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`id="${safe}"`, "g"), `id="${prefix}${id}"`);
    out = out.replace(new RegExp(`url\\(#${safe}\\)`, "g"), `url(#${prefix}${id})`);
    out = out.replace(new RegExp(`href="#${safe}"`, "g"), `href="#${prefix}${id}"`);
  }
  return out;
}

function extractInner(svgText) {
  const match = svgText.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  return match ? match[1].trim() : svgText;
}

// Kaggle's badge paths carry ~13 significant digits per coordinate, far past
// what's visible at a 56px display size. Rounding to 2 decimals cuts the
// composed card from ~320KB to ~245KB with no visible difference, keeping it
// under the 250KB-per-image budget set for this repo's other assets.
function roundPathPrecision(svg) {
  return svg.replace(/d="([^"]+)"/g, (_, d) =>
    `d="${d.replace(/-?\d+\.\d+/g, (n) => {
      const r = Math.round(parseFloat(n) * 100) / 100;
      return String(r);
    })}"`
  );
}

function minifyWhitespace(svg) {
  return svg.replace(/>\s+</g, "><").trim();
}

const iconCache = new Map();

async function fetchIcon(url) {
  if (iconCache.has(url)) return iconCache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`icon fetch failed (${res.status}): ${url}`);
  const text = await res.text();
  iconCache.set(url, text);
  return text;
}

export function loadBadges() {
  const raw = readFileSync(DATA_PATH, "utf-8");
  return JSON.parse(raw);
}

function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  }[c]));
}

/**
 * Render a grid of Kaggle badge icons as a single self-contained SVG.
 * @param {{name:string, iconUrl:string}[]} badges
 * @param {{cols?:number, size?:number, gap?:number, bg?:string, showTitle?:boolean, title?:string}} opts
 */
export async function renderBadgeGrid(badges, opts = {}) {
  const cols = Math.max(1, opts.cols ?? 8);
  const size = Math.max(24, opts.size ?? 56);
  const gap = Math.max(0, opts.gap ?? 6);
  const bg = opts.bg ?? "#0d1117";
  const showTitle = !!opts.showTitle;
  const headingH = showTitle ? 34 : 0;
  const pad = 12;

  const rows = Math.ceil(badges.length / cols);
  const cellW = size + gap;
  const cellH = size + gap;
  const width = pad * 2 + cols * cellW - gap;
  const height = pad * 2 + headingH + rows * cellH - gap;

  const results = await Promise.allSettled(
    badges.map((b) => fetchIcon(b.iconUrl))
  );

  const groups = badges.map((b, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = pad + col * cellW;
    const y = pad + headingH + row * cellH;
    const result = results[i];

    if (result.status !== "fulfilled") {
      return `<g transform="translate(${x},${y})"><title>${escapeXml(b.name)} (failed to load)</title><rect width="${size}" height="${size}" rx="8" fill="#30363d"/></g>`;
    }

    const inner = namespaceIds(extractInner(result.value), `b${i}_`);
    return `<g transform="translate(${x},${y})"><title>${escapeXml(b.name)}</title><svg width="${size}" height="${size}" viewBox="0 0 56 56">${inner}</svg></g>`;
  });

  const heading = showTitle
    ? `<text x="${width / 2}" y="${pad + 20}" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="18" font-weight="600" fill="#c9d1d9">${escapeXml(opts.title ?? "Kaggle Badges")}</text>`
    : "";

  const bgRect = bg === "none" ? "" : `<rect width="100%" height="100%" fill="${bg}"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
<rect width="${width}" height="${height}" rx="12" fill="transparent"/>
${bgRect}
${heading}
${groups.join("\n")}
</svg>`;

  return minifyWhitespace(roundPathPrecision(svg));
}
