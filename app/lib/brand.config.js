/**
 * THE single source of brand/store-specific literals for this storefront.
 *
 * Cloning this codebase for a new client is meant to be: copy this file,
 * fill in the new values, flip `features` off for anything the new client
 * doesn't want, and ship. Everything in app/ that used to hardcode a brand
 * name, domain, email, social URL or analytics id now imports it from here
 * instead. `npm run audit:brand-literals` fails the build if a literal
 * leaks back out into app/ outside this file (see scripts/audit-brand-literals.mjs
 * and scripts/brand-literals.allowlist.json for the narrow, reasoned
 * exceptions that script accepts).
 *
 * See also `app/lib/brand.config.example.js`, a filled-in example for a
 * fictional client, used to prove this file is the only thing that has to
 * change to reskin the site.
 */

/** @typedef {{name: string, catalogNoun: string, platforms: string[]}} ProductDomain */

export const brand = {
  /** Display brand name, used in titles, alt text, JSON-LD, vendor fallback. */
  name: 'Stream Widget Shop',
  /** Short form, used where a full name is too long (nav crumbs, tight UI). */
  shortName: 'SWS',
  /** Registered legal entity. Not currently rendered anywhere; here so a
   * clone's legal footer/invoices/contracts have one source to read from. */
  legalName: 'Stream Widget Shop LLC',

  /** Bare domain, no scheme. Used to build CSP allowlist entries and any
   * "https://<domain>" string that used to be hardcoded. */
  domain: 'streamwidgetshop.com',
  /** Canonical production origin (scheme + domain, no trailing slash). */
  origin: 'https://streamwidgetshop.com',

  /** Support/contact inbox, shown on the contact page and in policy text
   * (ContactPage.jsx / policyContent.js / notify.server.js). */
  supportEmail: 'streamwidgetshop@gmail.com',
  /** "From" display name + address for outbound Stream Chat Lite email
   * (freeChatEmail.server.js). Address's domain must match `domain` above
   * for the DMARC-alignment check that file also does. */
  chatFromEmail: {
    name: 'Stream Widget Shop',
    address: 'chat@streamwidgetshop.com',
  },

  logo: {
    // Actual image assets are swapped via `npm run logo`,
    // not through this config, these are just the alt text / JSON-LD name
    // strings that used to be hardcoded next to each <img>.
    alt: 'Stream Widget Shop',
  },

  social: {
    x: 'https://x.com/streamwidget',
    xHandle: '@streamwidget',
    etsy: 'https://www.etsy.com/shop/StreamWidgetShop',
    /** Etsy shop slug alone (no URL), for icon labels/aria and any place
     * that needs just the slug rather than the full etsy.com URL. */
    etsySlug: 'StreamWidgetShop',
    // Discord invite stays owned by app/lib/discord.js (DISCORD_INVITE) -
    // it is imported from there, not duplicated here, so the one-line
    // "change the invite" workflow documented in that file keeps working.
  },

  seo: {
    defaultTitle:
      'Stream Widget Shop | Twitch, Multistream Chat + Goal Widgets',
    defaultDescription:
      'Animated chat and goal widgets for Twitch, YouTube, and multistream.',
    // app/assets/og-image.jpg is imported directly where needed (Vite asset
    // pipeline needs a static import path); this is the file name only, for
    // reference/documentation.
    ogImageAsset: 'og-image.jpg',
  },

  analytics: {
    // Prefer the env var (PUBLIC_GA4_MEASUREMENT_ID, set on Oxygen); this is
    // only the fallback/reference id used in the channel manifest and in
    // code comments that needed a concrete example. A clone sets its own
    // env var and never touches this.
    ga4MeasurementIdFallback: 'G-X0978HDVTK',
  },

  theme: {
    // Matches --sws-bg in app/styles/app.css (the site's actual page
    // background, deep space purple-black) -- this is what a mobile
    // browser's own chrome (tab bar / status bar) tints to via
    // <meta name="theme-color">, so it should equal the page background
    // the visible header/body sit on, not the holo accent gradient.
    color: '#0b0713',
  },

  /**
   * Free Chat Lite hosted widget (chat.streamwidgetshop.com). Kept separate
   * from `domain` because it is a different subdomain/service, not the
   * storefront's own origin.
   */
  freeChat: {
    mintUrl: 'https://chat.streamwidgetshop.com/api/mint',
    kickUrlBase: 'https://chat.streamwidgetshop.com/api/kick',
    widgetBaseUrl: 'https://chat.streamwidgetshop.com/v1/',
  },

  /**
   * Feature flags for SWS-only modules. All default true for SWS itself.
   * A clone flips the ones it doesn't want to false; the module/route stays
   * in the codebase (never deleted) and becomes a no-op / 404 / null render
   * instead, per feature. See brand.config.example.js.
   */
  features: {
    /** app/lib/freeChat*.js, app/routes/free-chat-widget*.jsx */
    freeChat: true,
    /** app/lib/platforms.js, app/lib/ipTerms.js (platform/works-with badges) */
    platformBadges: true,
    /** app/lib/discord.js, app/routes/discord.jsx */
    discord: true,
    /** PUBLIC_WEBMCP_ORIGIN_TRIAL_TOKEN-gated WebMCP integration */
    webmcp: true,
  },

  /**
   * Generic site-copy words for this shop's product category. Used ONLY in
   * nav/footer/SEO-default/llms.txt copy, never in product-specific logic
   * or data (that stays real Shopify catalog data regardless of client).
   * @type {ProductDomain}
   */
  productDomain: {
    catalogNoun: 'stream widgets',
    /** e.g. "animated chat widgets, goal widgets and overlay packs" */
    itemsDescription: 'animated chat widgets, goal widgets, and overlay packs',
    /** Fallback `productType`/`g:product_type` value when a product has none
     * set in Shopify (productFeed.js, productFeedCsv.js). Singular, matches
     * Google Merchant's own product_type field shape. */
    defaultProductType: 'Stream Widget',
    /** Label for the catch-all "Other" PDP breadcrumb category
     * (app/lib/nav.js `PDP_PRIMARY_CATEGORY.Other`), and anywhere else that
     * needs the plural, generic category name rather than a specific
     * collection title. */
    categoryLabel: 'Stream Widgets',
    platforms: [
      'Twitch',
      'YouTube',
      'Kick',
      'TikTok',
      'OBS',
      'Streamlabs',
      'StreamElements',
    ],
  },

  /**
   * Shopify sales-channel display names as configured in Admin (Hydrogen ->
   * <this app> -> Customer Account API, and Sales channels -> Headless).
   * Purely descriptive strings shown on the internal /products_preview
   * troubleshooting page; renaming the actual Shopify channel does not
   * rename these automatically, they are correct as of the channels this
   * repo was set up against.
   */
  channels: {
    headlessName: 'Stream Widget Shop Headless',
    hydrogenAppName: 'SWS Storefront',
  },
};

export default brand;
