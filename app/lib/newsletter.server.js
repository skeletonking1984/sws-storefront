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

  const sent = await sendNotificationEmail({
    env,
    origin,
    subject: `SWS newsletter signup: ${email}`,
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
    return {ok: false, reason: sent.reason, values: {email}};
  }
  return {ok: true};
}
