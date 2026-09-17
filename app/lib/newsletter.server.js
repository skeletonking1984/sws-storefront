/**
 * One newsletter signup path, shared by the homepage capture and the
 * first-visit offer popup, so the two can never drift into treating a signup
 * differently.
 *
 * Order matters: subscribe first (that is the part that puts them somewhere a
 * campaign can reach), notify second.
 */
import {sendNotificationEmail} from '~/lib/notify.server';
import {subscribeToMarketing} from '~/lib/subscribe.server';
import {buildHashedEmailCookie} from '~/lib/hashedEmail.server';

/**
 * @param {{formData: FormData, env: Record<string, string|undefined>, origin: string, source: string}} args
 * @returns {Promise<{ok: boolean, reason?: string, values?: {email: string}}>}
 */
export async function handleNewsletterSignup({formData, env, origin, source}) {
  const email = (formData.get('email') || '').toString().trim();
  const company = (formData.get('company') || '').toString().trim();

  // Honeypot: bots fill every field. Absorb it without sending anything.
  if (company) return {ok: true};

  if (!email || !email.includes('@')) {
    return {ok: false, reason: 'invalid', values: {email}};
  }

  const subscribed = await subscribeToMarketing({email, env});

  /*
   * The visitor just told us who they are. Hash it and hand the caller a
   * Set-Cookie so every SERVER-SIDE event from here on can carry
   * hashed_email, which is the strongest identifier X's Conversion API
   * accepts short of a completed order. See app/lib/hashedEmail.server.js
   * for what is stored (the hash, never the address) and why.
   *
   * Deliberately NOT gated on `subscribed`. Whether Shopify accepted the
   * marketing consent is a separate question from whether we now know who
   * this person is, and the consent call is inert without an admin token.
   * Tying the two would mean the identifier silently depends on a token
   * that may not exist.
   */
  const setCookie = await buildHashedEmailCookie(email);

  const sent = await sendNotificationEmail({
    env,
    origin,
    // The list state is in the SUBJECT, not only the body. Every signup
    // between 2026-09-16 and 2026-09-17 came back `skipped` (no
    // PRIVATE_ADMIN_API_TOKEN on Oxygen production) and every notification
    // looked exactly like a working one in the inbox, so nobody saw it for a
    // day. A subject that says NOT ON LIST cannot be skimmed past.
    subject:
      subscribed.ok
        ? `SWS newsletter signup: ${email}`
        : `SWS newsletter signup (NOT ON LIST: ${subscribed.state}): ${email}`,
    text: [
      `New newsletter signup (${source}).`,
      '',
      email,
      '',
      `Shopify marketing list: ${subscribed.state}${
        subscribed.reason ? ` (${subscribed.reason})` : ''
      }`,
    ].join('\n'),
    replyTo: email,
  });

  // Success if EITHER half worked. Someone on the list has been served even
  // if the notification transport is down, and vice versa. Only report
  // failure when nothing got through at all, because the UI shows the
  // discount code either way and claiming failure would be wrong.
  if (!subscribed.ok && !sent.ok) {
    // setCookie even here. This branch means the NOTIFICATION email failed,
    // not that the address was bad, and the visitor still told us who they
    // are. Dropping the identifier because an unrelated send failed would
    // lose real matching for no reason.
    return {ok: false, reason: sent.reason, values: {email}, setCookie};
  }
  return {ok: true, setCookie};
}
