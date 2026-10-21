/**
 * The one data object behind /compatibility. The picker, the grid, the
 * requirements and the checks all read from here, so a claim lives in exactly
 * one place and a status flip is a one-line edit.
 *
 * Every value is ledgered in docs/compatibility-claims.md (row ids in the
 * comments). Do not move a status up to 'works' without adding the test to the
 * ledger first. Ko-fi is deliberately absent (unshipped).
 *
 * Relative imports only, so a plain node script can import this file.
 */

/**
 * Status words. Order matters for combining: a combined answer is the LOWEST
 * ranked status of its parts, so one weak link is never hidden.
 */
export const RANK = {no: 0, untested: 1, soon: 2, some: 4, works: 5};

/**
 * Statuses the page SHOWS. 'untested' is a data-only status: it is never
 * printed. An untested combination renders as "Ask us" (a link to /discord)
 * and its notes stay hidden, so the page only carries things that work or do
 * not. Flip an untested cell to 'works' or 'no' when a test confirms it.
 * 'Beta' is a product label (see BETA), not a support status.
 */
export const STATUS = {
  works: {label: 'Works', icon: '✓'},
  some: {label: 'Some products', icon: '◆'},
  soon: {label: 'Coming soon', icon: '★'},
  no: {label: 'Not supported', icon: '✕'},
};

/** Product types, in display order. `grid: false` keeps a type out of the grid. */
export const TYPES = [
  {id: 'chat', name: 'Chat widgets', href: '/collections/frontpage', grid: true},
  {id: 'goal', name: 'Goal widgets', href: '/collections/stream-widgets-templates', grid: true},
  {id: 'alerts', name: 'Alerts', href: '/collections/frontpage', grid: true},
  {id: 'packs', name: 'Overlay packs', href: '/collections/overlays', grid: true},
  {id: 'lite', name: 'Stream Chat Lite (free)', href: '/free-chat-widget', grid: true},
  {id: 'music', name: 'Now Playing (beta)', href: '/pages/now-playing', grid: false},
];

/** One line per type, shown in the picker answer. */
export const TYPE_NOTES = {
  goal: 'Counts Twitch follows, subs, bits and StreamElements tips.', // T1, T2
  alerts: 'Built into the chat widgets: follows, subs, tips, bits and raids.', // T1 to T3
  music: 'Needs our free extension in Chrome, Brave, Edge or Opera GX.', // M9, M10, X8 Windows run
};

// Column order for the rows below: chat, goal, alerts, packs, lite, music.
const row = (chat, goal, alerts, packs, lite, music) => ({chat, goal, alerts, packs, lite, music});

/**
 * What each platform gets, per product type. Rows P1 to P11, M2 in the ledger.
 * 'some' means only the products that list the platform in their Works with
 * row. The page names them live from the same field (see the loader).
 */
export const PLATFORM_STATUS = {
  Twitch: row('works', 'works', 'works', 'works', 'works', 'works'),
  Kick: row('some', 'untested', 'untested', 'some', 'works', 'works'),
  YouTube: row('some', 'untested', 'untested', 'some', 'untested', 'works'),
  TikTok: row('some', 'some', 'untested', 'some', 'untested', 'works'),
};

/** Platforms we do not support anywhere. Row P14. One grid row each. */
export const NOT_SUPPORTED_PLATFORMS = ['Facebook Gaming', 'Trovo', 'Rumble'];

/** One-line requirements that apply to a platform and a type. Rows P6, P8, P11. */
export const PLATFORM_NOTES = {
  Kick: {lite: 'Needs your Kick channel name and chatroom number.'},
  YouTube: {lite: 'Needs your own free YouTube key.'},
  TikTok: {
    lite: 'Needs your own Euler Stream key.',
    goal: 'TikTok gifts need the free TikFinity app.', // G1
  },
};

/** What each streaming app gets, per product type. Rows S1 to S9. */
export const SOFTWARE_STATUS = {
  OBS: row('works', 'works', 'works', 'works', 'works', 'works'),
  'Streamlabs Desktop': row('works', 'works', 'works', 'works', 'works', 'works'), // S5, S6 Windows run 2026-10-03
  StreamElements: row('works', 'works', 'works', 'works', 'untested', 'untested'),
};

