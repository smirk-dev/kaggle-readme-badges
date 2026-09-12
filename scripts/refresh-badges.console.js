// Refresh procedure (manual, no stored credentials required):
//
// 1. Log into kaggle.com as the account you want badges for.
// 2. Open https://www.kaggle.com/<username> (the "About" tab, where the
//    Badges grid renders).
// 3. Open DevTools > Console and paste this whole file, then press Enter.
// 4. It downloads `kaggle-badges-manifest.json` — replace the "badges" array
//    in data/badges.json with its contents (keep username/updated in sync),
//    or run scripts/merge-manifest.js if you added one later.
// 5. Commit + push. Vercel redeploys automatically and the embedded SVG
//    picks up the new badge set on next render.
//
// Why this instead of an automated scraper: Kaggle's badge data is only
// present in the authenticated, client-hydrated page (a plain unauthenticated
// HTTP GET to the profile URL returns an empty shell — verified 2026-09-12).
// Automating that would mean storing a live Kaggle session/cookie somewhere
// (CI secret, etc.) just to re-scrape an internal, undocumented endpoint.
// Badges are earned a handful of times a year, so a 30-second manual paste
// beats maintaining that.

(function () {
  const imgs = Array.from(document.querySelectorAll("img")).filter((i) =>
    i.src.includes("googleapis.com/download/storage")
  );
  if (imgs.length === 0) {
    console.error(
      "No badge icons found — make sure you're on kaggle.com/<username> (About tab) and are logged in."
    );
    return;
  }

  const badges = imgs.map((img) => {
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
    return {
      name,
      iconUrl: img.src,
      slug: name.toLowerCase().replace(/\s+/g, "-").replace(/&/g, "and"),
    };
  });

  const blob = new Blob([JSON.stringify(badges, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "kaggle-badges-manifest.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  console.log(`Downloaded ${badges.length} badges.`);
})();
