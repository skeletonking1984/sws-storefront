/**
 * Catalog description normalizer.
 *
 * Every live product description is currently bespoke: 52 are raw Etsy plain
 * text, 67 are loose HTML, and only 12 follow anything like a template. This
 * script derives a structured fact sheet per product, renders one standard
 * description from it, and emits both so the same facts can drive PDP copy AND
 * metafield-backed filtering.
 *
 *   node scripts/normalize-descriptions.mjs <catalog.json> <outdir>
 *
 * Reads the catalog dump, writes:
 *   facts.json    one record per product (metafield values + generated HTML)
 *   review.md     human-readable before/after + everything needing a decision
 *
 * This script never writes to Shopify. Pushing is a separate, deliberate step.
 */

import fs from 'node:fs';

/* ------------------------------------------------------------------ facts */

const PLATFORMS = {
  Twitch: /twitch/i,
  YouTube: /you\s*tube/i,
  Kick: /\bkick\b/i,
  TikTok: /tik\s*tok(?!\s*studio)/i,
};

const HOSTS = {
  StreamElements: /stream\s*elements?/i,
  Streamlabs: /stream\s*labs/i,
  OBS: /\bobs\b/i,
  'TikTok Studio': /tik\s*tok\s*studio/i,
};

const GOAL_TYPES = {
  Donation: /donation/i,
  Follower: /follower/i,
  Bits: /\bbits\b/i,
  Subscriber: /\bsubs?\b|subscriber/i,
  Tips: /\btips?\b/i,
  Raids: /\braids?\b/i,
};

const CUSTOMIZATION = {
  Colors: /colou?rs?\b/i,
  Fonts: /\bfonts?\b/i,
  'Font size': /font size/i,
  Pronouns: /pronoun/i,
  Badges: /badge/i,
  'Role icons': /role icons?/i,
  'Message limit': /message limit/i,
  'Ignore users': /ignore (specific )?users/i,
  'Message alignment': /top or bottom/i,
};

/** Aesthetic families, checked against the title in this order. */
const THEMES = [
  ['Halloween', /\b(halloween|spooky|ghost|skull|pumpkin|cauldron|witch|potion|devil|demon|bat)\b/i],
  ['Celestial', /\b(moon|stars?|galaxy|cosmic|celestial|space|planet|astro|luna|nebula)\b/i],
  ['Floral', /\b(sakura|lotus|flowers?|floral|petals?|butterfly|garden|rose)\b/i],
  ['Cozy', /\b(cozy|cottagecore|matcha|scrapbook|book|nature|mushroom|frog|froggy|tea)\b/i],
  ['Y2K', /\b(y2k|sticker|retro|pixel|arcade|vaporwave)\b/i],
  ['Neon', /\b(neon|glow|glowy|cyber|saber|synth)\b/i],
  ['Kawaii', /\b(kawaii|cute|pastel|bunny|rabbit|cat|kitty|angel)\b/i],
  ['Gaming', /\b(valorant|gaming|controller|fps|minecraft|brimstone)\b/i],
  ['Minimal', /\b(minimal|clean|simple|glass|transparent|elegant|line)\b/i],
];

/** @param {any} product @returns {string} */
function plainText(product) {
  return `${product.descriptionHtml || ''}`
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ');
}

/** @param {Record<string,RegExp>} table @param {string} text @returns {string[]} */
function matches(table, text) {
  return Object.entries(table)
    .filter(([, pattern]) => pattern.test(text))
    .map(([label]) => label);
}

/**
 * Host support has to respect negative signals. Plenty of these listings say
 * "StreamElements Only" or "THIS ITEM IS FOR OBS/OBS STUDIO AND STREAMELEMENTS"
 * while still name-dropping Streamlabs elsewhere, and claiming support the
 * product does not have is worse than claiming too little.
 * @param {string} text
 * @param {string} title
 * @returns {{hosts: string[], confident: boolean}}
 */
function detectHosts(text, title) {
  const all = `${title} ${text}`;
  if (/stream\s*elements?\s*only/i.test(all)) {
    return {hosts: ['StreamElements'], confident: true};
  }
  const declared = /(?:compatible with|this item is for)\s*:?\s*([^.!?]{0,120})/i.exec(
    all,
  );
  if (declared) {
    const found = matches(HOSTS, declared[1]);
    if (found.length) return {hosts: found, confident: true};
  }
  const found = matches(HOSTS, all);
  return {hosts: found, confident: found.length > 0};
}

