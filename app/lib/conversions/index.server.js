/**
 * Registered purchase-conversion destinations.
 *
 * Every destination module (ga4.server.js, x.server.js, ...) exports the
 * same three-piece interface:
 *
 *   export const id = 'ga4';
 *   export function isConfigured(env) { ... }
 *   export async function sendPurchase({env, order, clickIds, eventId}) { ... }
 *
 * `isConfigured` must be a pure, synchronous check of env vars -- no
 * network calls -- so the webhook can skip an unconfigured destination
 * without ever invoking it. `sendPurchase` must never throw: every
 * destination is responsible for catching its own errors and returning
 * `{ok: false, reason}` instead, so one destination's failure never stops
 * another's from running. See app/routes/webhooks.orders.jsx for the loop
 * that calls these, and docs/conversion-tracking.md for the full standard.
 *
 * Add a new platform by writing one file with this shape and adding it to
 * the array below -- nothing else in this file, and nothing in the
 * webhook, needs to change.
 */

import * as ga4 from './ga4.server';
import * as x from './x.server';
import * as meta from './meta.server';

export const destinations = [ga4, x, meta];
