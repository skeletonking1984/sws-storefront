import {redirect} from 'react-router';

/**
 * Short alias for the commissions landing page.
 *
 * Why, 2026-10-07: "commissions" is the word used in the X DMs and in the
 * Linear issues, so it is the other URL someone guesses. Points at the same
 * canonical `/pages/custom-widgets`. 301.
 */
export function loader() {
  return redirect('/pages/custom-widgets', 301);
}

export default function CommissionsAlias() {
  return null;
}
