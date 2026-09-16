/*
 * Per-article chat content.
 *
 * Todd, 2026-09-15, on the first full set: "these all look too similar",
 * "images are exactly the same almost". The cause was not palette and not
 * layout. Every chat widget was captured ONCE and reused, so all 30-odd chat
 * heroes showed the identical five messages from the identical five avatars.
 * At card size that is the dominant visual, and no amount of background
 * treatment hides it.
 *
 * So the feed is now drawn per article, deterministically from its handle: same
 * article always renders the same way (a re-render is a real diff, not noise),
 * different articles never match.
 *
 * Lines are generic stream chatter on purpose. No invented streamer names
 * presented as customers, no fabricated testimonials: see
 * sws-content-no-fake-social-proof.
 */

export const NAMES = [
  'moonbeam_gg', 'velvetmoth', 'astra_dawn', 'pixiedust_44', 'nightowl22',
  'lunaflux', 'nebula_kit', 'cozycryptid', 'static_bloom', 'jellybyte',
  'orbit_kat', 'ferngully', 'wispward', 'halcyon_ray', 'plumcircuit',
  'sableglow', 'mothmilk', 'quietstorm', 'dustbunny_tv', 'echolily',
  'tinseltoad', 'vanta_pip', 'sugarstatic', 'clovernaut', 'gloamer',
];

/* Grouped so a themed article gets lines that suit it. GENERAL works anywhere
   and is the fallback for articles with no theme. */
export const LINES = {
  general: [
    'this looks so clean', 'ok the layout goes hard', 'what overlay is this',
    'the glow is perfect', 'chat has never looked better', 'stealing this setup',
    'first time here, love the vibe', 'this is so readable', 'no lag at all',
    'the animation is smooth', 'wait it does that too', 'need this immediately',
    'how is this transparent', 'that transition is nice', 'it matches your cam perfectly',
  ],
  celestial: [
    'the moon goal is almost full', 'stars are twinkling again', 'starry night theme',
    'this is so dreamy', 'the constellations move', 'moon phase overlay when',
  ],
  cozy: [
    'so cozy in here', 'the frogs are adorable', 'rain sounds and this overlay',
    'cottagecore stream supremacy', 'this is comfort content', 'the little mushrooms',
  ],
  neon: [
    'the neon is so crisp', 'this glow over gameplay', 'cyberpunk vibes',
    'chrome and pink, yes', 'it reads even on bright scenes', 'that outline is clean',
  ],
  goal: [
    'goal bar is almost full', 'lets fill that bar', 'we can hit the goal tonight',
    'the fill animation is satisfying', 'almost at target', 'tip goal going up',
  ],
  multistream: [
    'every platform in one box', 'kick chat showing up too', 'youtube gang here',
    'nice, all the chats merged', 'finally one chat window', 'twitch and kick together',
  ],
  platform: [
    'is streamelements really closing', 'what are you switching to',
    'glad these still work', 'do these need streamelements', 'good to know',
  ],
};

/** Deterministic PRNG from a string, so a handle always yields the same feed. */
export function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function () {
    h += 0x6D2B79F5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BADGES = [[], [{type: 'subscriber'}], [{type: 'moderator'}], [{type: 'vip'}], []];

/**
 * Build a chat feed unique to one article.
 *
 * @param {string} handle article handle, the seed
 * @param {string} theme  which LINES group to prefer
 * @param {number} count  how many messages
 */
export function chatFor(handle, theme = 'general', count = 5) {
  const rnd = seeded(handle);
  const pick = (arr, used) => {
    for (let i = 0; i < 40; i++) {
      const v = arr[Math.floor(rnd() * arr.length)];
      if (!used.has(v)) { used.add(v); return v; }
    }
    return arr[0];
  };

  // Mix themed lines with general ones so a themed article still reads like a
  // real chat rather than six variations on one topic.
  const themed = LINES[theme] || [];
  const pool = [...themed, ...LINES.general];
  const usedLines = new Set();
  const usedNames = new Set();

  return Array.from({length: count}, (_, i) => ({
    nick: pick(NAMES, usedNames),
    text: pick(i < 2 && themed.length ? themed : pool, usedLines),
    badges: BADGES[Math.floor(rnd() * BADGES.length)],
  }));
}

/** Tip amount and tipper, also per article, so the alert row differs too. */
export function tipFor(handle) {
  const rnd = seeded(handle + ':tip');
  const amounts = [5, 10, 15, 20, 25, 30, 40, 50, 75, 100];
  return {
    name: NAMES[Math.floor(rnd() * NAMES.length)],
    amount: amounts[Math.floor(rnd() * amounts.length)],
  };
}
