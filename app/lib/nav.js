/**
 * Single source for nav/search config shared between the homepage sections
 * (Shop by vibe, Works with, kits) and the header mega menu / search
 * palette. Don't paste second copies of these lists, import from here.
 */
import {
  CHAT_WIDGETS_COLLECTION,
  GOAL_WIDGETS_COLLECTION,
  safeDefaultHandle,
} from './collectionHandles';
import {brand} from './brand.config.js';

/** Sticker chips for "Shop by vibe", linking into the all-products search. */
export const VIBES = [
  'Neon',
  'Celestial',
  'Sakura',
  'Spooky',
  'Cozy',
  'Y2K',
  'Multistream',
];

/** Platforms shown in the "Works with" strip, in the order they read best. */
export const WORKS_WITH_PLATFORMS = [
  'Twitch',
  'YouTube',
  'Kick',
  'TikTok',
  'OBS',
  'Streamlabs',
  'StreamElements',
];

/**
 * Mega menu panel config, keyed by the exact menu item title as it comes
 * from Shopify Admin. Anything not listed here (or any menu item whose
 * title changes in Admin) falls back to a plain link automatically, so a
 * menu edit in Admin can never blank the nav.
 * @type {Record<string, 'widgets' | 'overlays'>}
 */
export const MEGA_MENU_PANELS = {
  Widgets: 'widgets',
  Overlays: 'overlays',
};

/** Display override for a trigger's label, so "Overlays" can read as
 * covering kits too without touching the real Admin menu item title used
 * for matching above. Falls back to the item's own title when unset. */
export const MEGA_MENU_LABELS = {
  Overlays: 'Overlays & kits',
};

/**
 * Collection tiles for the Widgets mega menu panel's "Browse" column.
 * Chat/Goal `handle` here is only the fallback used when the live nav query
 * fails outright (see NavCollectionTile in Header.jsx, which prefers the
 * handle the query actually resolved). Set to the LEGACY handle on purpose:
 * legacy resolves directly before the 2026-09-28 rename and, after it,
 * Shopify's own redirect carries a legacy link forward with one 301 rather
 * than a dead link the way the current handle would 404 for the whole gap
 * before the rename happens. See app/lib/collectionHandles.js.
 */
export const WIDGET_BROWSE_TILES = [
  {
    handle: safeDefaultHandle(CHAT_WIDGETS_COLLECTION),
    label: 'Chat widgets',
    dataKey: 'chatWidgets',
  },
  {
    handle: safeDefaultHandle(GOAL_WIDGETS_COLLECTION),
    label: 'Goal widgets',
    dataKey: 'goalWidgets',
  },
  {handle: 'top-widgets', label: 'Top widgets', dataKey: 'topWidgets'},
  {handle: 'widgets', label: 'All widgets', dataKey: 'allWidgets'},
];

/** Collection tiles for the Overlays mega menu panel's "Browse" column. */
export const OVERLAY_BROWSE_TILES = [
  {handle: 'overlays', label: 'Overlay packs', dataKey: 'overlays'},
  {handle: 'bundles', label: 'Bundles', dataKey: 'bundles'},
];

/**
 * The PDP's "primary category" breadcrumb: which collection a product's
 * middle breadcrumb crumb links to, keyed off the same widgetKind() a
 * product card's Chat/Goal badge already uses (see ProductItem.jsx). `handle`
 * is the safe-default (legacy) fallback only; products.$handle.jsx resolves
 * the real live handle itself (see PRIMARY_CATEGORY_QUERY_FIELDS there) and
 * only falls back to this constant's `handle` if that live lookup comes back
 * empty. `label` always comes from here, the rename does not change it.
 * @type {Record<'Chat' | 'Goal' | 'Other', {handle: string, label: string}>}
 */
export const PDP_PRIMARY_CATEGORY = {
  Chat: {
    handle: safeDefaultHandle(CHAT_WIDGETS_COLLECTION),
    label: 'Twitch Chat Widgets',
  },
  Goal: {
    handle: safeDefaultHandle(GOAL_WIDGETS_COLLECTION),
    label: 'Twitch Goal Widgets',
  },
  Other: {handle: 'widgets', label: brand.productDomain.categoryLabel},
};

/**
 * Featured product handles for the Overlays mega panel's product cards:
 * the two seasonal stream kits, the multistream chat pack, and the Soul
 * Blade overlay pack. Same handles the homepage uses for its "Kits and
 * overlay packs" band, single-sourced here.
 */
export const OVERLAY_FEATURED_HANDLES = [
  'spooky-stream-kit',
  'celestial-stream-kit',
  'multistream-chat-widget-pack',
  'demon-samurai-stream-overlay-pack-animated-katana-goal-bar-multistream-chat-alerts-digital-download',
];

/**
 * Top-seller product handle featured in the Widgets mega panel's "Works
 * with" column. Same handle as the homepage's #1 fan favorite.
 */
export const WIDGETS_FEATURED_HANDLE =
  'neon-aesthetic-glowy-transparent-chat-and-goal-stream-widgets-minimal-neon-light-elegant-glow-theme-clean-vibe-streamelement-only';

/**
 * Curated from real Etsy data for brand.config.js's `social.etsySlug` shop
 * (etsy_list_active_listings,
 * sorted by num_favorers), matched to their Shopify handles. Used for the
 * homepage hero composite, as a fallback for Top Widgets if that collection
 * doesn't exist or is empty, and as the same fallback for `/llms.txt`.
 * Update this list periodically as Etsy favorites shift.
 */
export const FAN_FAVORITE_HANDLES = [
  WIDGETS_FEATURED_HANDLE,
  'combo-goal-widget-potion-bottle-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-and-streamelements',
  'dreamy-moon-cloud-glass-goal-widget-customisable-for-twitch-and',
  'cute-peach-glass-goal-widget-cute-minimal-customizable-goal-widget-for-twitch-streamelements-streamlabs-obs',
  'spooky-cauldron-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
  'boba-drink-cute-fruit-drink-goal-widget-for-twitch-fully-customisable-for-twitch-streamlabs-and-streamelements',
  'cute-rabbit-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-and-streamelements',
  'goth-spell-book-spooky-vibes-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-and-streamelements',
];

/**
 * Header items folded into one "Help" dropdown so the top bar only carries
 * shopping links. Keyed by the exact Shopify Admin menu item title, in the
 * order they render. Anything not listed stays a top level link, so an
 * Admin rename can never hide a page: it just pops back out as a pill.
 * @type {Record<string, string>} title -> one line description
 */
export const HELP_MENU_ITEMS = {
  'How it works': 'Install in OBS or Streamlabs in minutes',
  FAQ: 'Platforms, setup, refunds',
  Contact: 'Questions or a custom widget',
};

export const HELP_MENU_LABEL = 'Help';

/**
 * The blog, called out at the top level (2026-10-09) instead of buried
 * in Help as "Creator Hub". Matched by the Admin menu item title so the
 * Admin URL still wins; if the item is ever renamed or removed, the nav
 * appends a Blog link to `fallbackUrl` so the blog can't fall out of the
 * header.
 */
export const BLOG_MENU_ITEM = {
  title: 'Creator Hub',
  label: 'Blog',
  fallbackUrl: '/blogs/news',
};
