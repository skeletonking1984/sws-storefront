import {isMultistream} from './platforms.js';

/**
 * The PDP "answer block": one short paragraph an answer engine can lift
 * whole and still be correct.
 *
 * AEO is a different job from SEO. A search result needs a page to rank; a
 * cited answer needs a passage that survives being quoted with no page
 * around it. So this paragraph never says "this widget" or "it works with"
 * in a way that depends on a heading above it, never refers to the gallery
 * or the buy box, and names the product, its platforms, the price, what
 * actually arrives, and the file format in the same few sentences.
 *
 * Every clause is generated from a source that is already checked somewhere
 * else in this repo, so the block cannot drift away from the page it sits
 * on:
 *
 * - name and type: the product's own `seo.title` and `productType`.
 * - platforms: the `custom.works_with` metafield, which is per-product
 *   ground truth from that product's Etsy listing, and is the ONLY thing
 *   allowed to make a platform claim here (CLAUDE.md, 2026-09-14).
 * - price: the live selected variant, so a price change moves the sentence.
 * - delivery: app/data/product-delivery.json, generated from the real Etsy
 *   file manifest by scripts/build-delivery-facts.mjs.
 *
 * A product with no proven delivery facts gets a block with no format
 * clause rather than a guessed one. scripts/audit-answer-blocks.mjs
 * reports those, and the block still passes the word floor without them.
 *
 * Rendered visibly on the page, never crawler-only: a passage hidden from
 * buyers is cloaking, and the sentence is genuinely the thing a buyer wants
 * in the first five seconds anyway.
 */

/** Where chat and events come FROM. */
const DESTINATIONS = ['Twitch', 'YouTube', 'Kick', 'TikTok'];
/** Where the widget INSTALLS. */
const HOSTS = ['StreamElements', 'Streamlabs'];

const KIND_PHRASE = {
  'Chat Widget': 'animated chat widget',
  'Goal Widget': 'animated goal widget',
  'Overlay Pack': 'animated stream overlay pack',
  Bundle: 'bundle of animated stream widgets',
  Emotes: 'pack of stream emotes',
};
const DEFAULT_KIND = 'animated stream overlay';

const NUMBER_WORD = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** First letter upper, rest untouched. */
function capitalize(word) {
  return word ? word[0].toUpperCase() + word.slice(1) : word;
}

