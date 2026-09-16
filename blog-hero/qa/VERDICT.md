# Blog hero Art QA — VERDICT

**Date:** 2026-09-15 (ET)  
**Officer:** SWS QA (Grok)  
**Scope:** Local composites only — no Shopify upload yet.

## Overall: PASS WITH FIXES

Prior harness faults (tip spam, wrong kind, past-full goal, mid-word right-edge clip) are **cleared** in these two frames. One product-claim polish remains before upload.

---

### `qa/vtuber-celestial.png` (2400×1260) — sticker `celestial-multistream-chat`

| Bar | Result |
|-----|--------|
| No mid-word clip at canvas edge | **PASS** — chat lines and tip copy fully readable; intentional bottom bleed only (sticker `y+h` past 630). |
| Glow as light, not slab | **PASS** |
| Copy vs product claims | **FIX** — bubble says “every platform in one box” but every visible platform mark is Twitch. Multistream Chat should show ≥2 platforms. |
| Legibility at article size (~720w) | **PASS** — headline holds; chat still readable. |
| Typos | **PASS** |
| Make it pop | **PASS** — high contrast, celestial neon. |
| Not-obvious-AI | **PASS** — VTuber avatars OK at blog distance; no glow mush / melted edges. |

Tip spam (`fan90…fan720` / all `$90`) is gone. Calm feed: 5 chat + 1 tip (`Jordan` / tipped). Good.

**Ordered fix:**
1. Recompose Multistream feed so platform icons mix (Twitch + YouTube / TikTok / Kick / etc.). Keep the same calm density.

---

### `qa/goal-widgets.png` (2400×1260) — sticker `moon-jar-goal`

| Bar | Result |
|-----|--------|
| No mid-word clip | **PASS** |
| Glow as light, not slab | **PASS** |
| Copy vs product claims | **PASS** — jar fill @ **31%**, label **MOON GOAL**, donor tag **CometTip**. Not past-full; not chat-kind. Headline “goal bar” is category metaphor for Goal widgets — OK. |
| Legibility at article size | **PASS** |
| Typos | **PASS** |
| Make it pop | **PASS** |
| Not-obvious-AI | **PASS** — frogs read as intentional kawaii stamps, not mush. |

---

## Ship gate

- **Do not upload to Shopify** until Multistream platform-icon mix is fixed and re-checked.
- After upload: live CDN byte check (Shopify re-encodes). Local hash alone is not enough.

## Files checked

- `blog-hero/qa/vtuber-celestial.png`
- `blog-hero/qa/goal-widgets.png`
- `blog-hero/qa/HANDOFF.md`
- Stickers: `blog-hero/widgets/celestial-multistream-chat.png`, `moon-jar-goal.png`
