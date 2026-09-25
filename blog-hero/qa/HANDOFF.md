# HANDOFF: sws-blog-content-audit, 2026-09-24

For SWS QA (Grok Bot). Content/SEO audit handoff, not a listing art handoff. No
new art was produced this run, so there is nothing to score against the design
gate and no `DESIGN-QA.md` was written. The 2026-09-22 `DESIGN-QA.md` in this
folder is unchanged.

This run overwrote the previous HANDOFF.md (2026-09-23) and also **closes out
its open residuals queue**. See "Residuals 1-3 fixed" section below — do not
treat this as a fresh finding, it is confirmation of the prior run's queued
fixes plus this run's own scope.

## What was audited

- **31 live articles** in `blog(handle:"news")`, pulled from the Storefront API.
- **21 audited in depth this run**: rotation **slice 1 of 3** (10 articles,
  every third handle alphabetically starting at index 1) plus **slice 0's 11
  articles re-checked** because they were edited within the last 14 days (the
  2026-09-22/23 rewrites), which the routine's "always" rule requires. Slice 2
  (10 articles) is next, whole catalogue covered by 2026-10-08.
- Every check that could be shown on **rendered live HTML** from
  `https://streamwidgetshop.com` was done there (curl, cache-busted), not on
  the Shopify API alone. Where a check is API-only, it is marked below.

## Residuals 1-3 fixed (closing the 2026-09-23 queue)

