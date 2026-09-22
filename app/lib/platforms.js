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
 * Product types that ship no chat widget at all. They can still be
 * multistream (see `isMultistream`); they just cannot be multistream CHAT,
 * so nothing may say they read chat from anywhere.
 *
 * A denylist of two types, not an allowlist of chat-carrying ones, because
 * productType is curated data while a pack's contents are only described in
 * prose, and this file exists because prose is the thing being checked
 * rather than a source to check against.
 */
const CHATLESS_PRODUCT_TYPES = ['Goal Widget', 'Emotes'];

/**
 * Whether the product ships something that reads chat at all. An unknown
 * product type returns false: a missing claim costs a little scannability, a
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
 * Whether a product earns the "Multistream" ribbon: its `works_with`
 * metafield lists BOTH YouTube and Kick, which in this catalogue always
 * means Twitch plus those two.
 *
 * Todd settled the definition on 2026-09-22: "if it works on Twitch, YT and
 * kick it is multistream". Multistream is about where the product WORKS, not
 * about whether it merges chat, so a goal widget that runs on all three is
 * multistream exactly like a chat widget that does.
 *
 * The thing that was genuinely wrong, and is fixed in the wording rather than
 * here: the ribbon's own aria-label read "reads chat from more than one
 * platform", and the Froggy and Moon Jar goal widgets wore it while reading
 * no chat at all. The claim was false, the ribbon was not. A goal widget
 * counts tips and subs through StreamElements or Streamlabs, so it works
 * whichever of the three you are live on, and `shipsChat` exists so every
 * sentence about a product can say which of those two things it means.
 *
 * Todd's other half of the rule, same day: "product must be multistream
 * enabled or its not multistream". So this reads `works_with`, which is
 * ground-truthed per product against that product's Etsy listing, and never
 * the title or description. Titles here are SEO stuffed with platform names
 * the product does not support (see the `detectPlatforms` warning above).
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

/**
 * The platforms a product's CHAT widget reads, for products that ship one.
 * Empty for anything chatless, so a goal widget never produces a sentence
 * claiming it reads chat, however many platforms it is multistream across.
 *
 * StreamElements, Streamlabs and OBS are deliberately not in here: they are
 * where the widget RUNS, not a place chat comes from, and conflating the two
 * is how a StreamElements-only widget ended up badged for YouTube.
 *
 * @param {{worksWith?: {value?: string | null} | string | null, productType?: string | null}} product
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
