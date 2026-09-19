// Relative, not the `~/lib/...` alias, on purpose: scripts/audit-faq-jsonld.mjs
// imports this file directly with node, which cannot resolve the alias. Same
// reason as productFeedCsv.js and firstPartySession.server.js.
import {parseFaqBody} from './pageContent.js';

/**
 * FAQPage JSON-LD, built from the SAME Shopify page body that FaqAccordion
 * renders visibly. Nothing here is hand-written, so the markup and the words
 * on the page cannot drift apart: if an answer changes in Shopify, both move
 * together or neither does.
 *
 * Why it is built from the rendered items rather than from a separate list:
 * the first attempt at FAQ markup on most sites is a hand-kept copy that goes
 * stale the first time someone edits the page, and stale markup is worse than
 * none because it is what an answer engine quotes.
 *
 * Category headers (the ALL-CAPS paragraphs) are not questions and are
 * dropped. A Q&A pair missing either half is dropped too: schema.org wants a
 * Question to carry an acceptedAnswer, and an empty one is a lie about the
 * page.
 *
 * @param {string} html Shopify page body HTML
 * @returns {{'@context': string, '@type': string, mainEntity: Array<object>} | null}
 */
export function buildFaqJsonLd(html) {
  const questions = parseFaqBody(html)
    .filter((item) => item.type === 'qa')
    .map((item) => ({
      question: collapse(item.question),
      answer: collapse(item.answer),
    }))
    .filter((item) => item.question && item.answer);

  if (!questions.length) return null;

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map(({question, answer}) => ({
      '@type': 'Question',
      name: question,
      acceptedAnswer: {'@type': 'Answer', text: answer},
    })),
  };
}

/**
 * The Shopify body carries the line wrapping of whoever typed it, so the
 * answers arrive with runs of spaces in them. That is invisible on the page
 * and ugly in a quoted answer, so collapse it here only. The visible render
 * is left exactly as authored.
 * @param {string} text
 */
function collapse(text) {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}
