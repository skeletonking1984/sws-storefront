/**
 * Registered browser analytics pixels.
 *
 * Every pixel module (ga4.js, x.js, meta.js, ...) exports the same
 * four-piece interface, mirroring app/lib/conversions/index.server.js on
 * the server side so both halves of this app's analytics feel the same:
 *
 *   export const id = 'ga4';
 *   export const envKeys = {configKey: 'ENV_VAR_NAME', ...};
 *   export function isConfigured(config) { ... }
 *   export function loadScript(config, nonce) { ... }
 *   export function send(event, config) { ... }
 *
 * A fifth piece, `export function didLoad() { ... }`, is optional and
 * only implemented by ga4.js today -- see that file for what it checks
 * and why. PixelBus.jsx uses it to decide whether to relay an event to
 * the same-origin fallback (app/routes/api.e.jsx) when a blocker kept the
 * real pixel script from ever loading. A pixel without `didLoad` never has
 * its events relayed, it is assumed to have loaded.
 *
 * `envKeys` maps this adapter's own config keys to the env var names that
 * fill them, so `buildAnalyticsConfig` below can derive the whole
 * analytics config for every platform without app/root.jsx ever knowing
 * what those keys are named. Adding a platform to app/root.jsx is never
 * needed again -- see PixelBus.jsx, which reads `pixels` directly.
 *
 * Add a new platform by writing one file with this shape under
 * app/lib/analytics/pixels/ and adding it to the array below -- nothing
 * else in this file, in PixelBus.jsx, or in app/root.jsx needs to change.
 */

import * as ga4 from './pixels/ga4';
import * as x from './pixels/x';
import * as meta from './pixels/meta';

export const pixels = [ga4, x, meta];

/**
 * Derives the app-wide analytics config from env, one slice per pixel,
 * keyed by each pixel's own `id`. Called once in app/root.jsx's loader
 * and passed straight through to <PixelBus config={...} />.
 *
 * @param {Record<string, string | undefined>} env
 * @returns {Record<string, Record<string, string | undefined>>}
 */
export function buildAnalyticsConfig(env) {
  /** @type {Record<string, Record<string, string | undefined>>} */
  const config = {};

  for (const pixel of pixels) {
    /** @type {Record<string, string | undefined>} */
    const pixelConfig = {};
    for (const [configKey, envVarName] of Object.entries(pixel.envKeys)) {
      pixelConfig[configKey] = env?.[envVarName];
    }
    config[pixel.id] = pixelConfig;
  }

  return config;
}
