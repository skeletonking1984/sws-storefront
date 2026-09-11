const KNOWN_PLATFORMS = [
  'Twitch',
  'YouTube',
  'TikTok',
  'Kick',
  'OBS',
  'Streamlabs',
  'StreamElements',
  'VTuber',
];

/**
 * Scans product title/description text for known streaming platform names
 * and returns the matched ones in a stable, de-duplicated order.
 * @param {string} text
 * @returns {string[]}
 */
export function detectPlatforms(text) {
  if (!text) return [];
  const found = new Set();
  for (const platform of KNOWN_PLATFORMS) {
    const pattern = new RegExp(platform.replace(/\s/g, '\\s*'), 'i');
    if (pattern.test(text)) {
      found.add(platform);
    }
  }
  return Array.from(found);
}

/**
 * Section headings that end the "Works With" block in a COPY-STANDARD
 * description (see docs/COPY-STANDARD.md).
 */
const NEXT_SECTION = /(Setup|FAQ|What You Get|Why Choose|Our Policy|Description)/i;

/**
 * The platforms a product may HONESTLY be badged with.
 *
 * Why this exists, and why `detectPlatforms` must never be pointed at a whole
 * description again: it matches platform names as substrings, so it cannot
 * tell a claim from its denial. The number one revenue product carries the
 * FAQ line "Does this widget support YouTube or Kick chat? No. This listing
 * reads Twitch chat through StreamElements only", and the badge row above it
 * rendered YouTube and Kick anyway. The page contradicted itself, and the
 * badge row is the one thing a buyer checks before paying. Measured
 * 2026-09-10: 116 of 131 storefront products carried at least one badge their
 * own copy did not support.
 *
 * So badges come from the "Works With" section alone, which is the section
 * COPY-STANDARD defines for exactly this claim and which was ground-truthed
 * per product against that product's Etsy listing and file manifest.
 *
 * Returns null when the product has no "Works With" section, which currently
 * means every product not yet migrated to the standard. The caller renders no
 * badges at all in that case. An absent badge row costs a little scannability;
 * a wrong one costs a refund and a one star review saying it does not work.
 *
 * @param {string} description
 * @returns {string[] | null} platforms, or null when there is nothing to trust
 */
export function worksWithPlatforms(description) {
  if (!description) return null;
  const start = description.search(/Works With/i);
  if (start === -1) return null;
  const rest = description.slice(start + 'Works With'.length);
  const end = rest.search(NEXT_SECTION);
  const block = end === -1 ? rest.slice(0, 400) : rest.slice(0, end);
  const found = detectPlatforms(block);
  return found.length ? found : null;
}
