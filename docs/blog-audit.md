# Blog audit, organic traffic

`node scripts/blog-audit.mjs` (writes `blog-hero/audit.json`). Run 2026-09-15
against the 43 live articles on `/blogs/news`.

**43 articles, 38,369 words, 236 findings: 18 HIGH, 53 MED, 165 LOW.**

## The headline

The blog's biggest organic problem is not thin posts or missing meta tags. It is
that **seven pairs of articles compete with each other for the same query**, two
of them with byte-identical titles. Google picks one and the rest split the
signal, so the blog's own posts are the thing holding the blog down. Writing a
44th article changes none of that.

## HIGH

### Cannibalisation, 7 pairs

| Overlap | Articles |
|---|---|
| 100% | `best-vtuber-overlays-2026-kawaii-celestial-guide` + `...-guide-1` (identical titles) |
| 100% | `best-cyberpunk-twitch-overlays-for-futuristic-stream-setups` + `...-setups-1` (identical titles) |
| 75% | `best-cyberpunk-...-and-chat-widgets-for-futuristic-stream-setups` vs both of the above |
| 55% | `star-wars-stream-setup-for-may-4th-guide` + `star-wars-stream-setup-may-4th-widgets` |
| 50% | `is-streamelements-shutting-down-what-streamers-need-to-know-in-2026` + `is-streamelements-shutting-down-best-streamelements-alternatives...` |
| 50% | `best-cyberpunk-...` + `best-twitch-and-kick-chat-widgets-and-stream-overlays-for-obs-in-2026` |

Four separate articles cover cyberpunk overlays. Four cover the StreamElements
shutdown question. Three cover May 4th.

**Needs Todd's call**, because the fix is to keep one of each and 301 the rest
into it, and that is a delete-shaped action on published pages. Nothing has been
touched.

### IP risk, 7 articles

Star Wars (x4 including two titles), Mandalorian and Grogu, Pokemon. Named marks
in titles, body copy and hero art. Same class of exposure as BAT-153 on the Etsy
side. The genre sells the widget; the franchise name is somebody else's.

### Thin content, 4 articles under 400 words

`webm-vs-gif-for-twitch...` is **150 words**. It will not rank for a contested
query at that length, and it is one of the pair that duplicates
`what-is-webm-and-why-it-matters-for-streamers` (500 words). Merging the two into
one real article is better than padding either.

## MED

- **40 articles have no in-body product link.** Worth stating precisely: the
  rendered pages are NOT link dead. A live fetch of one of them returned 10
  distinct `/products/` links from the cross-sell row. But a contextual link
  inside the prose, on words the reader is already reading, carries more
  relevance and is the link a buyer actually follows.
- **4 hero images were each shared by 2 to 4 articles.** Fixed by this pass,
  every article now gets its own.
- 4 more articles between 400 and 600 words.
- 3 articles with no meta description, so Google writes the snippet.
- 2 articles with no `h2` at all.

## LOW

43 missing image alt text, 42 missing SEO titles, 36 missing tags (the blog's
own category UI runs on these), 26 titles over 60 characters, 18 meta
descriptions over 165 characters.

## Fixed in this pass

Hero images. All 43 replaced with 1200x630 cards rendered from real widgets,
built by `blog-hero/`. Old URLs are recorded in `blog-hero/hero-rollout.json` so
the swap is reversible.

## Recommended order

1. Resolve the 7 cannibalisation pairs. Highest impact, needs Todd.
2. Rename or rewrite the 7 IP-risk articles. Liability, not just SEO.
3. Merge the two WebM articles into one.
4. Add in-body product links to the articles that already get traffic. Measure
   first, fix the ones with sessions, not all 40 blindly.
5. Backfill meta descriptions, SEO titles, alt text and tags. Cheap and
   mechanical, but it is LOW for a reason: none of it outranks a duplicate.
