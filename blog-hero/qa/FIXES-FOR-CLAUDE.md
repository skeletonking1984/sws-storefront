# Blog content audit — FIXES FOR CLAUDE (residuals)

From: SWS QA **PASS WITH FIXES** (2026-09-23 ~14:20 ET)  
Owner of this list: **New Bot** (Claude executes Admin `articleUpdate`)  
Cite: `repos/sws-storefront/blog-hero/qa/VERDICT.md`

Your 2026-09-23 `HANDOFF.md` claimed Etsy / chatgpt-utm / dashes / Cyberpunk 2077 were cleared.
**Live HTML still fails** (re-checked 2026-09-23 afternoon ET on rendered `streamwidgetshop.com` pages). Do fixes **1–3** below, verify on **rendered** HTML (not Admin alone), then append a short “Residuals 1–3 fixed” note to `HANDOFF.md` (or touch this folder) so SWS QA disk watch re-gates.

**Do not touch** Todd items 4–6 (commission $300, FIFA/NBA titles, Search Console) or Ops item 7 (`build-info.json`).

Runner: `fix-residuals-1-3.mjs` in this folder (needs whatever Admin auth you used for today’s `articleUpdate`). Prefer the script; same replacements if you push another way.

Theme footer “Visit our Etsy Store” is **out of scope** (site nav). Only article **body** residuals.

---

## 1. Strip residual Etsy listing + `utm_source=chatgpt.com` (+ FIFA shop URL)

### A. `best-twitch-and-kick-chat-widgets-and-stream-overlays-for-obs-in-2026`
- Article id: `566684483774` → `gid://shopify/Article/566684483774`
- Replace href **exactly**:
  - FROM: `https://streamwidgetshop.etsy.com/listing/4333471272/neon-stream-chat-and-goal-widgets?utm_source=chatgpt.com`
  - TO: `https://streamwidgetshop.com/products/neon-aesthetic-glowy-transparent-chat-and-goal-stream-widgets-minimal-neon-light-elegant-glow-theme-clean-vibe-streamelement-only`

### B. `best-cyberpunk-twitch-overlays-and-chat-widgets-for-futuristic-stream-setups`
- Article id: `566463365310` → `gid://shopify/Article/566463365310`
- Replace href **exactly**:
  - FROM: `https://streamwidgetshop.etsy.com/listing/1904169495?utm_source=chatgpt.com`
  - TO: `https://streamwidgetshop.com/products/neon-aesthetic-glowy-transparent-chat-and-goal-stream-widgets-minimal-neon-light-elegant-glow-theme-clean-vibe-streamelement-only`
- Note: etsy→shopify map handle for listing `1904169495` (`valorant-waylay-…`) is **404** on the storefront. Do **not** use it. Neon aesthetic product (listing `4333471272` twin) is the live destination.
- Optional: soften anchor text to match the destination product title.

### C. `where-to-watch-the-fifa-world-cup-2026-as-a-streamer-and-how-to-create-content-around-it`
- Article id: `566799499454` → `gid://shopify/Article/566799499454`
- Body still has bare shop URL:
  - FROM: `https://streamwidgetshop.etsy.com`
  - TO: `https://streamwidgetshop.com`
  - (or delete the paragraph if it only exists to push Etsy)

**Live verify:** zero matches in each article’s body HTML for `etsy.com/listing`, `utm_source=chatgpt`, and (FIFA body) `streamwidgetshop.etsy.com`.

---

## 2. Em dash in hire post

- Handle: `hire-a-custom-stream-widget-developer-for-kick-twitch`
- Article id: `566184247486` → `gid://shopify/Article/566184247486`
- Live sentence still has U+2014:
  - FROM: `immersion — all critical for keeping viewers watching longer.`
  - TO: `immersion, all critical for keeping viewers watching longer.`
- Re-grep all four bodies for U+2013 and U+2014 before calling done.

---

## 3. Drop / genre-rewrite “Cyberpunk 2077”

- Same cyberpunk article as 1B (`566463365310`)
- Live body still contains `Cyberpunk 2077`.
- Replace proper noun with genre wording, e.g. `neon-noir and cyberpunk games` (or rewrite the clause to “Games in the cyberpunk genre helped popularize…”).
- Do **not** retitle the article or change the URL.

---

## Done criteria

1. Bodies updated for the four article ids above.
2. Admin body check **and** rendered live HTML greps clean.
3. Append dated “Residuals 1–3 fixed” to `HANDOFF.md` (or touch `blog-hero/qa/`) so SWS QA re-gates.
4. No new art; no Todd/Ops items.
