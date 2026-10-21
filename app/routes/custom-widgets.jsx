import {redirect} from 'react-router';

/**
 * Short alias for the commissions landing page.
 *
 * Why, 2026-10-07: the page lives at `/pages/custom-widgets` because it is a
 * flat route that wins over `pages.$handle`. The bare `/custom-widgets` is the
 * URL people type and paste, and it 404'd. 301 so the canonical page keeps the
 * link equity.
 */
export function loader() {
  return redirect('/pages/custom-widgets', 301);
}

export default function CustomWidgetsAlias() {
  return null;
}
