/**
 * Registered purchase-conversion destinations.
 *
 * Every destination module (ga4.server.js, x.server.js, ...) exports the
 * same three-piece interface, plus one optional fourth piece:
 *
 *   export const id = 'ga4';
 *   export function isConfigured(env) { ... }
 *   export async function sendPurchase({env, order, clickIds, eventId}) { ... }
 *   export async function sendEvent({env, name, params, clickIds}) { ... } // optional
 *
 * `isConfigured` must be a pure, synchronous check of env vars -- no
 * network calls -- so a caller can skip an unconfigured destination
 * without ever invoking it. `sendPurchase` and `sendEvent` must never
 * throw: every destination is responsible for catching its own errors and
 * returning `{ok: false, reason}` instead, so one destination's failure
 * never stops another's from running. See app/routes/webhooks.orders.jsx
 * for the `sendPurchase` fan-out loop, app/routes/api.e.jsx for the
 * `sendEvent` one, and docs/conversion-tracking.md for the full standard.
 *
 * `sendEvent` is optional because it covers the pre-purchase funnel
 * events (page_view, view_item, add_to_cart, ...), not every destination
 * has a Measurement-Protocol-style endpoint for those, and a destination
 * that omits it is simply filtered out of api.e.jsx's fan-out -- no error,
 * no special case. `name` is one of the normalized event names from
 * app/lib/analytics/events.js (never `purchase`, see api.e.jsx), `params`
 * is that event's own payload, and `clickIds` is the same map
 * `sendPurchase` gets, from the same app/lib/clickIds.server.js registry.
 *
 * Add a new platform by writing one file with this shape and adding it to
 * the array below -- nothing else in this file, and nothing in the
 * webhook or the event relay, needs to change.
 */

import * as ga4 from './ga4.server';
import * as x from './x.server';
import * as meta from './meta.server';

export const destinations = [ga4, x, meta];
