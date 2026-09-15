/**
 * Every environment variable this app reads, what it powers, and what
 * silently degrades when it is missing.
 *
 * This exists because there are 22 of them across two Oxygen environments,
 * Oxygen values cannot be read back once set, and nothing anywhere told you
 * which were configured. The X Conversion API sat half wired for days for
 * exactly that reason: the code was present, the credentials were not, and
 * the only symptom was a number that never moved.
 *
 * `impact` is the important column. A missing variable here never throws:
 * every consumer is written to no-op rather than break the page, which is
 * correct behaviour and also why a gap is invisible. Say what stops working
 * in plain words.
 *
 * NO VALUES EVER LEAVE THE SERVER. app/routes/admin.config.jsx reduces this
 * to {key, set, length} before it renders. Keep it that way.
 */

/** @typedef {{key: string, required?: boolean, impact: string}} ConfigVar */

export const CONFIG_GROUPS = [
  {
    id: 'storefront',
    title: 'Storefront core',
    note: 'Without these the site does not render at all, so if you are reading this page they are set.',
    vars: [
      {key: 'PUBLIC_STORE_DOMAIN', required: true, impact: 'No catalogue. Every product query fails.'},
      {key: 'PUBLIC_STOREFRONT_API_TOKEN', required: true, impact: 'No catalogue. Every product query fails.'},
      {key: 'PUBLIC_STOREFRONT_ID', impact: 'Shopify analytics cannot attribute sessions to this storefront.'},
      {key: 'PUBLIC_CHECKOUT_DOMAIN', impact: 'Checkout may leave the registrable domain, which breaks ad attribution across the cart to checkout hop.'},
      {key: 'PRIVATE_ADMIN_API_TOKEN', impact: 'Server side catalogue reads that need Admin scope fail. Storefront reads are unaffected.'},
    ],
  },
  {
    id: 'tracking',
    title: 'Conversion tracking',
    note: 'Purchase is always server side, never from the browser. See docs/conversion-tracking.md.',
    vars: [
      {key: 'PUBLIC_GA4_MEASUREMENT_ID', required: true, impact: 'No GA4 at all. No sessions, no funnel, no attribution.'},
      {key: 'PRIVATE_GA4_API_SECRET', required: true, impact: 'GA4 still records browser events, but the server side purchase never arrives. Revenue is missing from GA4.'},
      {key: 'PRIVATE_SHOPIFY_WEBHOOK_SECRET', required: true, impact: 'The orders webhook returns 503 and NO purchase reaches any destination. Every conversion is lost.'},
    ],
  },
  {
    id: 'x',
    title: 'X ads',
    note: 'Pixel q7mwb, account 18ce55rea5b. Use the SWS prefixed events, not the Shopify: ones. Conversions are relayed through sws-x-connector so no X credential lives here. See docs/analytics-setup.md.',
    vars: [
      {key: 'PUBLIC_X_PIXEL_ID', impact: 'No X pixel on the page. No upper funnel events and no conversions.'},
      {key: 'PUBLIC_X_EVENT_ID_PAGE_VIEW', impact: 'X records no page views.'},
      {key: 'PUBLIC_X_EVENT_ID_VIEW_CONTENT', impact: 'X records no product views.'},
      {key: 'PUBLIC_X_EVENT_ID_ADD_TO_CART', impact: 'X records no add to carts.'},
      {key: 'PRIVATE_X_PURCHASE_EVENT_ID', impact: 'Conversion API sends nothing. X sees traffic but never a sale, so ROAS reads zero.'},
      {key: 'PRIVATE_X_RELAY_URL', impact: 'Auth path R, preferred and in use. The sws-x-connector endpoint that signs for us, https://sws-x-connector.clarisai-consulting.workers.dev/x/conversions. Without it the app falls back to signing locally, which needs credentials copied here.'},
      {key: 'PRIVATE_X_RELAY_TOKEN', impact: 'Auth path R. The connector\'s MCP_AUTH_TOKEN. Same value the sws-x MCP sends.'},
      {key: 'PRIVATE_X_PIXEL_TOKEN', impact: 'Auth path A. Easiest: one static token from Events manager, no developer account. Without it the app falls back to the four OAuth values.'},
      {key: 'PRIVATE_X_CONSUMER_KEY', impact: 'Auth path B, OAuth 1.0a. Only needed if path A is unavailable.'},
      {key: 'PRIVATE_X_CONSUMER_SECRET', impact: 'Auth path B, OAuth 1.0a.'},
      {key: 'PRIVATE_X_ACCESS_TOKEN', impact: 'Auth path B, OAuth 1.0a.'},
      {key: 'PRIVATE_X_ACCESS_TOKEN_SECRET', impact: 'Auth path B, OAuth 1.0a.'},
    ],
  },
  {
    id: 'meta',
    title: 'Meta ads',
    note: 'Not launched. Both blank is the expected state.',
    vars: [
      {key: 'PUBLIC_META_PIXEL_ID', impact: 'No Meta pixel. Expected until Meta ads launch.'},
      {key: 'PRIVATE_META_ACCESS_TOKEN', impact: 'No Meta server side purchases. Expected until Meta ads launch.'},
    ],
  },
  {
    id: 'email',
    title: 'Email',
    vars: [
      {key: 'PRIVATE_RESEND_API_KEY', required: true, impact: 'The contact form and the newsletter signup accept input and silently discard it. This exact failure shipped once already.'},
      {key: 'PRIVATE_CONTACT_TO_EMAIL', impact: 'Contact form submissions have nowhere to go.'},
      {key: 'PRIVATE_CONTACT_FROM_EMAIL', impact: 'Outbound mail falls back to a default sender, which hurts deliverability.'},
    ],
  },
  {
    id: 'agents',
    title: 'Agents and staging',
    vars: [
      {key: 'PUBLIC_WEBMCP_ORIGIN_TRIAL_TOKEN', impact: 'WebMCP tools register for nobody. document.modelContext is undefined for ordinary visitors without an origin trial token, so every registerTool call is a silent no-op. Trial ends 2026-11-16.'},
      {key: 'PRIVATE_PREVIEW_PASSWORD', impact: 'Non production builds cannot be opened on a phone. Inert and correct on production.'},
      {key: 'PRIVATE_ADMIN_PASSWORD', impact: 'This page 404s. That is the fail closed default.'},
    ],
  },
];

/** Flat list of every key, for tests and for the CLI. */
export const ALL_CONFIG_KEYS = CONFIG_GROUPS.flatMap((g) =>
  g.vars.map((v) => v.key),
);
