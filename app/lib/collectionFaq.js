/**
 * `custom.faq` is a JSON array of `{q, a}` pairs (a plain JSON metafield,
 * not a Shopify page body). FaqAccordion and buildFaqJsonLd (see
 * app/lib/faqJsonLd.js, app/lib/pageContent.js) are both written against
 * the SHAPE of a real Shopify page body: sequential `<p>Question<br>
 * Answer</p>` paragraphs. Rather than a second FAQ renderer and a second
 * FAQPage JSON-LD builder, this converts the metafield's JSON into that
 * exact HTML shape so both existing helpers apply unchanged and a
 * collection's FAQ can never render or emit JSON-LD differently than a
 * product's.
 * @param {string | null | undefined} rawJson
 * @returns {string} Page-body-shaped HTML, or '' when there is nothing usable.
 */
export function collectionFaqToPageBodyHtml(rawJson) {
  if (!rawJson) return '';
  let pairs;
  try {
    pairs = JSON.parse(rawJson);
  } catch {
    return '';
  }
  if (!Array.isArray(pairs)) return '';

  return pairs
    .map((pair) => {
      const q = escapeHtml(pair?.q ?? pair?.question ?? '');
      const a = escapeHtml(pair?.a ?? pair?.answer ?? '');
      if (!q || !a) return '';
      return `<p>${q}<br>${a}</p>`;
    })
    .filter(Boolean)
    .join('');
}

/** @param {unknown} value @returns {string} */
function escapeHtml(value) {
  return String(value ?? '')
    .trim()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
