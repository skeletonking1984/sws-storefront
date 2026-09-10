/**
 * Build per-product Etsy reviews for the storefront from real Etsy data.
 *
 * Reads data/etsy-reviews-raw.json (the full set of StreamWidgetShop Etsy
 * reviews, keyed by etsy listing_id) and data/etsy-video-map.json (the
 * etsy_listing_id -> Shopify handle join table already built for the video
 * sync). Writes TWO output files, split by where they are meant to load:
 *
 *   - app/data/etsy-shop-stats.json: just the shop-level stats block
 *     (rating, review count, sold count, favorite count, review url). Tiny,
 *     safe to import client-side. EtsyRating.jsx is the only consumer.
 *   - app/data/etsy-reviews.json: the full per-product data, review text
 *     included, unchanged in shape. This file is large (hundreds of
 *     reviews across every product) and is meant for SERVER use only, e.g.
 *     a route loader. Never import it from a component body or module
 *     scope a client bundle can reach, or the bundler ships every
 *     product's review text to every visitor. See app/routes/products.
 *     $handle.jsx for the pattern: import it, use it only inside the
 *     loader/loader-only helper functions, pass just the one product's
 *     slice down as a prop.
 *
 * No network calls, no credentials. Re-runnable any time either input file
 * is refreshed.
 *
 * Rules (do not relax these without checking with Todd, see the task brief):
 *   - Never invent, edit or cherry-pick review text. Only verbatim source
 *     text, HTML-entity decoded, survives into the output.
 *   - A review only joins to a product when the map row has a non-null
 *     handle AND a trustworthy confidence tier. A wrong-product review is
 *     worse than no review at all.
 *   - Reviews of every rating are kept and sorted most recent first, not
 *     just 5 star reviews.
 */

import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const RAW_REVIEWS_PATH = path.join(ROOT, 'data/etsy-reviews-raw.json');
const VIDEO_MAP_PATH = path.join(ROOT, 'data/etsy-video-map.json');
const OUTPUT_PATH = path.join(ROOT, 'app/data/etsy-reviews.json');
const SHOP_STATS_OUTPUT_PATH = path.join(ROOT, 'app/data/etsy-shop-stats.json');

// Confidence tiers trustworthy enough to attribute a real review to a real
// product. A review landing on the wrong listing is worse than dropping it.
const TRUSTED_CONFIDENCE = new Set([
  'manual',
  'exact',
  'verified',
  'high',
  'reviewed',
]);

/**
 * Decodes HTML entities (named and numeric) that show up in Etsy review
 * text, e.g. `&#39;` `&quot;` `&amp;` `&lt;` `&gt;` `&#x27;`. No external
 * dependency, this is a small fixed set plus the numeric entity forms.
 * @param {string} text
 */
