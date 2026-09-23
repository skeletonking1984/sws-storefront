# Blog hero Art QA — VERDICT

**Date:** 2026-09-22 (ET)
**Officer:** SWS QA (Grok)
**Scope:** New multistream explainer hero + two article bodies from HANDOFF 2026-09-22. Supersedes the 2026-09-15 VERDICT for this folder’s open handoff (that set’s prior notes still describe `vtuber-celestial.png` / `goal-widgets.png`).

## Overall: PASS WITH FIXES

Hero art clears the Art QA bar at blog / card distance: real composited type, readable kicker + headline, no AI letterforms, no glow mush / melted edges on a pause-frame. Design gate score 27/30 accepted as supporting evidence. Not a publish blocker for the scheduled explainer.

---

### `qa/what-is-multistreaming-and-what-a-multistream-widget-actually-does.jpg` (1600×840 sRGB) — sticker `celestial-multistream-chat`

| Bar | Result |
|-----|--------|
| Legibility at card / article size | **PASS** — headline thesis holds; chat lines readable; kicker `MULTISTREAMING` holds (thin letters, still readable). |
| Composited real type (no AI-slop text) | **PASS** — Space Grotesk / Baloo 2 template type; tip chrome reads `Now tipped $25!` cleanly. |
| Not-obvious-AI | **PASS** — live Widget Stage capture look; anime avatars OK at blog distance; no particle/edge mush. |
| Copy vs product claims (in-frame) | **FIX** — chat line says “kick chat showing up too” but every visible platform mark is Twitch. Same soft spot as the 2026-09-15 Multistream hold: if it reads as a claim, mix ≥2 platform icons before the scheduled go-live. |
| Production (size / sRGB / containment) | **PASS** — 1600×840 JPEG sRGB, matches live hero set. |
| Brand chrome palette (B2) | **FIX (template-wide, Todd decision)** — DESIGN-QA: 7/9 chrome colours outside deltaE 3.0 of `brand.tokens.json`. Values live in `hero.html` / `themes.json`, so all 44 heroes share it. Do not repaint this card alone. |

---

### Article bodies (disk drafts)

| Check | Result |
|-------|--------|
| TikTok not claimed flatly | **PASS** — both label unofficial / reverse-engineered / no public API, including for our product. |
| Kick chatroom ID instruction | **PASS** — channel name + chatroom ID; Cloudflare/session note; aligns with handoff source claim. |
| Twitch combined-chat rule | **PASS** — roundup states unsettled / gray area / “as of writing”; not settled either way. |
| Em / en dashes | **PASS** — none in either draft. |
| Prices vs live store | **PASS** — explainer `$29.99` matches live product `.js` (2999 cents) for Multistream Chat Widget Pack. Roundup names no price. |
| Product links | **PASS** — shop.streamwidgetshop.com product URLs; no Etsy in drafts. |
| “Both articles live” (handoff claim) | **FIX** — PIPELINE.md: roundup rewritten live; explainer Shopify `568609341630` is **scheduled 2026-09-25 16:00 UTC** (`isPublished: false`). Live URL 404 today. Handoff overstated go-live. |

Prior frames still in folder (`vtuber-celestial.png`, `goal-widgets.png`) were not re-gated this run; 2026-09-15 notes stand for those files.

---

## Ordered fixes

1. **Before explainer publish (2026-09-25):** recompose Multistream feed so platform icons mix (Twitch + YouTube / Kick / etc.) while keeping calm density — or accept as decorative and leave, but then do not treat the Kick chat line as product proof.
2. **Todd brand decision:** hero template palette = deliberate chrome exception (encode in `brand.rules.json`) **or** re-render the full 44-hero set to tokens. One-card repaint = FAIL for set consistency.
3. **Comms accuracy:** treat explainer as scheduled, not live, until the 2026-09-25 confirm pass (PIPELINE already queues that).

## Ship gate

- Roundup rewrite: already live — no art hold from this pass.
- Explainer: **OK to keep scheduled** under PASS WITH FIXES; prefer fix #1 before or at go-live if Kick-in-frame must read as multistream proof.
- After any hero re-upload: live CDN byte check (Shopify re-encodes). Local hash alone is not enough.

## Files checked

- `blog-hero/qa/HANDOFF.md` (2026-09-22)
- `blog-hero/qa/DESIGN-QA.md`
- `blog-hero/qa/what-is-multistreaming-and-what-a-multistream-widget-actually-does.jpg`
- `content/blog/drafts/multistream-roundup-2026-09-22.html`
- `content/blog/drafts/multistream-explainer-2026-09-22.html`
- `content/blog/PIPELINE.md` (publish status)
- Live product price: `https://shop.streamwidgetshop.com/products/multistream-chat-widget-pack.js` → 2999 cents
