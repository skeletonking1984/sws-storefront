/**
 * Single source for nav/search config shared between the homepage sections
 * (Shop by vibe, Works with, kits) and the header mega menu / search
 * palette. Don't paste second copies of these lists, import from here.
 */

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
 * Handles are real and counterintuitive, don't "fix" them: Chat Widget
 * lives at `frontpage`, Goal Widget at `stream-widgets-templates`.
 */
export const WIDGET_BROWSE_TILES = [
  {handle: 'frontpage', label: 'Chat widgets', dataKey: 'chatWidgets'},
  {
    handle: 'stream-widgets-templates',
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
 * Curated from real StreamWidgetShop Etsy data (etsy_list_active_listings,
 * sorted by num_favorers), matched to their Shopify handles. Used for the
 * homepage hero composite, as a fallback for Top Widgets if that collection
 * doesn't exist or is empty, and as the same fallback for `/llms.txt`.
 * Update this list periodically as Etsy favorites shift.
 */
export const FAN_FAVORITE_HANDLES = [
  WIDGETS_FEATURED_HANDLE,
  'combo-goal-widget-potion-bottle-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
  'dreamy-moon-cloud-glass-goal-widget-customisable-for-twitch-and-tiktok-studio',
  'cute-peach-glass-goal-widget-cute-minimal-customizable-goal-widget-for-twitch-tiktok-studio-streamelements-streamlabs-obs',
  'spooky-cauldron-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
  'boba-drink-cute-fruit-drink-goal-widget-for-twitch-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
  'cute-rabbit-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
  'goth-spell-book-spooky-vibes-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-tiktok-studio-and-streamelements',
];
