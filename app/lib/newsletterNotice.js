/**
 * Subject and body of the signup notification email, as a pure function so
 * it can be unit tested (app/lib/newsletterNotice.test.mjs) without Shopify,
 * env or the network. No `~` imports on purpose: node --test runs it bare.
 *
 * Two wordings:
 *   - every source except the beta: the exact newsletter wording the
 *     homepage capture and the offer popup have always sent.
 *   - source 'now-playing-beta': says "Now Playing early access signup", because
 *     the owner saw "SWS newsletter signup" on an early access claim and questioned it. The
 *     signup still goes onto the same Shopify marketing list.
 *
 * The list state stays in the SUBJECT (NOT ON LIST) for both: see the note in
 * newsletter.server.js on why a body-only state went unnoticed for a day.
 */
export const BETA_SOURCE = 'now-playing-beta';

/**
 * @param {{source: string, email: string, shortName: string, subscribed: {ok: boolean, state: string, reason?: string}, betaTag?: string}} args
 * @returns {{subject: string, text: string}}
 */
export function buildSignupNotice({
  source,
  email,
  shortName,
  subscribed,
  betaTag = '',
}) {
  const isBeta = source === BETA_SOURCE;
  const label = isBeta
    ? 'Now Playing early access signup'
    : `${shortName} newsletter signup`;
  const subject =
    (betaTag ? `[${betaTag}] ` : '') +
    (subscribed.ok
      ? `${label}: ${email}`
      : `${label} (NOT ON LIST: ${subscribed.state}): ${email}`);
  const text = [
    isBeta
      ? `New Now Playing early access signup (${source}).`
      : `New newsletter signup (${source}).`,
    '',
    email,
    '',
    `Shopify marketing list: ${subscribed.state}${
      subscribed.reason ? ` (${subscribed.reason})` : ''
    }`,
    ...(betaTag ? ['', `Now Playing early access: ${betaTag}`] : []),
  ].join('\n');
  return {subject, text};
}
