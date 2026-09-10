# SWS Product Copy Standard

Applies to `title`, `descriptionHtml`, `seo.title`, `seo.description` on every Shopify product.
Written 2026-09-10 against the first 18 standardized products (top sellers by Etsy revenue),
reusable for the remaining catalog. Every factual claim in a product's copy must come from that
product's own live Etsy listing (`etsy_get_listing`) and its file manifest
(`etsy_list_listing_files`). Never assume a feature or platform because a sibling product has it.

## Hard rules

- Never use an em dash or en dash, anywhere. Commas, periods, plain hyphens only.
- Never fabricate a review, rating, testimonial, or customer count.
- Never invent a feature, file, or platform. If the Etsy listing does not say it, leave it out,
  do not hedge it in vaguely.
- Never touch price or variants.

## Titles

Pattern: `<Product Name> <Type> for <Platforms> | <Distinctive Feature> | <Software>`

- `<Product Name>` is the recognizable product name already used on Etsy and in the shop
  (do not rebrand it).
- `<Type>` is `Chat Widget`, `Goal Widget`, or `Chat and Goal Widget`, whichever the product
  actually is.
- `<Platforms>` is the exact platform list the Etsy listing supports, no more. Many older
  StreamElements-only widgets only support Twitch chat even if the shop has a "multistream"
  naming convention elsewhere. Check the live listing text before naming Kick, YouTube, or TikTok.
- `<Distinctive Feature>` is the one thing that differentiates this product from its siblings
  (a theme, an animation style, an install method).
- `<Software>` is whichever of StreamElements, StreamLabs, OBS is actually confirmed.
- Target under 70 characters. Lead with words a buyer actually searches (product name, type,
  platform), never keyword-stuff a list of unrelated terms.
- Drop trailing software clauses first if a title runs long, the "Works With" section carries
  that detail anyway.

## Descriptions

Fixed section order, every time:

1. One or two opening sentences: plainly state what this is and who it is for.
2. `<h3>What You Get</h3>` + `<ul>` of the real files, pulled from `etsy_list_listing_files`
   (exact filenames, described in plain language).
3. `<h3>Works With</h3>` + `<ul>` of the real platforms and software, pulled from the Etsy
   listing text, never assumed from the product family.
4. `<h3>Setup</h3>` + `<ol>` of numbered steps, plus one `<p>` with a realistic time estimate.
   A product with a confirmed one-click install link gets that path named first; a manual-only
   product gets a manual estimate (roughly 10 to 15 minutes), never claims a one-click install
   it does not have.
5. `<h3>Customizable</h3>` + `<ul>` of what the Etsy listing text says can actually be changed.
6. `<h3>FAQ</h3>`, 3 to 5 real buyer questions as `<p><strong>Question</strong></p>` followed by
   `<p>Answer</p>`. Each answer must stand alone if quoted out of context, no "as mentioned
   above." This is the AEO layer, answer engines and AI shopping assistants should be able to
   lift a single FAQ pair and have it be complete and correct on its own.

Write clean semantic HTML directly: `<h3>` for headings, `<ul>`/`<li>` for the list sections,
`<p>` for opening prose and FAQ answers. Do not produce the legacy flat-`<p>`-with-`<br>` shape
(see the storefront repo's `CLAUDE.md` data quirks section), `app/lib/productDescription.js`
passes clean structured HTML straight through.

## SEO fields

- `seo.title`: 60 characters or fewer.
- `seo.description`: 155 characters or fewer, states the product, platform and one differentiator.

## Applying this to the rest of the catalog

For each remaining product: resolve its Etsy listing id, call `etsy_get_listing` and
`etsy_list_listing_files`, draft title/description/seo against the rules above, diff against
the current live copy, then `productUpdate`. Back up the current `{handle, title,
descriptionHtml, seo}` for every product touched in the same pass, before writing, to the same
`data/copy-backup-<date>.json` shape used for the first 18 (see
`data/copy-backup-2026-09-10.json`).
