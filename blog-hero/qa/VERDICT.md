# Blog content audit — VERDICT (re-gate)

**Date:** 2026-09-23 (ET)
**Officer:** SWS QA (Grok)
**Scope:** Re-gate because `HANDOFF.md` (14:26 ET) is newer than prior `VERDICT.md` (14:20 ET). Content/SEO audit handoff — **no new art**. Frames in folder re-inspected for continuity only.

## Overall: PASS WITH FIXES

**Deciding reason:** HANDOFF mtime bump was New Bot’s residuals queue (`FIXES-FOR-CLAUDE.md` + `fix-residuals-1-3.mjs` + HANDOFF appendix), **not** a “Residuals 1–3 fixed” claim. Live rendered HTML still has the same residuals the 14:20 verdict flagged. Big audit wins still hold (wrong $35/$65 gone; `shop.` product links cleared; explainer $29.99 correct). Art gate N/A this run.

HANDOFF appendix itself says: re-gate only after Claude appends “Residuals 1–3 fixed” with live greps clean. That note is **absent**. This re-gate confirms residuals still open so Todd/Builder are not misled by the newer HANDOFF alone.

---

### Art / design gate (folder frames — no new drop)

| File | Result |
|------|--------|
| New artwork this handoff | **N/A** — none produced; `DESIGN-QA.md` is the 2026-09-22 hero run, unchanged |
| `goal-widgets.png` | **PASS** (continuity) — moon-jar **31%** / **CometTip** tag; headline + subcopy readable; no AI letter mush |
| `vtuber-celestial.png` | **HOLD** (unchanged) — chat claim “every platform in one box” still sits on an all-Twitch icon stack. Mix platforms before Shopify listing use |
| `what-is-multistreaming-and-what-a-multistream-widget-actually-does.jpg` | **PASS WITH FIXES** (2026-09-22 stands) — real composited type; widget capture OK; platform-icon mix still weak (mostly Twitch; Kick only in one dual-icon row + chat text). Template palette B2 fail remains Todd brand decision |
| Explainer URL | **Live** — `/blogs/news/what-is-multistreaming-and-what-a-multistream-widget-actually-does` → 200; title ≤60 |

---

### Live content checks (rendered `article-body`, 2026-09-23 ~14:46 ET)

| Check | Result |
|-------|--------|
| Stale commission **$35 / $65** | **PASS** — absent on how-to-make + 5-custom; both say “Custom widget commissions are quoted per project.” No **$300** in body (Todd hold) |
| Body product links on `shop.streamwidgetshop.com` | **PASS** — 0 in checked bodies |
| Explainer price vs store | **PASS** — Multistream Chat Widget Pack **$29.99** in prose |
| Em / en dashes | **FIX** — `hire-a-custom-stream-widget-developer-for-kick-twitch` still has U+2014: “immersion — all critical…” |
| Etsy + `utm_source=chatgpt.com` | **FIX** — still live on `best-twitch-and-kick-…` (listing 4333471272) and `best-cyberpunk-…` (listing 1904169495) |
| Bare Etsy shop URL | **FIX** — `where-to-watch-the-fifa-world-cup-2026-…` body still links `https://streamwidgetshop.etsy.com` |
| Third-party IP prose | **FIX** — `best-cyberpunk-…` still: “Games like Cyberpunk 2077 helped popularize…” |
| FIFA / NBA titles + handles | **HOLD (Todd)** — untouched by design; DENY-list terms remain in title/URL |
| Deploy freshness | **Note** — `/api/version` → `ff0ffe4` / builtAt 2026-09-23T17:13:51Z. Stamp may still lag blog SEO reality per handoff |

Checked live: best-twitch-kick, best-cyberpunk, fifa-watch, hire, how-to-make (`…-in-2026-or-let-professionals-build-them-for-you`), 5-custom-obs, explainer, nba-playoff. Version endpoint hit.

---

## Ordered fixes

1. **Builder — residual Etsy / chatgpt utm:** Run `fix-residuals-1-3.mjs` (or same replacements) on articles `566684483774`, `566463365310`, `566799499454`. Live-verify zero `etsy.com/listing`, `utm_source=chatgpt`, and FIFA-body `streamwidgetshop.etsy.com`.
2. **Builder — em dash:** `566184247486` hire post — replace “immersion — all critical…” → comma form; re-grep U+2013/U+2014 on touched bodies.
3. **Builder — IP prose:** Same cyberpunk article — drop/genre-rewrite “Cyberpunk 2077” (script maps to “neon-noir and cyberpunk games”).
4. **Todd — commission positioning:** Wrong prices cleared. State **$300 flat** or keep “quoted per project.”
5. **Todd — FIFA / NBA titles + handles:** Retitle, unpublish, or explicitly accept nominative editorial.
6. **Todd — Search Console export:** Still missing under `content/blog/`; blocks CTR rules.
7. **Ops:** Regenerate `app/data/build-info.json` on deploy so `/api/version` matches live.

After 1–3: append dated “Residuals 1–3 fixed” + live greps to `HANDOFF.md` (or touch this folder) so disk watch re-gates for a clean PASS path.

## Ship gate

- Content audit: **PASS WITH FIXES** — leave live; do **not** claim Etsy/utm/dashes/Cyberpunk-2077 cleared until 1–3 re-verified on rendered HTML.
- Art / Shopify Active: **unchanged** — no new art; Vtuber celestial platform-mix hold still blocks listing-style use of that hero as multistream proof.
- Product drafts (Slow Pour etc.): **out of scope** this handoff.

## Files / URLs cited

- `blog-hero/qa/HANDOFF.md` (2026-09-23 14:26 ET)
- `blog-hero/qa/FIXES-FOR-CLAUDE.md` (2026-09-23 14:26 ET)
- `blog-hero/qa/fix-residuals-1-3.mjs`
- `blog-hero/qa/DESIGN-QA.md` (2026-09-22; not re-scored)
- Frames: `goal-widgets.png`, `vtuber-celestial.png`, `what-is-multistreaming-and-what-a-multistream-widget-actually-does.jpg`
- Live articles listed above + `https://streamwidgetshop.com/api/version` → `ff0ffe4`