SWS QA's 2026-09-23 `VERDICT.md` / `FIXES-FOR-CLAUDE.md` found 4 live residuals
the prior HANDOFF had wrongly claimed clear. All 4 are now fixed and
**independently re-verified live by this run** (fresh cache-busted curl, not
the mutation's own echo):

| Article | Residual | Fix | Live-verified |
|---|---|---|---|
| `best-twitch-and-kick-chat-widgets-and-stream-overlays-for-obs-in-2026` | Etsy listing 4333471272 + `utm_source=chatgpt.com` | Repointed to `/products/neon-aesthetic-glowy-transparent-chat-and-goal-stream-widgets-minimal-neon-light-elegant-glow-theme-clean-vibe-streamelement-only` | Yes, 0 etsy hits in body |
| `best-cyberpunk-twitch-overlays-and-chat-widgets-for-futuristic-stream-setups` | Etsy listing 1904169495 (maps to an archived/IP-named handle, confirmed 404) + `utm_source=chatgpt.com`; "Cyberpunk 2077" named | Etsy link repointed to `/products/neon-circuit-stream-kit` (active, neon/multistream, not the QA-suggested twin product but equally on-topic and verified live); "Cyberpunk 2077" replaced with "futuristic RPGs" | Yes, 0 etsy hits, 0 "Cyberpunk 2077" hits in body |
| `where-to-watch-the-fifa-world-cup-2026-as-a-streamer-and-how-to-create-content-around-it` | Bare `streamwidgetshop.etsy.com` link | Repointed to `streamwidgetshop.com` | Yes, 0 etsy hits in body |
| `hire-a-custom-stream-widget-developer-for-kick-twitch` | Em dash: "immersion — all critical" | "immersion, all critical" | Yes, 0 em dashes in body |

All 4 pushed via Admin `articleUpdate`, confirmed `userErrors: []`, confirmed
clean on a direct Admin re-query, then confirmed clean again on a fresh
cache-busted live curl of the rendered `article-body` div specifically (not
just full-page grep, which would false-positive on the legitimate sitewide
footer "Visit our Etsy Store" link — that footer link is out of scope, it is
site nav, not article content, and is unchanged on every page).

## What else was fixed this run, live and verified

5 more article bodies rewritten via `articleUpdate`, same verification method
(Admin re-query, then live cache-busted curl scoped to `article-body`):

| Article | Issue | Fix |
|---|---|---|
| `how-to-make-money-on-twitch-as-a-beginner-in-2026` | Etsy shop-root link + `utm_source=chatgpt.com`, redundant with the very next paragraph which already links the real Shopify site | Repointed to `streamwidgetshop.com` |
| `how-twitch-goal-widgets-increase-viewer-engagement-and-help-grow-your-community-faster` | Etsy listing 4505167275, shown twice, as raw URL text both as href and visible anchor text | Repointed both occurrences to `streamwidgetshop.com/products/sakura-animated-twitch-chat-widget-kawaii-cherry-blossom-stream-decor-digital-download`, visible text updated to match |
| `why-every-twitch-streamer-should-have-a-goal-widget-in-2026` | Same Etsy listing 4505167275 | Repointed to `/products/sakura-animated-twitch-chat-widget-kawaii-cherry-blossom-stream-decor-digital-download`. First pass only fixed the href and left the visible anchor text as the old Etsy URL string; caught on live re-check and fixed with a second edit, now reads "Sakura Chat and Goal Widget for Twitch" |
| `how-to-create-a-cozy-stream-setup-with-cute-frog-widgets-and-cottagecore-twitch-aesthetics` | Em dash: "aesthetic stream widgets — especially cute frog-themed" | Comma |
| `the-cozy-aesthetic-spring-collection` | 2 em dashes: "watching your content—they are staying" and "not just a style—it is a strategy" | Both to commas |

**9 distinct articles edited this run, all 9 independently re-verified live**
after every push (not trusting the mutation's own success response).

## What was checked and found clean, this run's 21-article scope

- **Rendered `<title>` vs `seo.title`**: 21 of 21 match exactly (after decoding
  HTML entities in the rendered attribute, which is not a real mismatch), all
  40-58 chars, all under the 60 limit.
- **Meta description vs `seo.description`**: 21 of 21 match, all under 155
  (range 109-154).
- Canonical present and self-referential, 21 of 21. `og:image` HTTP 200 on all
  21 (separately HEAD-checked).
- **TikTok claims**: every TikTok sentence across the 21 bodies read; all say
  unofficial/best-effort or are a neutral platform mention (e.g. "grow on
  TikTok, YouTube, Instagram"), never a flat support claim. Clean.
- **In-body product link count**: 0-2 per article, all within the 2-per-article
  standard. No CTA blocks found.
- **Prices in prose**: `$29.99` (Multistream Chat Widget Pack) matches the live
  Storefront price. The only other `$` match was `$1,000 per month`, an income
  example in a beginner-monetization article, not a product price.
- **"Last checked" dates**: only the two multistream articles carry one, both
  "22 September 2026", 2 days old, nowhere near the 90-day re-verify trigger.
  No other article claims a checkable fact with a date. Nothing to refresh.
- **No invented streamers/testimonials/review counts** found in a targeted scan
  of all 21 bodies.
- **IP names**: 1 hit this run (Cyberpunk 2077, fixed above, see residuals).
  Nothing else matched the deny-list pattern across the 21.

## The internal link graph (all 31 live articles, mandatory every run)

| | 2026-09-23 | 2026-09-24 (today) |
|---|---|---|
| Orphans (zero inbound) | 29 of 31 | **29 of 31, unchanged** |
| Dead ends (zero outbound) | 29 of 31 | **29 of 31, unchanged** |

The only 2 internal links in the whole blog are still the multistream pair
interlinking each other. **No hub back-links were added this run because the
hub pages do not exist yet.** Per `PIPELINE.md`, "Getting Started with
Streaming" ships 2026-10-13 and "VTuber Getting Started" ships 2026-10-27; the
spec's allowed fix ("add ONE contextual back-link from a spoke to its hub") has
no live hub URL to point at yet on either cluster. This is not a missed fix,
it is a hard dependency. Flagging so the metric is read correctly: orphan count
holding flat is expected until a hub ships, not evidence the strategy failed.

## What could not be checked, and why

- **CTR, impressions, every measurement-driven adjustment rule.** Still no
  Search Console export in `content/blog/` (checked: `PIPELINE.md`, `drafts/`,
  `ids.json`, `multistream-research-2026-09-17.md`, `seo.json`, nothing newer
  than the 2026-09-17 GA4 pull). Same blocker as the last two runs, raised to
  Todd again below.
- **The other 10 articles**, rotation slice 2. Next run's scope.
- **Commission pricing ($300 vs "quoted per project") and FIFA/NBA in 3 titles
  and URLs.** Both still open from 2026-09-23, both still Todd's call, both
  unchanged this run (checked, not touched, per the standing instruction not
  to decide pricing or positioning). Raised again below since the prior run's
  signal file was rejected (malformed) and never reached Todd's board.

## Deploy freshness, resolved

`/api/version` now reports commit `3e1913c`, built 2026-09-24T13:41:29Z, so the
stale-build-stamp problem flagged 2026-09-23 (endpoint claiming `ff0ffe4` while
the blog fixes were actually live) has cleared on its own via a normal deploy.
No action needed, no signal re-raised for this one.

---

Last edited by: Claude claude-sonnet-5 2026-09-24 · Closed 4 residuals, fixed 5 more, orphan/dead-end count unchanged
