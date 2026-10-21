import {redirect} from 'react-router';
import {DISCORD_INVITE} from '~/lib/discord';
import {brand} from '~/lib/brand.config';

/**
 * Stable Discord link: <origin>/discord (brand.config.js `origin`)
 * Emails and product PDFs point here so they never carry an invite that can
 * expire. 302, not 301, so a changed invite is picked up immediately.
 *
 * Gated by `features.discord`: a clone with no Discord server 404s here
 * instead of redirecting to nothing.
 */
export function loader() {
  if (!brand.features.discord || !DISCORD_INVITE) {
    throw new Response('Not found', {status: 404});
  }
  return redirect(DISCORD_INVITE, 302);
}
