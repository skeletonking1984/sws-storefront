/**
 * The product name a HUMAN would say, cut out of an Etsy keyword title.
 *
 * Titles in this catalogue are search strings, not names. "Boba Drink Goal
 * Widget for Twitch | Cute Progress Bar | StreamElements Streamlabs OBS" is
 * one product, three keyword phrases and a platform list. Reading the whole
 * thing aloud, which is what a screen reader does with it eleven times on one
 * gallery, is unusable, and putting it in alt text is keyword stuffing.
 *
 * Two callers share this, and they have to agree or the same product gets two
 * different names on one page:
 *   app/components/ProductGallery.jsx  the rendered alt and aria-label
 *   scripts/build-alt-text.mjs         the alt written into Shopify
 *
 * One rule this must not break: NEVER take platform names from a title. The
 * titles here name YouTube, Kick and TikTok on widgets that support none of
 * them (80 of 125 products measured 2026-09-14), so platform claims come from
 * the `custom.works_with` metafield or they do not appear. That is why a
 * trailing comma clause naming a platform is dropped rather than kept.
 */

/** Platform names, wherever they appear in a title clause. */
const PLATFORM_WORD =
  /\b(twitch|kick|youtube|obs|streamlabs|stream\s?elements|tiktok|vtuber)\b/i;

/**
 * Tails that describe the LISTING, not the product.
 *
 * "is fully customisable for twitch, streamlabs, tiktok studio and
 * streamelements" is appended to most of this catalogue and says nothing
 * about what the buyer is looking at.
 */
const TITLE_TAILS = [
  /\bis\s+fully\s+customi[sz]able\b.*$/i,
  /\bfully\s+customi[sz]able\b.*$/i,
  /\bcustomi[sz]able\b.*$/i,
  /\bfor\s+(twitch|kick|youtube|obs|streamlabs|streamelements|tiktok)\b.*$/i,
  /\b(digital|instant)\s+download\b.*$/i,
  /\beasy\s+setup\b.*$/i,
  /\bone[\s-]?click\s+install(ation)?\b.*$/i,
  /\bstreamelement(s)?\s+only\b.*$/i,
  /\bset\s?up\s+through\s+obs\b.*$/i,
];

/**
 * @param {string | null | undefined} title
 * @returns {string}
 */
export function subjectFromTitle(title) {
  let s = String(title || '').trim();
  // Three separators are in use here. Missing the bullet left six titles
  // running past the 125 character alt cap on 2026-09-19.
  s = s.split(/\s*[|•·]\s*/)[0];
  s = s.split(/\s+[-–]\s+/)[0];
  s = s.split(/\s*[(]/)[0];
  for (const tail of TITLE_TAILS) s = s.replace(tail, '');
  const clauses = s.split(/\s*,\s*/);
  while (clauses.length > 1 && PLATFORM_WORD.test(clauses[clauses.length - 1])) {
    clauses.pop();
  }
  s = clauses.join(', ').replace(/[\s,:;.·•]+$/, '').trim();
  // A title that is nothing but keyword phrases can lose everything above.
  // Its first clause is still better than an empty string.
  if (!s) s = String(title || '').split(',')[0].trim();
  return s;
}
