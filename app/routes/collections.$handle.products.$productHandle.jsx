import {redirect} from 'react-router';
import {legacyNestedProductRedirectTarget} from '~/lib/legacyRedirects';

/**
 * Old theme URL shape: /collections/<any>/products/<handle>. Verified 404 on
 * production 2026-09-28 (Hydrogen's PDP has no collection-nested route).
 * See app/lib/legacyRedirects.js for the target/alias logic and why the
 * collection segment is dropped rather than mapped.
 * @param {Route.LoaderArgs} args
 */
export async function loader({params, request}) {
  const {productHandle} = params;
  if (!productHandle) {
    throw new Response(null, {status: 404});
  }
  const {search} = new URL(request.url);
  throw redirect(legacyNestedProductRedirectTarget(productHandle, search), 301);
}

/** @typedef {import('./+types/collections.$handle.products.$productHandle').Route} Route */
