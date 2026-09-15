/**
 * OAuth 1.0a request signing, HMAC-SHA1.
 *
 * X's Ads API does not accept a bearer token. Every request to
 * ads-api.x.com must be signed with all four credentials: the app's
 * consumer key and secret, plus a user access token and secret belonging to
 * a user with AD_MANAGER or ACCOUNT_ADMIN on the ads account.
 * https://docs.x.com/x-ads-api/measurement/web-conversions
 *
 * Kept separate from the X destination so the signing can be exercised on
 * its own against the RFC 5849 worked example, which is the only way to
 * know it is right without burning a real API call. See
 * scripts/verify-oauth1.mjs.
 *
 * Runs on Web Crypto, which Oxygen's worker runtime provides. No Node
 * crypto, no dependency.
 */

/**
 * RFC 3986 percent encoding. `encodeURIComponent` leaves ! * ' ( ) alone and
 * OAuth requires them encoded, which is the classic source of signatures
 * that verify locally and are rejected by the server.
 * @param {string} value
 */
export function rfc3986(value) {
  return encodeURIComponent(String(value)).replace(
    /[!*'()]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}

/**
 * @param {string} key
 * @param {string} message
 * @returns {Promise<string>} base64 HMAC-SHA1
 */
async function hmacSha1(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    {name: 'HMAC', hash: 'SHA-1'},
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

/**
 * Build the `Authorization: OAuth ...` header for one request.
 *
 * The signature base string covers the HTTP method, the URL without its
 * query, and every oauth_* parameter plus every query parameter, sorted and
 * joined. A JSON request body is deliberately NOT part of it: OAuth 1.0a
 * only signs form-encoded bodies, and including JSON here produces a
 * signature X rejects.
 *
 * @param {object} args
 * @param {string} args.method
 * @param {string} args.url Full URL, query string included.
 * @param {{consumerKey: string, consumerSecret: string, token: string, tokenSecret: string}} args.credentials
 * @param {string} [args.nonce] Override, for deterministic tests only.
 * @param {string} [args.timestamp] Override, for deterministic tests only.
 * @returns {Promise<string>}
 */
export async function oauth1Header({
  method,
  url,
  credentials,
  nonce,
  timestamp,
}) {
  const parsed = new URL(url);
  const baseUrl = `${parsed.origin}${parsed.pathname}`;

  const oauthParams = {
    oauth_consumer_key: credentials.consumerKey,
    oauth_nonce:
      nonce ?? crypto.randomUUID().replace(/-/g, ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp ?? String(Math.floor(Date.now() / 1000)),
    oauth_token: credentials.token,
    oauth_version: '1.0',
  };

  // Query params participate in the signature; oauth params do too.
  const all = {...oauthParams};
  for (const [k, v] of parsed.searchParams) all[k] = v;

  const paramString = Object.keys(all)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(all[k])}`)
    .join('&');

  const baseString = [
    method.toUpperCase(),
    rfc3986(baseUrl),
    rfc3986(paramString),
  ].join('&');

  const signingKey = `${rfc3986(credentials.consumerSecret)}&${rfc3986(
    credentials.tokenSecret,
  )}`;

  const signature = await hmacSha1(signingKey, baseString);

  // Only the oauth_* params go in the header, never the query params.
  const header = {...oauthParams, oauth_signature: signature};
  return (
    'OAuth ' +
    Object.keys(header)
      .sort()
      .map((k) => `${rfc3986(k)}="${rfc3986(header[k])}"`)
      .join(', ')
  );
}
