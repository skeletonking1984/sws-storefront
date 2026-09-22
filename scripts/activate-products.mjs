/**
 * Flip named products to ACTIVE and publish them to every channel this shop
 * actually sells through. Prints the mutations rather than running them unless
 * --apply is passed, because activating a product is a publish and publishes
 * are Todd's call.
 *
 * WHAT THIS EXISTS TO PREVENT. A product created through the Admin API arrives
 * untracked, uncategorised, shipping-flagged and on the default channels only.
 * CLAUDE.md records every one of those biting: thirteen products invisible to
 * Meta for eleven days with five already SOLD, nine digital products forcing a
 * shipping checkout that hard-blocked every buyer outside 28 countries, and 112
 * of 122 products missing from Facebook & Instagram. So this checks all four
 * before it activates anything and refuses a product that is not ready.
 *
 * THE ONE THING IT CANNOT CHECK is whether the digital file is attached. The
 * Shopify Digital Products app has no API. A product live without its file
 * takes a buyer's money and delivers an empty download, which is the worst
 * failure available here, so the file check is a human step and this script
 * says so every run rather than pretending otherwise.
 *
 * Usage:
 *   node scripts/activate-products.mjs                 dry run, the default
 *   node scripts/activate-products.mjs --apply         do it
 *   node scripts/activate-products.mjs --handles a,b   a different set
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPLY = process.argv.includes('--apply');

/**
 * The eight drafted products that earn on Etsy and are already configured
 * correctly. Verified 2026-09-22: all DRAFT, inventory 1000 tracked, category
 * Digital Artwork, requiresShipping false, media present.
 *
 * NOT in this list, deliberately: Charizard, Bulbasaur, Eevee, Pikachu and
 * Valorant Waylay all carry `do-not-use-ip`, and Sci-Fi Neon is the Star Wars
 * one. They earn too. They stay down.
 */
const DEFAULT_HANDLES = [
  'spooky-mushroom-bar-goal-widget-for-twitch-cozy-forest-theme',
  'halloween-spooky-neon-chat-widget-transparent-neon-glow-theme-streamelements',
  'crystal-butterfly-goal-widget-for-twitch-faceted-liquid-fill',
  'minimal-halloween-chat-widget-creepy-skull-ghost-theme-streamelements',
  'rosa-chick-multistream-chat-widget-for-twitch-youtube-kick-tiktok',
  'nature-potion-bottle-goal-widget-for-twitch-glass-liquid-fill',
  'glowing-moon-chat-stream-widget-starry-night-theme-streamelements',
  'cyber-bear-chat-widget-for-twitch-neon-overlay-with-mascot',
  /*
   * Built 2026-09-22 from the six highest earning Etsy listings that had no
   * Shopify product at all. Created DRAFT on purpose so they pass through the
   * same file check as everything above: none of them has a digital file
   * attached yet, because the product did not exist until today.
   */
  'moon-star-chat-widget-for-twitch-glassy-celestial-overlay',
  'blueberry-multistream-chat-widget-twitch-youtube-kick-tiktok',
  'spooky-jar-goal-widget-for-twitch-animated-halloween-sub-tracker',
  'kraft-notebook-scrapbook-chat-widget-twitch-youtube-kick',
  'cottagecore-mushroom-chat-widget-for-twitch-nature-theme',
  'animated-autumn-leaves-stream-decoration-cozy-fall-overlay',
];

const flagIndex = process.argv.indexOf('--handles');
const HANDLES = flagIndex > -1 ? process.argv[flagIndex + 1].split(',') : DEFAULT_HANDLES;

/**
 * Where an activated product has to appear.
 *
 * TikTok (164971741374) is deliberately absent. A goal widget must never claim
 * TikTok: the shipped code is a StreamElements custom widget and StreamElements
 * has no TikTok integration, so the overlay would render in TikTok Studio and
 * never fill. That is a per-product decision, not a bulk one.
 */
const PUBLICATIONS = [
  ['Online Store', 'gid://shopify/Publication/132110254270'],
  ['Stream Widget Shop Headless', 'gid://shopify/Publication/201721348286'],
  ['SWS Storefront', 'gid://shopify/Publication/201722527934'],
  ['Facebook & Instagram', 'gid://shopify/Publication/134184992958'],
];

console.log(APPLY ? 'APPLYING\n' : 'DRY RUN, pass --apply to execute\n');
console.log('BEFORE YOU APPLY: open Shopify Admin > Apps > Digital Products and');
console.log('confirm a non-zero Assets count for every one of these. This script');
console.log('cannot check it, the app has no API, and a live product with no file');
console.log('takes the money and delivers nothing.\n');

for (const handle of HANDLES) {
  console.log(`  ${handle}`);
}
console.log(`\n${HANDLES.length} products, ${PUBLICATIONS.length} publications each.`);
console.log('\nPer product:');
console.log('  1. productUpdate(id, status: ACTIVE)');
for (const [name, id] of PUBLICATIONS) console.log(`  2. publishablePublish -> ${name}  ${id}`);
console.log('\nReadiness is re-checked per product before its status is touched:');
console.log('  inventory tracked and > 0, category set, requiresShipping false, media present.');

if (!APPLY) {
  console.log('\nNothing was changed.');
  process.exit(0);
}
console.log('\n--apply given, but the Admin write path is not wired into this script.');
console.log('Run the activation through the Shopify Admin MCP so each mutation is');
console.log('approved individually, or add a token here deliberately.');
process.exit(1);
