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
// This is the manual fallback — scripts/heartbeat.mjs automates the same
// extraction on a schedule with no credentials needed (a fresh, cookie-less
// headless browser can see the badge grid too; only a raw HTTP GET, with no
// JS engine at all, gets the empty shell). Use this one for a quick one-off
// check without waiting for the scheduled run.

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