/** "a" or "an", decided by the sound of the next word, not a vowel test. */
function article(word) {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

/** "A, B and C" with no Oxford comma and no em dash anywhere. */
function joinList(items, conjunction = 'and') {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
}

/**
 * Money, formatted the way a person quoting the sentence would write it.
 * A missing or unparseable price drops the clause entirely rather than
 * printing a zero: "$0.00" reads as free and would be a lie on every page.
 * @param {{amount?: string, currencyCode?: string} | null | undefined} price
 */
function formatPrice(price) {
  const amount = Number(price?.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const code = price?.currencyCode || 'USD';
  const symbol = code === 'USD' ? '$' : '';
  const body = `${symbol}${amount.toFixed(2)}`;
  return symbol ? body : `${body} ${code}`;
}

/**
 * The delivery clause, from proven facts only, plus whether it takes a
 * plural verb. A product with no proven manifest says "the files" and names
 * no format at all: an invented format costs a refund, a missing one costs
 * a slightly weaker answer.
 * @param {{archives?: number, setupDoc?: string | null} | null | undefined} delivery
 * @returns {{phrase: string, plural: boolean}}
 */
function deliveryClause(delivery, productType) {
  const archives = delivery?.archives;
  if (!archives || archives < 1) return {phrase: 'The files', plural: true};
  const doc = delivery.setupDoc;
  // An emote pack ships artwork, not widget code. Saying "widget code" on
  // it would be the same kind of family-wide assumption that put YouTube
  // badges on StreamElements only widgets.
  const contents = productType === 'Emotes' ? 'emote files' : 'widget code';
  const archivePhrase =
    archives === 1
      ? `A ZIP of ${contents}`
      : `${capitalize(NUMBER_WORD[archives] || String(archives))} ZIPs of ${contents}`;
  return {
    phrase: doc ? `${archivePhrase} and a ${doc} setup guide` : archivePhrase,
    plural: archives > 1 || Boolean(doc),
  };
}

/**
 * Assembles the paragraph, shortest honest version first.
 *
 * The 40 to 60 word window is not decoration. Under 40 the passage stops
 * answering the whole question and an engine has to go back to the page for
 * the price or the format; over 60 it gets truncated mid clause, which is
 * how a correct sentence becomes a wrong quote. Catalogue titles here run
 * from 4 to 10 words and platform lists from 1 to 7, so a single fixed
 * template cannot hit that window for every product. Instead the block is
 * built with the essential clauses always present and two optional ones
 * added or dropped in a fixed order, so the same product always produces
 * the same sentence.
 *
 * @param {{
 *   name: string,
 *   productType?: string | null,
 *   platforms?: string[] | null,
 *   price?: {amount?: string, currencyCode?: string} | null,
 *   delivery?: {archives?: number, setupDoc?: string | null} | null,
 * }} input
 * @returns {string} one paragraph, or '' when there is not enough to say
 */
export function buildAnswerBlock({name, productType, platforms, price, delivery}) {
  if (!name) return '';
  const list = Array.isArray(platforms) ? platforms : [];
  const destinations = DESTINATIONS.filter((p) => list.includes(p));
  const hosts = HOSTS.filter((p) => list.includes(p));
  const hasObs = list.includes('OBS');
  // "for Twitch, YouTube and Kick streamers" is true of a goal widget and of
  // a multistream chat widget, and it is the same words for two different
  // facts: one works wherever you are live, the other reads all of them at
  // once. An answer engine quoting this block cannot tell them apart, and
  // neither can a buyer. The multistream ones say so, in the noun, and only
  // when the product can back it (app/lib/platforms.js, Todd 2026-09-22:
  // "product must be multistream enabled or its not multistream").
  const multistream = isMultistream({productType, worksWith: JSON.stringify(list)});
  const baseKind = KIND_PHRASE[productType] || DEFAULT_KIND;
  // Swapped into the noun rather than added as a sentence: the block has a 40
  // to 60 word window and 121 of 122 products already sit inside it, so a new
  // sentence would push the long ones out and cost more than it buys.
  const kind = multistream ? `multistream ${baseKind}` : baseKind;
  const money = formatPrice(price);
  const {phrase: arrival, plural} = deliveryClause(delivery, productType);

  /**
   * @param {{brand: boolean, noSub: boolean}} opts
   */
  function assemble({brand, noSub}) {
    const audience = !destinations.length
      ? 'for streamers'
      : multistream
        ? `that reads ${joinList(destinations)} chat at once`
        : `for ${joinList(destinations)} streamers`;
    const sentences = [
      `${name} is ${article(kind)} ${kind}${brand ? ' from Stream Widget Shop' : ''} ${audience}.`,
    ];

    // Price and delivery belong in one sentence. Quoted apart they are the
    // two halves of the same question ("what do I pay and what turns up"),
    // and an engine that lifts only one leaves the reader the worse half.
    const verb = plural ? 'download' : 'downloads';
    const sub = noSub ? ', with no subscription' : '';
    sentences.push(
      money
        ? `${arrival} ${verb} instantly after checkout, for a one-time ${money}${sub}.`
        : `${arrival} ${verb} instantly after checkout${sub}.`,
    );

    if (hosts.length && hasObs) {
      sentences.push(
        `Setup needs a free ${joinList(hosts, 'or')} account, and the overlay loads into OBS as a browser source.`,
      );
    } else if (hosts.length) {
      sentences.push(`Setup needs a free ${joinList(hosts, 'or')} account.`);
    } else if (hasObs) {
      sentences.push('Setup loads the overlay into OBS as a browser source.');
    }

    return sentences.join(' ');
  }

  // Longest first, then drop the optional clauses in order until it fits.
  // `brand` goes last because naming the shop is what makes the passage
  // attributable when it is quoted away from the site.
  const candidates = [
    {brand: true, noSub: true},
    {brand: true, noSub: false},
    {brand: false, noSub: true},
    {brand: false, noSub: false},
  ].map(assemble);

  return (
    candidates.find((text) => wordCount(text) <= ANSWER_BLOCK_MAX_WORDS) ??
    candidates[candidates.length - 1]
  );
}

/** Word count as a quoting human would count it. Exported for the audit. */
export function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export const ANSWER_BLOCK_MIN_WORDS = 40;
export const ANSWER_BLOCK_MAX_WORDS = 60;
