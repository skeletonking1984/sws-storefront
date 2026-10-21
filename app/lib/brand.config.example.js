/**
 * Example filled-in brand.config.js for a fictional client, "Example Goods".
 *
 * Not imported by the app. This exists so a clone (and this task's own
 * verification pass) has something concrete to swap in for
 * app/lib/brand.config.js and prove the site still builds and runs with
 * every SWS-only feature turned off.
 *
 * To use it for real: rename this file to `brand.config.js` (replacing the
 * SWS one) and delete this file, or for a quick local check, temporarily
 * `cp app/lib/brand.config.example.js app/lib/brand.config.js` and revert
 * after.
 */

export const brand = {
  name: 'Example Goods',
  shortName: 'EG',
  legalName: 'Example Goods LLC',

  domain: 'example.com',
  origin: 'https://example.com',

  supportEmail: 'hello@example.com',
  chatFromEmail: {
    name: 'Example Goods',
    address: 'chat@example.com',
  },

  logo: {
    alt: 'Example Goods',
  },

  social: {
    x: 'https://x.com/examplegoods',
    xHandle: '@examplegoods',
    etsy: 'https://www.etsy.com/shop/ExampleGoods',
  },

  seo: {
    defaultTitle: 'Example Goods | Digital Downloads for Creators',
    defaultDescription: 'Digital downloads for creators, made simple.',
    ogImageAsset: 'og-image.jpg',
  },

  analytics: {
    ga4MeasurementIdFallback: 'G-0000000000',
  },

  theme: {
    color: '#3366FF',
  },

  // Example Goods has no Free Chat Lite hosted service; these URLs are
  // unused while features.freeChat is false, kept only so the shape stays
  // valid if the flag is ever flipped back on.
  freeChat: {
    mintUrl: 'https://chat.example.com/api/mint',
    kickUrlBase: 'https://chat.example.com/api/kick',
    widgetBaseUrl: 'https://chat.example.com/v1/',
  },

  // Every SWS-only module OFF: this is the point of the example. Modules
  // stay in the codebase (never deleted) and become no-ops / 404s / null
  // renders instead. See the brand-config task's "remaining gap" list for
  // what still leaked SWS-specific behavior when this was tried for real.
  features: {
    freeChat: false,
    platformBadges: false,
    discord: false,
    webmcp: false,
  },

  productDomain: {
    catalogNoun: 'digital downloads',
    itemsDescription: 'templates, presets, and digital toolkits',
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
};

export default brand;
