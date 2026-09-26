import {redirect} from 'react-router';
import {DISCORD_INVITE} from '~/lib/discord';

/**
 * Stable Discord link: https://streamwidgetshop.com/discord
 * Emails and product PDFs point here so they never carry an invite that can
 * expire. 302, not 301, so a changed invite is picked up immediately.
 */
export function loader() {
  return redirect(DISCORD_INVITE, 302);
}
