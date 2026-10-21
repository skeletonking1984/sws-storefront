/**
 * Signed, expiring confirm links for the Stream Chat Lite free-widget signup.
 *
 * SERVER ONLY. Do not import from a component.
 *
 * Why HMAC and not a database row: there is no datastore on the storefront
 * for a pending signup, and there does not need to be one. The link itself
 * carries everything needed to verify it (email, source, issued-at), signed
 * so it cannot be forged or edited, and time-boxed so an old link stops
 * working. Marketing consent is never recorded from the signup form itself,
 * only from a verified click on this link (double opt-in), per the owner's
 * decision in the free-chat-widget task.
 *
 * Secret: `PRIVATE_FREE_CHAT_CONFIRM_SECRET`, a new env var, set on Oxygen.
 * Never logged, never sent to the client, never reused for anything else.
 */

// Exported so freeChatConfirmUse.server.js can compute how much of a
// token's own lifetime is left when it marks that token used.
export const TTL_MS = 48 * 60 * 60 * 1000; // 48 hours

function base64urlEncode(bytes) {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const pad =
    padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
  const str = atob(padded + pad);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

/**
 * @param {string} secret
 * @returns {Promise<CryptoKey>}
 */
async function importKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign', 'verify'],
  );
}

/**
 * @param {{email: string, source: string, env: Record<string, string|undefined>}} args
 * @returns {Promise<{ok: true, token: string} | {ok: false, reason: string}>}
 */
export async function signConfirmToken({email, source, env}) {
  const secret = env?.PRIVATE_FREE_CHAT_CONFIRM_SECRET;
  if (!secret) return {ok: false, reason: 'not_configured'};

  const payload = JSON.stringify({
    email: String(email).trim().toLowerCase(),
    source: String(source || 'free-chat').slice(0, 40),
    iat: Date.now(),
  });
  const payloadB64 = base64urlEncode(new TextEncoder().encode(payload));
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payloadB64),
  );
  const sigB64 = base64urlEncode(new Uint8Array(sig));
  return {ok: true, token: `${payloadB64}.${sigB64}`};
}

/**
 * Verifies signature and expiry. Never throws.
 * @param {{token: string, env: Record<string, string|undefined>}} args
 * @returns {Promise<{ok: true, email: string, source: string, iat: number} | {ok: false, reason: 'not_configured'|'malformed'|'bad_signature'|'expired'}>}
 */
export async function verifyConfirmToken({token, env}) {
  const secret = env?.PRIVATE_FREE_CHAT_CONFIRM_SECRET;
  if (!secret) return {ok: false, reason: 'not_configured'};

  try {
    const [payloadB64, sigB64] = String(token || '').split('.');
    if (!payloadB64 || !sigB64) return {ok: false, reason: 'malformed'};

    const key = await importKey(secret);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64urlDecode(sigB64),
      new TextEncoder().encode(payloadB64),
    );
    if (!valid) return {ok: false, reason: 'bad_signature'};

    const payload = JSON.parse(
      new TextDecoder().decode(base64urlDecode(payloadB64)),
    );
    if (!payload?.email || typeof payload.iat !== 'number') {
      return {ok: false, reason: 'malformed'};
    }
    if (Date.now() - payload.iat > TTL_MS) {
      return {ok: false, reason: 'expired'};
    }
    return {
      ok: true,
      email: payload.email,
      source: payload.source || 'free-chat',
      iat: payload.iat,
    };
  } catch {
    return {ok: false, reason: 'malformed'};
  }
}
