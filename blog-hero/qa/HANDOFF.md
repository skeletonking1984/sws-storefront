# QA HANDOFF, SWS QA (Grok Bot)

**Date:** 2026-09-22
**From:** `sws-weekly-blog-article` run, 2026-09-22
**Supersedes:** the 2026-09-15 handoff for the 43-hero set. That set's verdict stands; this is one new card plus two article bodies.

## What is in this folder

| File | What it is |
|---|---|
| `what-is-multistreaming-and-what-a-multistream-widget-actually-does.jpg` | The new hero, 1600x840 sRGB, exactly the bytes published to Shopify |
| `DESIGN-QA.md` | Design gate result for that hero, run 2026-09-22 |
| `VERDICT.md` | Stale, from the 2026-09-15 set. Superseded by this handoff. |

Masters and the rest of the set: `../out/`, `../upload/`.

## What shipped this run

Two articles on the multistream cluster, on the live headless storefront blog.

1. **Rewritten in place**, same URL, `/blogs/news/best-multistream-chat-widget-for-twitch-youtube-kick-2026-guide`. Kept its existing 2026-09-15 hero. It was a single-product advertorial under a roundup title; it is now an actual roundup that recommends a free competitor over our own product where that is the honest answer.
2. **New**, `/blogs/news/what-is-multistreaming-and-what-a-multistream-widget-actually-does`, with the hero in this folder.

## What to check, in priority order

1. **The hero, at card size in the blog index, not just at 100%.** It is the only new graphic. Design gate already run, `DESIGN-QA.md`, score 27/30.
2. **One open blocker, and it is not this card's fault.** B2 palette FAILS: 7 of 9 chrome colours are outside deltaE 3.0 of `brand.tokens.json`. Those values live in `hero.html` and `themes.json`, so all 44 heroes carry them, including the 43 live since 2026-09-15. Worst offenders are the headline gradient stops (deltaE 12.2 to 23.4) and field base3 (19.1). Full table in `DESIGN-QA.md`. Repainting only this card would break set consistency, so it shipped matching the set. **The decision, palette exception or re-render the set, is Todd's and is raised to him.**
3. **Copy claims in both article bodies.** Drafts on disk at `content/blog/drafts/multistream-roundup-2026-09-22.html` and `multistream-explainer-2026-09-22.html`. Specifically worth your eye:
   - Neither article claims TikTok support flatly. Both label it unofficial and best effort, including for our own product. If you find a flat claim anywhere, that is a fail.
   - The Kick chatroom ID instruction is taken from our own working source, `repos/sws-widget-stage/public/sources/kick-chat.js:8-10`, not from a web guess. It replaces the old "Add your Kick username" line that cost a customer a full day on 2026-09-17.
   - Twitch's combined-chat rule is stated as unsettled with "as of writing", per `content/blog/multistream-research-2026-09-17.md`. It is deliberately not stated as settled in either direction.
   - No em dashes, no en dashes, checked by grep. No named game, franchise or character.
   - Product links: two in the roundup, one in the explainer, all verified live against the Storefront API today. No Etsy links.
4. **Prices in the copy against the live store.** Roundup names no price. Explainer names $29.99 for the Multistream Chat Widget Pack, which matched the Storefront API at publish time.

## Soft spots, stated plainly

- The art's chat lines all carry a Twitch badge even though one line reads "kick chat showing up too". It is a decorative capture of a real widget in its default demo state, same as the other 43 heroes, but if that reads as a claim rather than decoration, say so and it gets re-rendered.
- The kicker's letterspaced caps soften on the 2400 to 1600 downscale. Measured contrast still passes at 5.59:1 against the pill interior, but it is the thinnest type on the card.
- The hero was not checked cropped to a 1:1 social crop. Nothing in this pipeline emits one.

## Blocking or not

Not blocking publication: both articles are live and the mandate is explicit ("they need to drive traffic, figure it out", Todd 2026-09-15). This handoff is the review pass behind them. If you fail the hero, it is one row in `map.json` and three commands to re-render, and the article keeps its URL.

Created by: Claude claude-opus-5 2026-09-22
Last edited by: Claude claude-opus-5 2026-09-22 · Handoff for new multistream hero and two article bodies
