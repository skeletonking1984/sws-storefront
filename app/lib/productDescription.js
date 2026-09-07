/**
 * Product descriptions in this catalog arrive in two very different shapes and
 * neither one renders well when dropped straight into the DOM:
 *
 *  1. "Rewritten" listings are real HTML, but every section is a flat <p> and
 *     every list is a run of lines glued together with <br>. A section heading
 *     ("✨ **Features**") is markup-identical to a body paragraph, so the whole
 *     description reads as one undifferentiated wall.
 *  2. Older Etsy imports are NOT HTML at all, just plain text with newlines.
 *     Rendered as HTML the newlines collapse and the entire description becomes
 *     a single unbroken paragraph.
 *
 * This module normalizes both into the same small, semantic subset:
 * <h3> for section headings, <ul>/<li> for the pseudo-lists, <p> for prose.
 * Styling then lives in one place (`.product-description` in app.css).
 */

/** Inline tags worth keeping. Everything else is stripped to its text. */
const ALLOWED_INLINE = new Set(['strong', 'b', 'em', 'i', 'u', 'a', 'code']);

/**
 * Leading decoration on a line: an emoji run (pictographs and dingbats, each
 * optionally followed by a variation selector) or a keycap like "1️⃣".
 * Built by hand rather than as one character class so the combining marks stay
 * attached to a base character.
 */
const LEADING_ICON = new RegExp(
  '^\\s*((?:[\\u{1F000}-\\u{1FAFF}\\u{2190}-\\u{2BFF}]\\u{FE0F}?|[0-9#*]\\u{FE0F}?\\u{20E3})+)\\s*',
  'u',
);
const LEADING_BULLET = /^\s*[-–—*•]\s*/;

/** A "Label: rest of sentence" line, where the label is short enough to bold. */
const LABEL_PREFIX = /^([A-Z][^:<]{2,28}):\s+(?=\S)/;

/**
 * Strips tags outside the allowlist, keeping their text content, and drops the
 * data-start/data-end attribute noise these descriptions were authored with.
 * @param {string} html
 * @returns {string}
 */