/** One-line requirements for a streaming app and a type. Row T4. */
export const SOFTWARE_NOTES = {
  'Streamlabs Desktop': {
    goal: 'Streamlabs tips fill the Streamlabs build of a goal widget, not the StreamElements build.',
  },
};

/**
 * Beta is a product label shown next to the status chip, never a status.
 * `platform` is optional: omit it to label the whole type.
 */
export const BETA = [{type: 'music'}, {type: 'lite', platform: 'TikTok'}];

/** @param {string} typeId @param {string} [platform] */
export function isBeta(typeId, platform) {
  return BETA.some((b) => b.type === typeId && (!b.platform || b.platform === platform));
}

/** Niconico: working in a pilot, not a listed product. Row P12. */
export const COMING_SOON = {
  name: 'Niconico',
  detail: 'Chat and gifts. Working in a live pilot. Not a listed product yet.',
};

export const PICKER_PLATFORMS = Object.keys(PLATFORM_STATUS);
export const PICKER_SOFTWARE = [...Object.keys(SOFTWARE_STATUS), 'Other'];
export const DEFAULT_PICK = {platform: 'Twitch', software: 'OBS'};

/**
 * Short, surprise-only list. Rows R1 to R7 in the ledger. The Stream Chat Lite
 * key lines are built from PLATFORM_NOTES and only appear when that platform is
 * not untested, so a flip to 'works' shows the line with no second edit.
 */
const STATIC_REQUIREMENTS = [
  'Multistream chat widgets with Kick: enter your Kick chatroom number, not only your channel name, for the most reliable connection.',
  'Goal widgets with TikTok: TikTok gifts need the free TikFinity app.',
  'Newer multistream chat widgets: YouTube needs a free YouTube key, and TikTok needs the free TikFinity desktop app.',
  'Goal widgets: Streamlabs tips fill the Streamlabs build only. The StreamElements build counts StreamElements tips.',
  'Now Playing (beta): needs our free extension, installed by hand for now. Works in Chrome, Brave, Edge and Opera GX with Suno, YouTube Music and Apple Music. SoundCloud and Spotify work in Chrome and Brave. In Edge, turn on Developer mode to install it. On free YouTube Music, ads can show up as the song. Firefox and Safari are not supported. Using another browser or music site? Ask us and we can add it.',
  'Spotify direct in Now Playing needs Spotify Premium. It follows your Spotify account, so it also works from the desktop app.',
];

export function requirements() {
  const lite = Object.entries(PLATFORM_NOTES)
    .filter(([platform, notes]) => notes.lite && PLATFORM_STATUS[platform].lite !== 'untested')
    .map(([platform, notes]) => `Stream Chat Lite and ${platform}: ${notes.lite.charAt(0).toLowerCase()}${notes.lite.slice(1)}`);
  return [...lite, ...STATIC_REQUIREMENTS];
}

/** Four quick checks. Rows B1 to B4 in the ledger. */
export const CHECKS = [
  'Did you paste all five files (HTML, CSS, JS, Fields, Data) into the matching tabs and save?',
  'Is the browser source the right size? Stream Chat Lite wants 450 wide and 900 tall. Now Playing shows its size in the extension popup.',
  'Is your platform connected? Twitch connects through your StreamElements account. Other platforms need the details in your setup guide.',
  'Is the widget in the scene you are live on? In OBS, turn off "Shutdown source when not visible", or goals and chat reset when you change scenes.',
];

/** Combine statuses: the lowest ranked one wins. */
export function combineStatus(...statuses) {
  return statuses.reduce((lowest, s) => (RANK[s] < RANK[lowest] ? s : lowest));
}

/**
 * The picker answer for one product type.
 * @param {string} platform one of PICKER_PLATFORMS
 * @param {string} software one of the SOFTWARE_STATUS keys
 * @param {{id: string}} type one of TYPES
 * @returns {{status: string, lines: string[], ask: boolean, beta: boolean, listed: boolean}}
 */
export function answerFor(platform, software, type) {
  const status = combineStatus(
    PLATFORM_STATUS[platform][type.id],
    SOFTWARE_STATUS[software][type.id],
  );
  // An untested combination shows no notes, only "Ask us".
  const lines =
    status === 'untested'
      ? []
      : [
          TYPE_NOTES[type.id],
          PLATFORM_NOTES[platform]?.[type.id],
          SOFTWARE_NOTES[software]?.[type.id],
        ].filter(Boolean);
  return {status, lines, ask: status === 'untested', beta: isBeta(type.id, platform), listed: status === 'some'};
}

