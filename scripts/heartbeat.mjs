// Scheduled check: launches a fresh, cookie-less headless browser (no stored
// session, no credentials at all) against the PUBLIC profile URL, extracts
// the current badge grid, and if it differs from data/badges.json, updates
// the manifest and pushes. Meant to run unattended via a scheduled task.
//
// Kaggle's profile page is a client-hydrated SPA, so a raw HTTP fetch (curl,
// fetch()) only ever sees an empty shell regardless of auth — but a real
// anonymous browser (same as any logged-out visitor) still hydrates the
// badge grid via Kaggle's own anonymous-session flow. Verified directly:
// a brand-new Playwright context with zero cookies, on the public profile
// URL, sees the badges. No login step needed.
//
// Run with: npm run heartbeat
import { chromium } from "playwright";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATA_PATH = path.join(ROOT, "data", "badges.json");
const LOG_PATH = path.join(ROOT, "heartbeat.log");
const USERNAME = process.env.KAGGLE_README_USERNAME || "smirkxd";

function log(line) {
  const stamped = `${new Date().toISOString()} ${line}`;
  console.log(stamped);
  appendFileSync(LOG_PATH, stamped + "\n");
}

function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/&/g, "and");
}

function run(cmd, args) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: "utf-8" }).trim();
}

const browser = await chromium.launch({ headless: true });
let badges = [];
try {
  const context = await browser.newContext(); // fresh, no cookies/storage
  const page = await context.newPage();
  await page.goto(`https://www.kaggle.com/${USERNAME}`, {
    waitUntil: "networkidle",
    timeout: 30000,
  });

  badges = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img")).filter((i) =>
      i.src.includes("googleapis.com/download/storage")
    );
    return imgs.map((img) => {
      let el = img.parentElement,
        btn = null;
      for (let i = 0; i < 5 && el; i++) {
        if (el.tagName === "BUTTON") {
          btn = el;
          break;
        }
        el = el.parentElement;
      }
      const label = btn ? btn.getAttribute("aria-label") : "";
      const name = label ? label.replace(/\s*Badge\s*$/, "").trim() : "";
      return { name, iconUrl: img.src };
    });
  });
} catch (err) {
  log(`ERROR: page load/extraction failed — ${err.message}. Leaving data/badges.json untouched.`);
  await browser.close();
  process.exit(1);
} finally {
  await browser.close();
}

if (badges.length === 0) {
  log("WARN: extraction found 0 badges — likely a blocked/incomplete load, not a real change. Leaving data/badges.json untouched.");
  process.exit(1);
}

const current = JSON.parse(readFileSync(DATA_PATH, "utf-8"));

// A drop of more than a couple badges almost certainly means a partial page
// load, not badges actually being un-earned (Kaggle doesn't revoke badges) —
// don't let a flaky run erase a manifest that took a real page load to build.
if (badges.length < current.badges.length - 2) {
  log(
    `WARN: extracted ${badges.length} badges vs. ${current.badges.length} on file — looks like a partial load, not a real change. Leaving data/badges.json untouched.`
  );
  process.exit(1);
}

const next = badges
  .map((b) => ({ ...b, slug: slugify(b.name) }))
  .sort((a, b) => a.name.localeCompare(b.name));
const nextSorted = {
  username: USERNAME,
  updated: new Date().toISOString().slice(0, 10),
  badges: next,
};

const currentNames = JSON.stringify(
  [...current.badges].sort((a, b) => a.name.localeCompare(b.name)).map((b) => b.name)
);
const nextNames = JSON.stringify(next.map((b) => b.name));

if (currentNames === nextNames) {
  log(`No change — still ${badges.length} badges.`);
  process.exit(0);
}

const added = next.filter((b) => !current.badges.some((c) => c.name === b.name)).map((b) => b.name);
const removed = current.badges.filter((c) => !next.some((b) => b.name === c.name)).map((c) => c.name);

writeFileSync(DATA_PATH, JSON.stringify(nextSorted, null, 2) + "\n", "utf-8");
log(`Badge set changed. Added: [${added.join(", ") || "none"}]. Removed: [${removed.join(", ") || "none"}].`);

try {
  run("git", ["add", "data/badges.json"]);
  run("git", [
    "commit",
    "-m",
    `Heartbeat: badge set changed (+${added.length}/-${removed.length})\n\nAdded: ${added.join(", ") || "none"}\nRemoved: ${removed.join(", ") || "none"}`,
  ]);
  run("git", ["pull", "--rebase", "origin", "main"]);
  run("git", ["push", "origin", "main"]);
  log("Committed and pushed.");
} catch (err) {
  log(`ERROR: git step failed — ${err.message}. data/badges.json was updated locally but NOT pushed; check and push manually.`);
  process.exit(1);
}
