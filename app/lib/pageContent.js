const HTML_ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

/**
 * @param {string} text
 * @returns {string}
 */
function decodeEntities(text) {
  return text.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => HTML_ENTITIES[m]);
}

/**
 * Splits a Shopify page's rendered HTML body into an array of raw <p>...</p>
 * fragment inner-HTML strings. Shopify page bodies are just sequential <p>
 * tags, so this gives us paragraph-level structure to re-layout.
 * @param {string} html
 * @returns {string[]}
 */
function splitParagraphs(html) {
  if (!html) return [];
  const matches = [...html.matchAll(/<p>([\s\S]*?)<\/p>/g)];
  return matches.map((m) => m[1].trim()).filter(Boolean);
}

/**
 * Parses the FAQ page body into category headers and Q&A pairs.
 * Shopify content shape: a short ALL-CAPS paragraph with no <br> is a
 * category header; a paragraph with "Question<br>Answer..." is a Q&A pair.
 * @param {string} html
 * @returns {Array<{type: 'category', text: string} | {type: 'qa', question: string, answer: string}>}
 */
export function parseFaqBody(html) {
  const paragraphs = splitParagraphs(html);
  return paragraphs.map((p) => {
    if (!p.includes('<br')) {
      return {type: 'category', text: decodeEntities(p.replace(/<[^>]+>/g, ''))};
    }
    const [question, ...rest] = p.split(/<br\s*\/?>/i);
    return {
      type: 'qa',
      question: decodeEntities(question.replace(/<[^>]+>/g, '').trim()),
      answer: decodeEntities(rest.join(' ').replace(/<[^>]+>/g, ' ').trim()),
    };
  });
}

/**
 * Parses the How It Works page body into intro paragraphs, numbered steps,
 * and closing info blocks (WORKS WITH / VIA / NEED HELP).
 * @param {string} html
 * @returns {{
 *   intro: string[],
 *   steps: Array<{number: string, title: string, body: string}>,
 *   infoBlocks: Array<{title: string, body: string}>,
 * }}
 */
export function parseHowItWorksBody(html) {
  const paragraphs = splitParagraphs(html);
  const intro = [];
  const steps = [];
  const infoBlocks = [];

  for (const p of paragraphs) {
    const stepMatch = p.match(
      /^<strong>STEP (\d+)\s*[—-]\s*([^<]*?)<br\s*\/?><\/strong>\s*<br\s*\/?>([\s\S]*)$/i,
    );
    const infoMatch = p.match(
      /^<strong>([^<]*?):?<br\s*\/?><\/strong>\s*<br\s*\/?>([\s\S]*)$/i,
    );

    if (stepMatch) {
      steps.push({
        number: stepMatch[1],
        title: decodeEntities(stepMatch[2].trim()),
        body: decodeEntities(
          stepMatch[3].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim(),
        ),
      });
    } else if (infoMatch) {
      infoBlocks.push({
        title: decodeEntities(infoMatch[1].trim()),
        body: decodeEntities(
          infoMatch[2].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim(),
        ),
      });
    } else if (!p.match(/^<strong>/i)) {
      intro.push(decodeEntities(p.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')));
    }
  }

  return {intro, steps, infoBlocks};
}
