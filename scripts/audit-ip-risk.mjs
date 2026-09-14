/**
 * Scans every LIVE product on BOTH channels for intellectual property risk.
 *
 * Shopify is scanned by title and handle, Etsy by listing title. Etsy is
 * about 99% of revenue, so a check that covered only Shopify was checking
 * the small half: on 2026-09-14 Shopify was clean at 0 of 123 while Etsy
 * had 4 live listings carrying Charizard, Among Us, Valorant Brimstone and
 * a Star Wars zip. Two of those were the same products already hidden on
 * Shopify, hidden on one channel only.
 *
 *   node scripts/audit-ip-risk.mjs
 *
 * Exits 1 if any live product matches a known IP term, 0 otherwise. The
 * "needs a human look" list never fails the run on its own.
 *
 * WHY: this shop has repeatedly listed widgets named after someone else's
 * property. Four Pokemon widgets and a Genshin one were set to DRAFT on
 * 2026-09-11, a Star Wars named widget the same day, and two Valorant ones
 * on 2026-09-14. Every one of them was found by a person noticing, not by
 * a check. Ad spend pointed at a catalogue containing someone else's IP
 * risks the ad ACCOUNT, not just the listing, which is a much more
 * expensive failure than a takedown.
 *
 * Two layers on purpose, because Todd's instruction was "all types, we
 * dont need isues" and a word list cannot anticipate:
 *
 *   1. DENY, deterministic. A curated term list across games, film and TV,
 *      anime, characters, corporate brands, music and sports. A hit here
 *      is a hard failure.
 *   2. REVIEW, heuristic. Any capitalised word in a title that is not a
 *      recognised generic, platform, colour or material gets surfaced for
 *      a human. Expect false positives; that is the correct trade, since
 *      the cost of reading a few extra names is nothing next to the cost
 *      of missing one.
 *
 * When a new risky name is found, ADD IT to DENY_TERMS so the deterministic
 * layer catches it next time. The heuristic is the net, the list is the
 * memory.
 */

import fs from 'node:fs';
import {listActiveListings} from '../../sws-etsy-mcp/dist/api.js';

const DENY_TERMS = {
  Games: [
    'valorant', 'brimstone', 'jett', 'sage', 'reyna', 'waylay', 'riot games',
    'genshin', 'hoyoverse', 'zelda', 'mario', 'luigi', 'sonic the', 'minecraft',
    'fortnite', 'among us', 'roblox', 'overwatch', 'apex legends',
    'league of legends', 'fall guys', 'stardew', 'terraria', 'elden ring',
    'dark souls', 'call of duty', 'halo', 'pokemon', 'pokémon', 'pikachu',
    'charizard', 'eevee', 'bulbasaur', 'squirtle', 'nintendo', 'kirby',
    'metroid', 'animal crossing', 'splatoon', 'undertale', 'hollow knight',
    'cuphead', 'skyrim', 'witcher', 'cyberpunk 2077', 'the sims',
  ],
  'Film and TV': [
    'star wars', 'jedi', 'sith', 'lightsaber', 'mandalorian', 'baby yoda',
    'grogu', 'disney', 'marvel', 'avengers', 'spider-man', 'spiderman',
    'batman', 'superman', 'harry potter', 'hogwarts', 'lord of the rings',
    'stranger things', 'grinch', 'pixar', 'dreamworks', 'netflix',
  ],
  'Anime and manga': [
    'demon slayer', 'naruto', 'one piece', 'dragon ball', 'attack on titan',
    'jujutsu kaisen', 'sailor moon', 'totoro', 'ghibli', 'my hero academia',
    'death note', 'evangelion', 'chainsaw man', 'spy x family',
    'hatsune miku', 'vocaloid',
  ],
  'Characters and licensed cute': [
    'hello kitty', 'sanrio', 'kuromi', 'cinnamoroll', 'my melody', 'pusheen',
    'care bears', 'pepe the', 'pepega', 'wojak', 'bugs bunny', 'snoopy',
    'garfield', 'winnie the pooh', 'tamagotchi',
  ],
  'Corporate brands': [
    'starbucks', 'nike', 'adidas', 'coca-cola', 'coca cola', 'pepsi',
    'monster energy', 'red bull', 'mcdonald', 'playstation', 'xbox',
    'nvidia', 'razer', 'elgato', 'discord inc',
  ],
  Music: [
    'taylor swift', 'beyonce', 'beyoncé', 'billie eilish', 'bts ', 'blackpink',
    'spotify', 'kanye', 'ariana grande',
  ],
  Sports: [
    'nfl', 'nba', 'fifa', 'premier league', 'manchester united', 'real madrid',
    'lakers', 'yankees', 'olympics', 'super bowl', 'uefa',
  ],
};

