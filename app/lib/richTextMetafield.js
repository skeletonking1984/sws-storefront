/**
 * Safe plain-text extraction for a Shopify metafield that could be either
 * shape depending on how the definition was created in Admin:
 *
 *   - `single_line_text_field` / `multi_line_text_field`: the raw string.
 *   - `rich_text_field`: a JSON tree (`{type: 'root', children: [...]}`),
 *     Shopify's own rich text schema.
 *
 * `custom.intro` is a short (60-100 word) plain paragraph, so this only
 * needs to recover readable text, never markup. Returning plain text (never
 * HTML) means the caller renders it as React text content, never
 * `dangerouslySetInnerHTML`, so a metafield typed as rich text can never
 * inject markup onto the page even if Admin content includes an unexpected
 * node type.
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function metafieldToPlainText(value) {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return trimmed;
  }
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    // Not valid JSON after all, e.g. plain text that happens to start with
    // '{'. Treat as plain text rather than dropping it.
    return trimmed;
  }
  const text = collectText(parsed).join(' ').replace(/\s+/g, ' ').trim();
  // A rich text tree that parsed but yielded no text nodes (empty doc) is
  // functionally the same as no value.
  return text || trimmed;
}

/**
 * Walks a Shopify rich text JSON node tree collecting `text` leaf values.
 * @param {unknown} node
 * @returns {string[]}
 */
function collectText(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(collectText);
  const out = [];
  if (typeof node.value === 'string') out.push(node.value);
  if (Array.isArray(node.children)) out.push(...collectText(node.children));
  return out;
}
