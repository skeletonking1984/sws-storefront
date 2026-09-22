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
 * Product types that ship no chat widget at all, so no product of that type
 * can be multistream no matter what its platform list says.
 *
 * Measured 2026-09-22: the Froggy Goal Widget and the Moon Jar Goal Widget
 * both list Twitch, YouTube and Kick in `works_with` and both therefore wore
 * a ribbon whose own aria-label said "reads chat from more than one
 * platform". Neither reads chat from anywhere. A goal widget counts events
 * through StreamElements or Streamlabs, which is why its platform list
 * legitimately names three platforms: the streamer can be live on any of
 * them. That is cross-platform compatibility, and it is not multistream.
 *
 * The comment this replaces claimed "a goal bar does not read chat from
 * anywhere, so requiring both platforms already excludes it correctly". That
 * was wrong, and had been wrong since the ribbon shipped, because the
 * platform list describes where the STREAMER can be live, not where the
 * WIDGET reads from.
 *
 * A denylist of two types, not an allowlist of chat-carrying ones, because
 * productType is curated data while a pack's contents are only described in
 * prose, and app/lib/platforms.js exists because prose is the thing being
 * checked rather than a source to check against.
 */
const CHATLESS_PRODUCT_TYPES = ['Goal Widget', 'Emotes'];

/**
 * Whether the product ships something that reads chat at all. An unknown
 * product type returns false: a missing badge costs a little scannability, a
 * wrong one costs a refund and a one star review saying it does not work.
 * @param {{productType?: string | null}} product
 * @returns {boolean}
 */
export function shipsChat(product) {
  const type = product?.productType;
  if (!type) return false;
  return !CHATLESS_PRODUCT_TYPES.includes(type);
}

/**
 * Whether a product earns the "Multistream" ribbon. Two conditions, and Todd
 * stated the second one on 2026-09-22: "product must be multistream enabled
 * or its not multistream".
 *
 *   1. It ships a widget that reads chat (see `shipsChat`).
 *   2. Its `works_with` metafield lists BOTH YouTube and Kick.
 *
 * Together those mean "this product reads chat from more than one platform",
 * which is what the ribbon says out loud. Condition 1 was missing until
 * 2026-09-22 and 2 of the 10 ribbons on the site were false because of it.
 *
 * Never derive either half from the title or description. Titles here are SEO
 * stuffed with platform names the widget does not read (see the
 * `detectPlatforms` warning above), and every pack in the catalogue has the
 * word "chat" somewhere in its title whether or not that is the part being
 * sold.
 *
 * No metafield, a single platform, or a chatless product type means no
 * ribbon.
 *
 * @param {{worksWith?: {value?: string | null} | string | null, productType?: string | null}} product
 * @returns {boolean}
 */
export function isMultistream(product) {
  if (!shipsChat(product)) return false;
  const raw =
    typeof product?.worksWith === 'string'
      ? product.worksWith
      : product?.worksWith?.value;
  const platforms = parseWorksWith(raw);
  if (!platforms) return false;
  const lower = platforms.map((p) => String(p).toLowerCase());
  return lower.includes('youtube') && lower.includes('kick');
}

/**
 * The chat platforms a product's chat widget actually reads, for saying in
 * words what the ribbon says as a label. Empty for anything that ships no
 * chat, so a goal widget never produces a sentence about chat.
 *
 * StreamElements, Streamlabs and OBS are deliberately not in here: they are
 * where the widget RUNS, not a place chat comes from, and conflating the two
 * is how a StreamElements-only widget ended up badged for YouTube.
 *
 * @param {{worksWith?: {value?: string | null} | string | null, productType?: string | null}} product
 * @returns {string[]}
 */
export function chatPlatforms(product) {
  if (!shipsChat(product)) return [];
  const raw =
    typeof product?.worksWith === 'string'
      ? product.worksWith
      : product?.worksWith?.value;
  const platforms = parseWorksWith(raw) ?? [];
  const chatSources = ['Twitch', 'YouTube', 'Kick', 'TikTok'];
  return chatSources.filter((source) =>
    platforms.some((p) => String(p).toLowerCase() === source.toLowerCase()),
  );
}
