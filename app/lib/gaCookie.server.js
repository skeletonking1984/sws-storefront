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
 * Parses GA4's `_ga_<measurement id>` session cookie so its session_id and
 * session_number can be carried the same way `parseGaClientId` carries
 * `_ga`'s client_id (see app/lib/clickIds.server.js). A purchase sent to
 * GA4's Measurement Protocol with a client_id but no session_id still gets
 * counted, but it opens a NEW session for that event, which silently
 * reassigns landing page, source, medium and campaign to whatever the
 * Measurement Protocol request itself looks like rather than the buyer's
 * real browsing session -- see docs/conversion-tracking.md, "Why
 * session_id matters".
 *
 * Cookie name is derived from the measurement id, never hardcoded: GA4
 * names this cookie `_ga_` followed by the measurement id with its
 * leading `G-` stripped, e.g. measurement id `G-X0978HDVTK` writes cookie
 * `_ga_X0978HDVTK`.
 *
 * Value shape: `GS1.1.<sessionId>.<sessionNumber>.<more fields>`. GA4 has
 * shipped more than one version of this cookie over time (`GS1`, `GS2`,
 * ...), so this matches on the `GS` prefix rather than an exact literal.
 * Parses defensively, same spirit as `parseGaClientId`: the first field
 * must start with `GS`, sessionId and sessionNumber must both be all
 * digits, and anything that does not match returns undefined rather than
 * a partial value.
 *
 * @param {string | null | undefined} cookieHeader Raw `Cookie` request header.
 * @param {string | undefined} measurementId GA4 measurement id, e.g. `G-X0978HDVTK`.
 * @returns {{sessionId: string, sessionNumber: string} | undefined}
 */
export function parseGaSession(cookieHeader, measurementId) {
  if (!measurementId) return undefined;

  const cookieName = `_ga_${measurementId.replace(/^G-/, '')}`;
  const value = readCookie(cookieHeader, cookieName);
  if (!value) return undefined;

  const parts = value.split('.');
  // GS1.1.<sessionId>.<sessionNumber>.<...more fields> is at least 4 parts.
  if (parts.length < 4) return undefined;
  if (!parts[0].startsWith('GS')) return undefined;

  const [, , sessionId, sessionNumber] = parts;
  if (!/^\d+$/.test(sessionId) || !/^\d+$/.test(sessionNumber)) {
    return undefined;
  }

  return {sessionId, sessionNumber};
}

/**
 * Reads a single cookie value out of a raw `Cookie` header. Exported (as
 * `readCookieValue`) so app/lib/clickIds.server.js can read the other click
 * id cookies (`sws_twclid`, `sws_gclid`, ...) through the same parser
 * instead of a second copy of this loop.
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

export {readCookie as readCookieValue};