/**
 * Platforms are only claimed when the listing ties them to the widget rather
 * than merely mentioning them. A "Twitch chat widget" title counts; the word
 * "twitch" inside an unrelated sentence does not, on its own, mean multistream.
 * @param {string} text
 * @param {string} title
 * @returns {{platforms: string[], multistream: boolean, confident: boolean}}
 */
function detectPlatforms(text, title) {
  const all = `${title} ${text}`;
  const found = matches(PLATFORMS, all);
  const multistream =
    /multi\s*stream|multistream|all (?:your )?platforms|one (?:chat )?feed/i.test(
      all,
    ) || found.length >= 3;
  // "StreamElements Only" widgets are Twitch-side integrations in this catalog.
  if (/stream\s*elements?\s*only/i.test(all) && !multistream) {
    return {platforms: ['Twitch'], multistream: false, confident: true};
  }
  return {platforms: found, multistream, confident: found.length > 0};
}

/** @param {string} title @returns {string} */
function detectWidgetType(title) {
  const t = title.toLowerCase();
  const chat = /\bchat\b/.test(t);
  const goal = /\bgoal\b/.test(t);
  if (chat && goal) return 'Chat + Goal';
  if (chat) return 'Chat';
  if (goal) return 'Goal';
  if (/\balerts?\b/.test(t)) return 'Alert';
  if (/emote/.test(t)) return 'Emotes';
  if (/overlay|scene|banner/.test(t)) return 'Overlay';
  return 'Other';
}

/** @param {string} title @returns {string} */
function detectTheme(title) {
  for (const [label, pattern] of THEMES) {
    if (pattern.test(title)) return label;
  }
  return 'Other';
}

/* ------------------------------------------------------------------ intro */

const BOILERPLATE =
  /instant digital download|files are available immediately|no physical product|no refunds|redistribution|not for redistribution|our policy|need help|feel free to contact|questions\?|digital product only|available for digital download/i;

/** Section labels we regenerate, so their original text is dropped. */
const SECTION_LABEL =
  /^(features?|goal types?( supported)?|compatible with|works (for streams on|with)|files included|what you get|installation|perfect for|bonus|why choose|instant digital download|important|personalisations?|types of goals|you will receive|our policy)\b/i;

/**
 * Pulls the product-specific opening prose out of whatever shape the original
 * description is in, and drops the parts the template regenerates: the title
 * restatement, section labels, bullet lists, and the shared legal boilerplate.
 * @param {any} product
 * @returns {string}
 */
function extractIntro(product) {
  const raw = product.descriptionHtml || '';
  const isHtml = /<(p|br|div|ul|strong)\b/i.test(raw);
  const chunks = isHtml
    ? raw.split(/<\/p\s*>|<p\b[^>]*>|<br\b[^>]*>/i)
    : raw.split(/\n/);

  const titleWords = new Set(
    product.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter(Boolean),
  );

  const sentences = [];
  for (const chunk of chunks) {
    const line = chunk
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/\*\*/g, '')
      .replace(/#(\w+)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
      // strip leading emoji / bullets
      .replace(
        /^(?:[\u{1F000}-\u{1FAFF}\u{2190}-\u{2BFF}]\u{FE0F}?|[-–—*•])+\s*/u,
        '',
      );

    if (!line || line.length < 40) continue;
    if (BOILERPLATE.test(line)) continue;
    if (SECTION_LABEL.test(line)) continue;
    if (/^this item is for/i.test(line)) continue;

    // A line that is just the product name again adds nothing under the <h1>.
    const words = line.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter(Boolean);
    const overlap = words.filter((w) => titleWords.has(w)).length / words.length;
    if (overlap > 0.8) continue;

    sentences.push(line);
    if (sentences.join(' ').length > 260) break;
  }
  return sentences.join(' ').trim();
}

/* --------------------------------------------------------------- template */