/**
 * Words that legitimately appear capitalised in these titles and are not a
 * name for anything. Kept deliberately broad: this only suppresses noise in
 * the REVIEW layer, it can never suppress a DENY hit.
 */
const KNOWN_SAFE = new Set(
  `twitch youtube kick tiktok obs streamlabs streamelements discord vtuber
   chat goal widget widgets overlay overlays alert alerts bar bars tracker
   sub subs subscriber donation donations follower followers bits tip tips
   stream streamer streaming digital download instant customisable
   customizable animated liquid filling progress theme themes combo pack
   kit bundle studio browser source scene transparent glow glowy neon
   pastel kawaii cozy cute minimal minimalist elegant modern retro y2k
   glass glassy crystal chrome holographic gradient aesthetic dreamy spooky
   halloween christmas winter spring summer autumn fall valentine easter
   moon star stars sun cloud clouds celestial galaxy cosmic space lunar
   solar sakura floral flower flowers petal lotus butterfly rose cherry
   blossom nature plants forest ocean sea water fire ice snow rain
   cat kitten dog puppy bunny rabbit frog froggy panda bear fox owl whale
   octopus seahorse snail squirrel chicken cow seal bat ghost skull skeleton
   pumpkin cauldron potion spell book witch demon samurai angel devil heart
   hearts love broken diamond gem jar bottle boba drink peach mango matcha
   scrapbook notebook kraft cottagecore goth gothic dark light purple pink
   blue green red white black gold silver rainbow multi multistream
   one click install installation setup guide file files code pronouns
   badges emotes emote for and the with only plus new best top premium
   shop stream widget the a an of to in on at is it
   fill streams vibe vibes starry loading mystical asset animation night
   clean streamelement streamlements streamers card line bubble spider
   style auctopus fully moth photo shutter horse machine arcade toast slot
   icon first melting tarot giving candy cane holly leaves gloves santa
   skewered simple dessert sand timer arrow deco bloodworm insects sticker
   real falling physics glowing katana skins names false`
    .split(/\s+/)
    .filter(Boolean),
);

const env = Object.fromEntries(
  fs
    .readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1).replace(/^["']|["']$/g, '')];
    }),
);

const QUERY = `query($c:String){
  products(first:250, after:$c){
    pageInfo{hasNextPage endCursor}
    nodes{ title handle }
  }
}`;