function decodeHtmlEntities(text) {
  if (!text) return text;
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** Normalizes line endings and trims. */
function cleanText(text) {
  return decodeHtmlEntities(text).replace(/\r\n/g, '\n').trim();
}

function main() {
  const raw = JSON.parse(readFileSync(RAW_REVIEWS_PATH, 'utf8'));
  const videoMap = JSON.parse(readFileSync(VIDEO_MAP_PATH, 'utf8'));

  // listing_id -> {handle, confidence}
  const listingToProduct = new Map();
  for (const row of videoMap.rows) {
    if (!row.handle) continue;
    listingToProduct.set(row.etsy_listing_id, {
      handle: row.handle,
      confidence: row.confidence,
    });
  }

  let kept = 0;
  let droppedNoHandle = 0;
  let droppedLowConfidence = 0;

  /** handle -> {etsyListingId, reviews: [{rating, date, text, language}]} */
  const byHandle = new Map();

  for (const r of raw.reviews) {
    const match = listingToProduct.get(r.listing_id);
    if (!match) {
      droppedNoHandle += 1;
      continue;
    }
    if (!TRUSTED_CONFIDENCE.has(match.confidence)) {
      droppedLowConfidence += 1;
      continue;
    }

    kept += 1;
    if (!byHandle.has(match.handle)) {
      byHandle.set(match.handle, {
        etsyListingId: r.listing_id,
        reviews: [],
      });
    }
    byHandle.get(match.handle).reviews.push({
      rating: r.rating,
      date: r.date,
      text: cleanText(r.review || ''),
      language: r.language || '',
    });
  }

  const products = {};
  for (const [handle, data] of byHandle) {
    const allReviews = data.reviews;
    const count = allReviews.length;
    const sum = allReviews.reduce((acc, r) => acc + r.rating, 0);
    const average = count ? Math.round((sum / count) * 10) / 10 : 0;

    const distribution = {5: 0, 4: 0, 3: 0, 2: 0, 1: 0};
    for (const r of allReviews) {
      distribution[r.rating] = (distribution[r.rating] || 0) + 1;
    }

    const reviewsWithText = allReviews
      .filter((r) => r.text.length > 0)
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .map((r) => ({
        rating: r.rating,
        date: r.date,
        text: r.text,
        language: r.language,
      }));

    products[handle] = {
      handle,
      etsyListingId: data.etsyListingId,
      count,
      average,
      distribution,
      reviews: reviewsWithText,
    };
  }

  // Fail loudly on a malformed shop block. JSON.stringify drops undefined
  // keys rather than throwing, so a raw file whose `shop` is a bare id (which
  // one version of the pull script wrote) produced a stats file with every
  // number missing, and the site rendered an empty shop rating with no error
  // anywhere. Check before building, not after shipping.
  const missing = [
    'review_average',
    'review_count',
    'transaction_sold_count',
    'num_favorers',
  ].filter((k) => typeof raw.shop?.[k] !== 'number');
  if (missing.length) {
    console.error(
      `data/etsy-reviews-raw.json has a malformed "shop" block, missing: ${missing.join(', ')}.`,
    );
    console.error('Re-run: node scripts/pull-etsy-reviews.mjs');
    process.exit(1);
  }

  const shop = {
    average: raw.shop.review_average,
    count: raw.shop.review_count,
    soldCount: raw.shop.transaction_sold_count,
    favoriteCount: raw.shop.num_favorers,
    url: 'https://www.etsy.com/shop/StreamWidgetShop/reviews',
  };
  const generatedAt = new Date().toISOString();

  const output = {
    shop,
    generatedAt,
    sourceNote:
      'Real StreamWidgetShop Etsy reviews, joined to Shopify products by ' +
      'etsy listing id via data/etsy-video-map.json. Only trusted-confidence ' +
      'matches are kept, see scripts/build-etsy-reviews.mjs. SERVER USE ' +
      'ONLY, contains every product review verbatim: import this from a ' +
      'route loader, never from a component body or module scope, or the ' +
      'bundler ships it to the client. Client code wanting just the shop ' +
      'stats should import etsy-shop-stats.json instead.',
    products,
  };

  const shopStatsOutput = {
    shop,
    generatedAt,
    sourceNote:
      'Shop-level Etsy stats only (rating, review count, sold count, ' +
      'favorite count), no review text. Safe to import client-side, see ' +
      'EtsyRating.jsx. Full per-product review text lives in ' +
      'etsy-reviews.json, server use only.',
  };

  mkdirSync(path.dirname(OUTPUT_PATH), {recursive: true});
  writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
  writeFileSync(
    SHOP_STATS_OUTPUT_PATH,
    JSON.stringify(shopStatsOutput, null, 2) + '\n',
  );

  const productCount = Object.keys(products).length;
  console.log('Etsy reviews build summary');
  console.log('---------------------------');
  console.log(`Source reviews: ${raw.reviews.length}`);
  console.log(`Kept (joined to a trusted product match): ${kept}`);
  console.log(`Dropped, no handle for that listing id: ${droppedNoHandle}`);
  console.log(
    `Dropped, handle present but confidence not trusted: ${droppedLowConfidence}`,
  );
  console.log(`Products covered: ${productCount}`);
  console.log(`Written to: ${path.relative(ROOT, OUTPUT_PATH)}`);
  console.log(`Written to: ${path.relative(ROOT, SHOP_STATS_OUTPUT_PATH)}`);
}

main();
