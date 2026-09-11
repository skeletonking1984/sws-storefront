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

/**
 * Parses the `custom.works_with` product metafield, which Shopify stores as
 * a JSON encoded array of strings for a `list.single_line_text_field`.
 * Returns null on anything missing or unexpected so callers fall through to
 * a description-based guess rather than trusting garbage.
 * @param {string | null | undefined} raw
 * @returns {string[] | null}
 */
export function parseWorksWith(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    return null;
  }
  return null;
}

/**
 * Whether a product earns the "Multistream" ribbon: its `works_with`
 * metafield lists BOTH YouTube and Kick (case-insensitively). That is the
 * honest definition of "reads chat from more than one platform" for this
 * catalog, ground-truthed against `data/widget-code-signals.json`, which
 * records what each product's actually shipped widget code references.
 *
 * Never derive this from the title or description. Titles here are SEO
 * stuffed with platform names the widget does not read (see the
 * `detectPlatforms` warning above), and a goal widget can reference Kick in
 * its own code with no YouTube, and a goal bar does not read chat from
 * anywhere, so requiring both platforms already excludes it correctly.
 *
 * No metafield, or a single platform, means no ribbon.
 *
 * @param {{worksWith?: {value?: string | null} | string | null}} product
 * @returns {boolean}
 */
export function isMultistream(product) {
  const raw =
    typeof product?.worksWith === 'string'
      ? product.worksWith
      : product?.worksWith?.value;
  const platforms = parseWorksWith(raw);
  if (!platforms) return false;
  const lower = platforms.map((p) => String(p).toLowerCase());
  return lower.includes('youtube') && lower.includes('kick');
}
