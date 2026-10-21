/**
 * ChatGPT Ads (OpenAI) Conversions API, server side half of the lead event.
 *
 * Spec read 2026-10-05:
 *   https://developers.openai.com/ads/conversion-tracking
 *   https://developers.openai.com/ads/measurement-pixel
 *
 *   POST https://bzr.openai.com/v1/events?pid=<PIXEL_ID>
 *   Authorization: Bearer <Conversions API key from Ads Manager, Conversions tab>
 *   {"events": [{id, type, timestamp_ms, action_source: "web", source_url,
 *                oppref, data: {type: "customer_action"}}]}
 *
 * `id` is the dedup key shared with the browser pixel's `event_id` option, so
 * the same lead sent from both sides counts once. `oppref` is the click
 * reference ChatGPT appends to the landing URL; without it a server event
 * cannot be tied to an ad click.
 *
 * NOT a registered destination in index.server.js on purpose. Those fan out
 * from api.e.jsx, which relays events only when a browser pixel was blocked;
 * this one is called straight from the inquiry action with the same event id
 * the browser uses, so it never double counts and never needs the relay.
 *
 * SERVER ONLY (`.server.js` keeps the key out of the client bundle).
 *
 * Env, both required, and either one missing makes this a silent no-op:
 *   PUBLIC_OPENAI_PIXEL_ID              pixel / data source id (same id the browser pixel uses)
 *   PRIVATE_OPENAI_CONVERSIONS_API_KEY  bearer token
 *
 * Never reports a send that did not happen: returns {ok:false, reason}.
 */

const ENDPOINT = 'https://bzr.openai.com/v1/events';
const TIMEOUT_MS = 4000;

/** @param {Record<string, string|undefined>} env */
export function isConfigured(env) {
  return Boolean(
    env?.PUBLIC_OPENAI_PIXEL_ID && env?.PRIVATE_OPENAI_CONVERSIONS_API_KEY,
  );
}

/**
 * @param {object} args
 * @param {Record<string, string|undefined>} args.env
 * @param {string} args.eventId Shared with the browser pixel's event_id option.
 * @param {string} args.sourceUrl Page the lead came from.
 * @param {string} [args.oppref] Click reference from the landing URL or the `__oppref` cookie.
 * @param {number} [args.now] Test seam.
 * @returns {Promise<{ok: true} | {ok: false, reason: string}>}
 */
export async function sendLeadCreated({
  env,
  eventId,
  sourceUrl,
  oppref,
  now = Date.now(),
}) {
  if (!isConfigured(env)) return {ok: false, reason: 'not_configured'};

  const event = {
    id: eventId,
    type: 'lead_created',
    timestamp_ms: now,
    action_source: 'web',
    source_url: sourceUrl,
    ...(oppref ? {oppref} : {}),
    data: {type: 'customer_action'},
  };

  try {
    const response = await fetch(
      `${ENDPOINT}?pid=${encodeURIComponent(env.PUBLIC_OPENAI_PIXEL_ID)}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.PRIVATE_OPENAI_CONVERSIONS_API_KEY}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        body: JSON.stringify({events: [event]}),
      },
    );
    return response.ok
      ? {ok: true}
      : {ok: false, reason: `http_${response.status}`};
  } catch {
    return {ok: false, reason: 'send_failed'};
  }
}

/**
 * The pixel stores the click reference in a first-party `__oppref` cookie
 * (30 days). Read it as a fallback for a visitor whose landing URL param is
 * gone by the time they submit.
 * @param {Request} request
 * @returns {string}
 */
export function readOpprefCookie(request) {
  const header = request.headers.get('Cookie') || '';
  const match = header.match(/(?:^|;\s*)__oppref=([^;]+)/);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return '';
  }
}
