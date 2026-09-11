/**
 * Outbound notification email, shared by the contact form and the newsletter
 * signup.
 *
 * SERVER ONLY. The `.server.js` suffix keeps the API key out of the client
 * bundle. Never import this from a component.
 *
 * Two providers, tried in order:
 *
 * 1. **Resend**, used when `PRIVATE_RESEND_API_KEY` and
 *    `PRIVATE_CONTACT_TO_EMAIL` are both set. Preferred once it exists: SWS
 *    owns the sending, the mail comes from an SWS domain, and no third party
 *    holds customer messages.
 * 2. **FormSubmit**, the zero-config default so the forms work with no
 *    credential at all. It relays to `CONTACT_TO_EMAIL`. The address has to
 *    confirm itself once, on the first submission, by clicking the activation
 *    link FormSubmit mails it. Until that click, submissions are accepted and
 *    held rather than delivered.
 *
 * There is deliberately no Shopify fallback. Relaying to Shopify's own
 * `/contact` endpoint does not work from here: since the DNS cutover the apex
 * is the Hydrogen app and returns 405, and the Online Store on
 * shop.streamwidgetshop.com answers a server side POST with its bot
 * checkpoint (403 "Verifying your connection..."), warm session or not.
 *
 * Whatever the provider, this must never report a send that did not happen.
 */

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const FORMSUBMIT_ENDPOINT = 'https://formsubmit.co/ajax';
const DEFAULT_FROM = 'onboarding@resend.dev';
// Hard ceiling on any outbound provider call. A third party that hangs must
// never hang the visitor's form: measured on 2026-09-11, FormSubmit answered
// normally and then stopped responding entirely within ten minutes, leaving the
// submit button spinning forever with no error. Failing fast shows the mailto
// fallback instead, which actually works.
const SEND_TIMEOUT_MS = 8000;
// Todd works out of spacelabsdiy but wants the public shop address copied in.
// Override either with CONTACT_TO_EMAIL / CONTACT_CC_EMAIL.
const DEFAULT_CC = 'streamwidgetshop@gmail.com';
// The inbox Todd actually works out of: Etsy sale notifications, Shopify order
// mail and Etsy customer messages all land here, and it is the account the
// Gmail connector is attached to. streamwidgetshop@gmail.com is the address the
// site advertises publicly, but mail sent there went unread. Override with
// CONTACT_TO_EMAIL to change the destination without touching code.
const DEFAULT_TO = 'spacelabsdiy@gmail.com';

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
 * @typedef {{ok: true} | {ok: false, reason: 'not_configured'|'send_failed'}} NotifyResult
 */

/**
 * @param {object} args
 * @param {Record<string, string|undefined>} args.env
 * @param {string} args.subject
 * @param {string} args.text
 * @param {string} [args.replyTo]
 * @param {string} [args.origin] Site origin. FormSubmit rejects a request with
 *   no Origin or Referer, so this is required for that provider.
 * @returns {Promise<NotifyResult>}
 */
export async function sendNotificationEmail({env, subject, text, replyTo, origin}) {
  const to = env?.PRIVATE_CONTACT_TO_EMAIL || env?.CONTACT_TO_EMAIL || DEFAULT_TO;
  const cc = env?.CONTACT_CC_EMAIL ?? DEFAULT_CC;
  const cleanSubject = singleLine(subject);

  if (env?.PRIVATE_RESEND_API_KEY) {
    return sendViaResend({env, to, cc, subject: cleanSubject, text, replyTo});
  }

  // FormSubmit has no cc field, so the copy rides along as a second recipient.
  return sendViaFormSubmit({to, cc, subject: cleanSubject, text, replyTo, origin});
}

/**
 * @returns {Promise<NotifyResult>}
 */
async function sendViaResend({env, to, cc, subject, text, replyTo}) {
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.PRIVATE_RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      body: JSON.stringify({
        from: env.PRIVATE_CONTACT_FROM_EMAIL || DEFAULT_FROM,
        to,
        ...(cc ? {cc} : {}),
        ...(replyTo ? {reply_to: replyTo} : {}),
        subject,
        text,
      }),
    });

    return response.ok ? {ok: true} : {ok: false, reason: 'send_failed'};
  } catch {
    return {ok: false, reason: 'send_failed'};
  }
}

/**
 * FormSubmit's `/ajax` route answers with JSON and a real status code, unlike
 * its plain route which redirects to an HTML page. Three things it will
 * silently refuse on, each measured against the live endpoint:
 *
 * - **No Origin or Referer header.** It answers `success: "false"` with
 *   "Make sure you open this page through a web server".
 * - **`_captcha` left on.** It holds the submission behind a challenge the
 *   visitor never sees, so the mail never arrives.
 * - **An unactivated target address.** It answers `success: "false"` with an
 *   activation notice until someone clicks the link it mails once.
 *
 * All three return HTTP 200, so the status code alone is not proof of
 * delivery and the JSON body has to be read.
 * @returns {Promise<NotifyResult>}
 */
async function sendViaFormSubmit({to, cc, subject, text, replyTo, origin}) {
  const site = origin || 'https://streamwidgetshop.com';
  try {
    const response = await fetch(`${FORMSUBMIT_ENDPOINT}/${encodeURIComponent(to)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: site,
        Referer: site,
      },
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      body: JSON.stringify({
        _subject: subject,
        _captcha: 'false',
        _template: 'table',
        ...(cc ? {_cc: cc} : {}),
        ...(replyTo ? {email: replyTo} : {}),
        message: text,
      }),
    });

    if (!response.ok) {
      return {ok: false, reason: 'send_failed'};
    }

    const body = await response.json().catch(() => null);
    const success = String(body?.success ?? 'true') === 'true';

    return success ? {ok: true} : {ok: false, reason: 'send_failed'};
  } catch {
    return {ok: false, reason: 'send_failed'};
  }
}