/** @param {string[]} items @returns {string} */
function list(items) {
  return `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
}

/**
 * Renders the one standard description. Sections are always in this order and
 * a section is omitted rather than shown empty. Shared legal/support
 * boilerplate is deliberately NOT included: it is identical on every product,
 * so the PDP renders it once instead of storing 119 copies of it.
 * @param {any} facts
 * @returns {string}
 */
function renderDescription(facts) {
  const out = [];
  if (facts.intro) out.push(`<p>${facts.intro}</p>`);

  if (facts.features.length) {
    out.push('<h3>Features</h3>', list(facts.features));
  }
  if (facts.customization.length) {
    out.push('<h3>Customization</h3>', list(facts.customization));
  }
  if (facts.goal_types.length) {
    out.push('<h3>Goal types supported</h3>', list(facts.goal_types));
  }
  if (facts.works_with.length) {
    out.push('<h3>Works with</h3>', list(facts.works_with));
  }
  if (facts.platforms.length) {
    out.push('<h3>Platforms</h3>', list(facts.platforms));
  }
  if (facts.included.length) {
    out.push('<h3>What you get</h3>', list(facts.included));
  }
  out.push(
    '<h3>Installation</h3>',
    list([
      `Upload the widget to ${facts.works_with.filter((h) => h === 'StreamElements' || h === 'Streamlabs').join(' or ') || 'StreamElements'}`,
      'Add it as a Browser Source in OBS',
      'Customize colors, fonts and settings to match your scene',
    ]),
  );
  return out.join('\n');
}

/* ------------------------------------------------------------------- main */

/** @param {any} product @returns {any} */
function buildFacts(product) {
  const text = plainText(product);
  const {hosts, confident: hostsOk} = detectHosts(text, product.title);
  const {platforms, multistream, confident: platformsOk} = detectPlatforms(
    text,
    product.title,
  );
  const widgetType = detectWidgetType(product.title);
  const isGoal = widgetType === 'Goal' || widgetType === 'Chat + Goal';
  const isChat = widgetType === 'Chat' || widgetType === 'Chat + Goal';

  const customization = matches(CUSTOMIZATION, text);
  const declaredGoals = /types? of goals?\s*:?\s*([^.\n]{0,120})/i.exec(text);
  const goalTypes = isGoal
    ? matches(GOAL_TYPES, declaredGoals ? declaredGoals[1] : text)
    : [];

  const features = [];
  if (isChat) features.push('Live chat feed with event alerts in the chat');
  if (isGoal) features.push('Animated goal that fills as support comes in');
  if (multistream) {
    features.push('Every message tagged with the platform it came from');
  }
  if (customization.length) features.push('Every color is a picker, no coding');

  const included = [];
  if (hosts.includes('StreamElements')) included.push('StreamElements widget files');
  if (hosts.includes('Streamlabs')) included.push('Streamlabs / OBS widget files');
  included.push('Video setup instructions');

  const intro = extractIntro(product);

  const flags = [];
  if (!intro) flags.push('no usable intro prose, needs copy written');
  if (!hostsOk) flags.push('could not determine host support');
  if (!platformsOk) flags.push('could not determine platforms');
  if (widgetType === 'Other') flags.push('widget type not derivable from title');
  if (isGoal && !goalTypes.length) flags.push('goal widget with no goal types found');

  const facts = {
    handle: product.handle,
    id: product.id,
    title: product.title,
    widget_type: widgetType,
    theme: detectTheme(product.title),
    platforms,
    works_with: hosts,
    goal_types: goalTypes,
    customization,
    multistream,
    features,
    included,
    intro,
    flags,
  };
  facts.generatedHtml = renderDescription(facts);
  return facts;
}

const [, , catalogPath, outDir] = process.argv;
if (!catalogPath || !outDir) {
  console.error('usage: normalize-descriptions.mjs <catalog.json> <outdir>');
  process.exit(1);
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const all = catalog.map(buildFacts);

fs.mkdirSync(outDir, {recursive: true});
fs.writeFileSync(`${outDir}/facts.json`, JSON.stringify(all, null, 2));

const flagged = all.filter((f) => f.flags.length);
const report = [
  `# Description normalization dry run`,
  ``,
  `${all.length} live products. ${all.length - flagged.length} fully auto-generated, ${flagged.length} need a decision.`,
  ``,
  `## Facet coverage (these become the filters)`,
  ``,
  ...['widget_type', 'theme'].map((k) => {
    const counts = {};
    for (const f of all) counts[f[k]] = (counts[f[k]] || 0) + 1;
    const pairs = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return `- **${k}**: ${pairs.map(([v, n]) => `${v} (${n})`).join(', ')}`;
  }),
  ...['platforms', 'works_with', 'goal_types', 'customization'].map((k) => {
    const counts = {};
    for (const f of all) for (const v of f[k]) counts[v] = (counts[v] || 0) + 1;
    const pairs = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return `- **${k}**: ${pairs.map(([v, n]) => `${v} (${n})`).join(', ')}`;
  }),
  ``,
  `## Needs a decision (${flagged.length})`,
  ``,
  ...flagged.map((f) => `- \`${f.handle}\` — ${f.flags.join('; ')}`),
].join('\n');

fs.writeFileSync(`${outDir}/review.md`, report);
console.log(
  `${all.length} products, ${all.length - flagged.length} clean, ${flagged.length} flagged`,
);