function sanitizeInline(html) {
  return html
    .replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (tag, name) => {
      const lower = name.toLowerCase();
      if (!ALLOWED_INLINE.has(lower)) return '';
      if (tag.startsWith('</')) return `</${lower}>`;
      if (lower === 'a') {
        const href = /href\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ?? '';
        if (!/^(https?:|mailto:|\/)/i.test(href)) return '';
        return `<a href="${href}" rel="noopener noreferrer">`;
      }
      return `<${lower}>`;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** @param {string} html @returns {string} */
function toText(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/** @param {string} value @returns {string} */
function normalizeForCompare(value) {
  return toText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Filler words that differ freely between a title and its restatement. */
const FILLER = new Set(['and', 'the', 'for', 'with', 'a', 'an', 'of', 'in']);

/** @param {string} value @returns {string[]} */
function keyTokens(value) {
  return normalizeForCompare(value)
    .split(' ')
    .filter((token) => token && !FILLER.has(token));
}

/**
 * Nearly every description opens by restating the product name, which sits
 * directly under the <h1> and reads as a duplicate. True when every meaningful
 * word of the opening line also appears in the title.
 * @param {string} line
 * @param {string} title
 * @returns {boolean}
 */
function restatesTitle(line, title) {
  const titleTokens = new Set(keyTokens(title));
  if (!titleTokens.size) return false;
  const lineTokens = keyTokens(line);
  if (lineTokens.length < 4) return false;
  return lineTokens.every((token) => titleTokens.has(token));
}

/**
 * Splits a line into its leading emoji/bullet decoration and the rest.
 * @param {string} line
 * @returns {{icon: string, body: string}}
 */
function splitIcon(line) {
  const iconMatch = LEADING_ICON.exec(line);
  if (iconMatch) {
    return {icon: iconMatch[1].trim(), body: line.slice(iconMatch[0].length)};
  }
  return {icon: '', body: line.replace(LEADING_BULLET, '')};
}

/**
 * A block is a heading when it is a single short line whose text is entirely
 * bolded (after its emoji), or, for the plain-text imports, a short line ending
 * in ":" or "?" that reads like a section label.
 * @param {string[]} lines
 * @param {boolean} wasHtml
 * @returns {boolean}
 */
function isHeading(lines, wasHtml, nextIsList = false) {
  if (lines.length !== 1) return false;
  const line = lines[0];
  const {body} = splitIcon(line);
  const text = toText(body);
  if (!text || text.length > 60) return false;

  // Bolded end to end, e.g. "✨ <strong>Features</strong>".
  if (wasHtml && /^<(strong|b)>[\s\S]*<\/\1>$/i.test(body.trim())) return true;
  if (!wasHtml && /[:?]$/.test(text) && text.split(' ').length <= 6) return true;

  // Unbolded lead-ins like "Works for streams on" that introduce a list. Only
  // treated as a heading when a list actually follows, so short prose stays prose.
  return nextIsList && text.length <= 40 && !/[.!?,;:]$/.test(text);
}

/**
 * Multi-line blocks are the <br>-glued pseudo-lists. Single-line blocks count
 * as list items only when they open with an emoji or a bullet, so ordinary
 * prose paragraphs are left alone.
 * @param {string[]} lines
 * @returns {boolean}
 */
function isList(lines) {
  if (lines.length > 1) return true;
  return LEADING_ICON.test(lines[0]) || LEADING_BULLET.test(lines[0]);
}

/**
 * @param {string} line
 * @returns {string}
 */
function renderItem(line) {
  const {icon, body} = splitIcon(line);
  const withLabel = body.replace(
    LABEL_PREFIX,
    (_match, label) => `<strong>${label}:</strong> `,
  );
  const iconHtml = icon
    ? `<span class="pd-icon" aria-hidden="true">${icon}</span>`
    : '<span class="pd-icon" aria-hidden="true"></span>';
  return `<li>${iconHtml}<span class="pd-item">${withLabel}</span></li>`;
}

/**
 * Turns raw HTML into an array of blocks, each block being the lines that were
 * separated by <br> inside one <p>.
 * @param {string} html
 * @returns {string[][]}
 */
function blocksFromHtml(html) {
  const paragraphs = html
    .replace(/<\/?(?:div|section)\b[^>]*>/gi, '\n\n')
    .split(/<\/p\s*>|<p\b[^>]*>/i);

  const blocks = [];
  for (const paragraph of paragraphs) {
    const lines = paragraph
      .split(/<br\b[^>]*>/i)
      .map((line) => sanitizeInline(line))
      .filter((line) => toText(line).length > 0);
    if (lines.length) blocks.push(lines);
  }
  return blocks;
}

/**
 * Plain-text imports: blank lines separate blocks, single newlines separate
 * lines within a block.
 * @param {string} text
 * @returns {string[][]}
 */
function blocksFromText(text) {
  return text
    .split(/\n\s*\n+/)
    .map((chunk) =>
      chunk
        .split('\n')
        .map((line) => sanitizeInline(line))
        .filter((line) => toText(line).length > 0),
    )
    .filter((lines) => lines.length > 0);
}

/**
 * These descriptions frequently run a section label straight into its list with
 * no blank line ("Our Policy:" followed by the policy lines), which would
 * otherwise turn the label into the list's first bullet. Only splits on an
 * unambiguous label, so a genuine short first item like "🎮 Twitch" stays put.
 * @param {string[][]} blocks
 * @param {boolean} wasHtml
 * @returns {string[][]}
 */
function splitLeadingHeadings(blocks, wasHtml) {
  const out = [];
  for (const lines of blocks) {
    if (lines.length > 1 && isHeading([lines[0]], wasHtml)) {
      out.push([lines[0]], lines.slice(1));
    } else {
      out.push(lines);
    }
  }
  return out;
}

/**
 * Renders description HTML that already carries real headings and lists,
 * keeping its structure and only reshaping <li> content so it lines up in the
 * same icon column as the inferred path. Headings are normalized to <h3> so
 * one CSS rule styles both paths.
 * @param {string} html
 * @returns {string}
 */
function passThrough(html) {
  return html
    .replace(
      /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi,
      (_m, inner) => `<h3><span>${toText(inner).replace(/\s*:$/, '')}</span></h3>`,
    )
    .replace(/<(ul|ol)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_m, _tag, inner) => {
      const items = [...inner.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map(
        (match) => sanitizeInline(match[1]),
      );
      if (!items.length) return '';
      const classes = [];
      if (!items.some((item) => LEADING_ICON.test(item))) classes.push('pd-plain');
      if (
        items.length > 2 &&
        items.every((item) => toText(splitIcon(item).body).length <= 40)
      ) {
        classes.push('pd-compact');
      }
      const cls = classes.length ? ` class="${classes.join(' ')}"` : '';
      return `<ul${cls}>${items.map(renderItem).join('')}</ul>`;
    })
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/**
 * Normalizes a Shopify product description into clean semantic HTML.
 *
 * @param {string | null | undefined} descriptionHtml Raw `descriptionHtml`.
 * @param {string} [title] Product title, used to drop a duplicated opening
 *   heading (most descriptions restate the title directly under the <h1>).
 * @returns {string} HTML safe to pass to dangerouslySetInnerHTML.
 */
export function formatProductDescription(descriptionHtml, title = '') {
  if (!descriptionHtml) return '';

  // Already normalized (see scripts/normalize-descriptions.mjs): real headings
  // and real lists. Inferring structure again would only destroy it, so keep
  // the markup and just re-tag list items into the icon-column shape.
  if (/<(h[1-6]|ul|ol)\b/i.test(descriptionHtml)) {
    return passThrough(descriptionHtml);
  }

  const wasHtml = /<(p|br|div|strong|em|ul|li)\b/i.test(descriptionHtml);
  const blocks = splitLeadingHeadings(
    wasHtml ? blocksFromHtml(descriptionHtml) : blocksFromText(descriptionHtml),
    wasHtml,
  );

  if (!blocks.length) return '';

  // The first block is usually the title again, emoji and all. Drop it when it
  // is clearly the same product name rather than real opening copy.
  if (blocks[0].length === 1 && restatesTitle(splitIcon(blocks[0][0]).body, title)) {
    blocks.shift();
  }

  const out = [];
  for (const [index, lines] of blocks.entries()) {
    const next = blocks[index + 1];
    if (isHeading(lines, wasHtml, Boolean(next) && isList(next))) {
      const {icon, body} = splitIcon(lines[0]);
      const iconHtml = icon
        ? `<span class="pd-icon" aria-hidden="true">${icon}</span>`
        : '';
      const heading = toText(body).replace(/\s*:$/, '');
      out.push(`<h3>${iconHtml}<span>${heading}</span></h3>`);
    } else if (isList(lines)) {
      const classes = [];
      if (!lines.some((line) => LEADING_ICON.test(line))) classes.push('pd-plain');
      // Short, label-like items ("Twitch", "Bits Goals") column up nicely;
      // full sentences must not, so only opt in when every item is short.
      const compact =
        lines.length > 2 &&
        lines.every((line) => toText(splitIcon(line).body).length <= 40);
      if (compact) classes.push('pd-compact');
      const cls = classes.length ? ` class="${classes.join(' ')}"` : '';
      out.push(`<ul${cls}>${lines.map(renderItem).join('')}</ul>`);
    } else {
      out.push(...lines.map((line) => `<p>${line}</p>`));
    }
  }

  return out.join('\n');
}
