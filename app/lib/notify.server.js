/**
 * Outbound notification email, shared by the contact form and the newsletter
 * signup.
 *
 * SERVER ONLY. The `.server.js` suffix keeps the API key out of the client
 * bundle. Never import this from a component.
 *
 * There is deliberately no fallback transport. Relaying to Shopify's own
 * `/contact` endpoint does not work from here: since the DNS cutover the apex
 * is the Hydrogen app and returns 405, and the Online Store on
 * shop.streamwidgetshop.com answers a server side POST with its bot
 * checkpoint (403 "Verifying your connection..."), warm session or not. So
 * either a real mail API is configured or nothing is sent, and the caller is
 * told which. It must never report a send that did not happen.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'onboarding@resend.dev';

/**
 * A subject line becomes a mail header, so it cannot carry line breaks.
 * Visitor supplied text reaches it, so strip them rather than trusting the
 * input to be single line.
 * @param {string} value
 */
function singleLine(value) {
  return String(value).replace(/[\r\n]+/g, ' ').trim();
}

/**
 * @param {object} args
 * @param {Record<string, string|undefined>} args.env
 * @param {string} args.subject
 * @param {string} args.text
 * @param {string} [args.replyTo]
 * @returns {Promise<{ok: true} | {ok: false, reason: 'not_configured'|'send_failed'}>}
 */
export async function sendNotificationEmail({env, subject, text, replyTo}) {
  const apiKey = env?.PRIVATE_RESEND_API_KEY;
  const to = env?.PRIVATE_CONTACT_TO_EMAIL;

  if (!apiKey || !to) {
    return {ok: false, reason: 'not_configured'};
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.PRIVATE_CONTACT_FROM_EMAIL || DEFAULT_FROM,
        to,
        ...(replyTo ? {reply_to: replyTo} : {}),
        subject: singleLine(subject),
        text,
      }),
    });

    if (!response.ok) {
      return {ok: false, reason: 'send_failed'};
    }

    return {ok: true};
  } catch {
    return {ok: false, reason: 'send_failed'};
  }
}
