/**
 * Storefront -> sws-free-chat token service client.
 *
 * SERVER ONLY. Calls the Cloudflare Pages Function at
 * brand.config.js `freeChat.mintUrl` (overridable with
 * PRIVATE_FREE_CHAT_TOKEN_SERVICE_URL for local/dev testing against a
 * `wrangler pages dev` instance) with a shared secret, never the visitor's
 * raw email. The widget token service stores only the email hash, never the
 * address itself.
 */

import {hashEmail} from '~/lib/hashedEmail.server';
import {brand} from '~/lib/brand.config';

const DEFAULT_MINT_URL = brand.freeChat.mintUrl;
const TIMEOUT_MS = 8000;

/**
 * @param {{email: string, env: Record<string, string|undefined>}} args
 * @returns {Promise<{ok: true, token: string} | {ok: false, reason: string}>}
 */
export async function mintWidgetToken({email, env}) {
  const secret = env?.PRIVATE_FREE_CHAT_MINT_SECRET;
  if (!secret) return {ok: false, reason: 'not_configured'};

  const emailHash = await hashEmail(email);
  if (!emailHash) return {ok: false, reason: 'invalid_email'};

  const url = env?.PRIVATE_FREE_CHAT_TOKEN_SERVICE_URL || DEFAULT_MINT_URL;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-mint-secret': secret,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        emailHash,
        consentVersion: 'free-chat-v1',
        consentAt: Date.now(),
      }),
    });
    if (!response.ok) {
      return {ok: false, reason: `mint_http_${response.status}`};
    }
    const body = await response.json();
    if (!body?.token) return {ok: false, reason: 'mint_no_token'};
    return {ok: true, token: body.token};
  } catch (error) {
    return {ok: false, reason: `mint_failed: ${String(error).slice(0, 100)}`};
  }
}
