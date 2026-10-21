/**
 * Cloudflare Turnstile server-side verification for the free-chat-widget
 * signup form.
 *
 * SERVER ONLY. Never call siteverify from the browser, only from here.
 *
 * Env: `PRIVATE_TURNSTILE_SECRET_KEY`. Unset means Turnstile has not been
 * wired up on Oxygen yet -- verifyTurnstile returns {ok: true, skipped:
 * true} so the free-chat-widget form keeps working exactly as before, and
 * logs one console.warn per request so the gap stays visible without
 * blocking a real signup. Pair: `PUBLIC_TURNSTILE_SITE_KEY`, read directly
 * in free-chat-widget.jsx's loader to decide whether to render the widget
 * at all.
 */

const SITEVERIFY_ENDPOINT =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TIMEOUT_MS = 8000;

/**
 * @param {{token: string, ip: string|undefined, env: Record<string, string|undefined>}} args
 * @returns {Promise<{ok: true, skipped?: true} | {ok: false, reason: string}>}
 */
export async function verifyTurnstile({token, ip, env}) {
  const secret = env?.PRIVATE_TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn(
      '[free-chat] PRIVATE_TURNSTILE_SECRET_KEY not set, skipping Turnstile check',
    );
    return {ok: true, skipped: true};
  }

  if (!token || typeof token !== 'string') {
    return {ok: false, reason: 'missing_token'};
  }

  try {
    const response = await fetch(SITEVERIFY_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: new URLSearchParams({
        secret,
        response: token,
        ...(ip ? {remoteip: ip} : {}),
      }),
    });
    if (!response.ok) {
      return {ok: false, reason: `siteverify_http_${response.status}`};
    }
    const body = await response.json();
    if (!body?.success) {
      return {ok: false, reason: 'verify_failed'};
    }
    return {ok: true};
  } catch (error) {
    // Network error or non-JSON body from siteverify. Fail closed: a form
    // submission with no readable verdict is treated as unverified.
    return {
      ok: false,
      reason: `siteverify_error: ${String(error).slice(0, 100)}`,
    };
  }
}