/** Which statuses a table actually uses, in legend order. */
export function usedStatuses(tableStatuses) {
  const used = new Set(['works', 'no', ...tableStatuses]);
  return ['works', 'some', 'soon', 'no'].filter((s) => used.has(s));
}

const PRODUCT_TYPE_TO_ID = {
  'Chat Widget': 'chat',
  'Goal Widget': 'goal',
  'Overlay Pack': 'packs',
  Bundle: 'packs',
};

/**
 * Goal widgets that ship TikTok gift support through the free TikFinity app.
 * A fixed list, not the live field: the audit script keeps goal widgets off
 * TikTok in the product badges, and these three were confirmed in the shipped
 * code instead (ledger G1). Add a product here only after checking its zip.
 * Handles checked live 2026-10-03.
 */
export const TIKTOK_GOAL_PRODUCTS = [
  {
    handle: 'animated-moon-jar-goal-widget-twitch-sub-goal-overlay-falling-stars-tracker-instant-download',
    name: 'Moon Jar Goal Widget', // Etsy 4551047317
  },
  {
    handle: 'cute-mango-liquid-filling-goal-widget-is-fully-customisable-for-twitch-streamlabs-and-streamelements',
    name: 'Cute Mango Goal Widget', // Etsy 1902594221
  },
  {
    handle: 'twitch-liquid-combo-goal-bar-widget-vtuber-asset-alerts-streamlabs-tiktok-studio-and-streamelements',
    name: 'Liquid Combo Goal Widget', // Etsy 1775809800
  },
  {
    handle: 'nature-portion-bottle-glass-goal-widget-cute-minimal-customizable-goal-widget-for-twitch-tiktok-studio-streamelements-streamlabs-obs',
    name: 'Nature Potion Goal Widget', // Etsy 1707804164
  },
];

/**
 * Products whose live `works_with` field claims a platform their shipped code
 * does not support. Matched by handle prefix. Removed from the product lists
 * until the field is fixed (ledger W2, W3). Remove a line when the field is
 * corrected.
 */
export const NOT_ON_PLATFORM = {
  goal: {
    Kick: [
      'cute-auctopus-liquid-filling-goal-widget',
      'cute-cat-paw-alert-widget',
      'cute-froggy-goal-widget',
      'animated-star-goal-widget',
      'animated-moon-jar-goal-widget', // unproven: only gates Kick events (W2)
      'spooky-jar-goal-widget',
    ],
    YouTube: ['cute-froggy-goal-widget', 'animated-moon-jar-goal-widget', 'spooky-jar-goal-widget'],
  },
  chat: {
    TikTok: ['saber-neon-chat-widget'],
  },
};

/**
 * Group live products by the platform they list and the type they are.
 * Reads the same `custom.works_with` field the product page badges use.
 * TikTok on goal widgets comes from TIKTOK_GOAL_PRODUCTS, not from the live
 * field, so a stray field value cannot add a goal widget to that list.
 *
 * @param {Array<{handle: string, name: string, productType: string, platforms: string[]}>} products
 * @returns {Record<string, Record<string, Array<{handle: string, name: string}>>>}
 */
export function groupListed(products) {
  const out = {};
  for (const platform of ['Kick', 'YouTube', 'TikTok']) {
    out[platform] = {chat: [], goal: [], packs: []};
  }
  for (const p of products) {
    const typeId = PRODUCT_TYPE_TO_ID[p.productType];
    if (!typeId) continue;
    for (const platform of Object.keys(out)) {
      if (!p.platforms.includes(platform)) continue;
      if (platform === 'TikTok' && typeId === 'goal') continue;
      const blocked = NOT_ON_PLATFORM[typeId]?.[platform] ?? [];
      if (blocked.some((prefix) => p.handle.startsWith(prefix))) continue;
      out[platform][typeId].push({handle: p.handle, name: p.name});
    }
  }
  out.TikTok.goal = [...TIKTOK_GOAL_PRODUCTS];
  return out;
}
