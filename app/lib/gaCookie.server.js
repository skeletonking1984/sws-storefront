/**
 * Parses the GA4 `_ga` cookie so its client_id can be relayed into cart
 * attributes (see app/routes/cart.jsx) and read back out of the resulting
 * order's note_attributes by the server-side purchase webhook (see
 * app/routes/webhooks.orders.jsx). This is what lets a purchase join the
 * browsing session that produced it even when checkout runs on shop.app or
 * a host that cannot see the storefront's cookies.
 *
 * `_ga` cookie shape: `GA1.1.<part1>.<part2>`. The client_id GA4 itself
 * uses is the last two dot-separated parts joined with a dot, e.g.
 * `1234567890.1700000000`. Parses defensively: any cookie that does not
 * match this exact shape returns undefined rather than a partial or
 * malformed value.
 *
 * @param {string | null | undefined} cookieHeader Raw `Cookie` request header.
 * @returns {string | undefined}
 */
export function parseGaClientId(cookieHeader) {
  const value = readCookie(cookieHeader, '_ga');
  if (!value) return undefined;

  const parts = value.split('.');
  // GA1.1.<id1>.<id2> is always 4 dot-separated parts.
  if (parts.length !== 4) return undefined;

  const [, , id1, id2] = parts;
  if (!/^\d+$/.test(id1) || !/^\d+$/.test(id2)) return undefined;

  return `${id1}.${id2}`;
}

/**
 * Reads a single cookie value out of a raw `Cookie` header.
 * @param {string | null | undefined} cookieHeader
 * @param {string} name
 * @returns {string | undefined}
 */
function readCookie(cookieHeader, name) {
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;

    const key = part.slice(0, eq).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }

  return undefined;
}