async function allLiveProducts() {
  let cursor = null;
  const out = [];
  do {
    const res = await fetch(
      `https://${env.PUBLIC_STORE_DOMAIN}/api/2025-07/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN,
        },
        body: JSON.stringify({query: QUERY, variables: {c: cursor}}),
      },
    );
    const json = await res.json();
    if (json.errors) throw new Error(JSON.stringify(json.errors).slice(0, 300));
    out.push(...json.data.products.nodes);
    cursor = json.data.products.pageInfo.hasNextPage
      ? json.data.products.pageInfo.endCursor
      : null;
  } while (cursor);
  return out;
}

const products = await allLiveProducts();

/**
 * Etsy listings. Requires ETSY_PACKAGE_ROOT, or the shared client resolves
 * its token file from process.cwd() and fails with a misleading
 * "Not authorized yet. Run `npm run authorize` first."
 */
let etsyListings = [];
let etsyError = null;
try {
  etsyListings = await listActiveListings(undefined);
} catch (error) {
  etsyError = error.message;
}

console.log(
  `Scanned ${products.length} live Shopify products` +
    (etsyError
      ? ' (Etsy scan FAILED, see below).\n'
      : ` and ${etsyListings.length} active Etsy listings.\n`),
);

// ---- layer 1: deny list --------------------------------------------------
const rows = [
  ...products.map((p) => ({
    channel: 'Shopify',
    label: p.title,
    ref: p.handle,
    haystack: `${p.title} ${p.handle}`,
  })),
  ...etsyListings.map((l) => ({
    channel: 'Etsy',
    label: l.title,
    ref: String(l.listing_id),
    haystack: l.title || '',
  })),
];

const denied = [];
for (const row of rows) {
  const haystack = row.haystack.toLowerCase();
  for (const [category, terms] of Object.entries(DENY_TERMS)) {
    const matched = terms.filter((term) => haystack.includes(term));
    if (matched.length) denied.push({row, category, matched});
  }
}

if (denied.length) {
  console.log('IP TERM MATCHES, these are live right now:');
  for (const hit of denied) {
    console.log(`  [${hit.row.channel}] [${hit.category}] ${hit.matched.join(', ')}`);
    console.log(`      ${hit.row.label}`);
    console.log(`      ${hit.row.ref}`);
  }
} else {
  console.log('Deny list: no live product on either channel matches a known IP term.');
}

// ---- layer 2: unrecognised proper nouns ----------------------------------
const review = new Map();
for (const product of products) {
  // Skip the first word of the title, which is capitalised by convention.
  const words = product.title.split(/[\s|•·,:()\/&-]+/).slice(1);
  for (const raw of words) {
    const word = raw.replace(/[^A-Za-z'-]/g, '');
    if (word.length < 4) continue;
    if (!/^[A-Z][a-z]+$/.test(word)) continue; // Capitalised, not ALL CAPS
    if (KNOWN_SAFE.has(word.toLowerCase())) continue;
    if (!review.has(word)) review.set(word, []);
    review.get(word).push(product.title);
  }
}

const sorted = [...review.entries()].sort((a, b) => b[1].length - a[1].length);
if (sorted.length) {
  console.log(
    `\nNames not on any list, worth a human look (${sorted.length}).`,
  );
  console.log('False positives are expected here and are cheaper than a miss:');
  for (const [word, titles] of sorted.slice(0, 20)) {
    console.log(`  ${word}  (${titles.length}x)  eg ${titles[0].slice(0, 62)}`);
  }
  if (sorted.length > 20) console.log(`  ... and ${sorted.length - 20} more`);
} else {
  console.log('\nNo unrecognised capitalised names in any live title.');
}

if (etsyError) {
  console.log(`\nFAIL: the Etsy half of this scan did not run: ${etsyError}`);
  console.log(
    '  Run it with ETSY_PACKAGE_ROOT=/Users/todd/Documents/orgs/SWS/repos/sws-etsy-mcp',
  );
  console.log(
    '  A green Shopify result alone is NOT a pass. Etsy is about 99% of revenue.',
  );
}

// Never print an OK line next to a failure. A partial scan that says "OK"
// anywhere is worse than one that says nothing, because OK is the word
// people read and act on.
if (denied.length) {
  console.log(`\nFAIL: ${denied.length} live listing(s) carry a known IP term.`);
} else if (etsyError) {
  console.log('\nFAIL: incomplete scan. Shopify is clean, Etsy was NOT checked.');
} else {
  console.log('\nOK: no live listing on either channel carries a known IP term.');
}

process.exit(denied.length || etsyError ? 1 : 0);
