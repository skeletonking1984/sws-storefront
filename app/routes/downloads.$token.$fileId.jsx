import {redirect} from 'react-router';
import {
  downloadsConfig,
  WORKER_FETCH_TIMEOUT_MS,
} from '~/lib/downloadsWorker.server';

/**
 * GET /downloads/:token/:fileId
 *
 * The one click behind every Download button on the token page. Resource
 * route (no default export, same pattern as webhooks.orders.jsx and
 * api.e.jsx): mints a fresh signed R2 URL from the sws-downloads Worker
 * and 302s the browser straight to it. Never proxies the file bytes
 * through Oxygen -- the Worker streams directly from R2.
 *
 * No caller auth, deliberately: the token is the capability, so this works
 * for a buyer who clicked straight out of their order email and is not
 * logged in. The Worker re-checks the entitlement, the file's membership
 * of the order, the rate limit and the per-file cap on every call.
 *
 * @param {Route.LoaderArgs}
 */
export async function loader({params, context}) {
  const {token, fileId} = params;
  const {url: downloadsUrl} = downloadsConfig(context);

  if (!downloadsUrl) {
    return redirect(
      `/downloads/${encodeURIComponent(token)}?issue=unconfigured`,
    );
  }

  let signRes;
  try {
    signRes = await fetch(`${downloadsUrl}/api/sign`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({token, fileId}),
      signal: AbortSignal.timeout(WORKER_FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    console.error('sws-downloads /api/sign fetch failed:', err);
    return redirect(
      `/downloads/${encodeURIComponent(token)}?issue=sign_failed`,
    );
  }

  if (!signRes.ok) {
    const reason = await signRes.json().catch(() => ({}));
    console.error(
      `sws-downloads /api/sign ${signRes.status}:`,
      reason?.error ?? '(no error field)',
    );
    // `issue` is a code for our logs. The page turns it into one friendly
    // sentence and shows the buyer no counter, quota or expiry.
    return redirect(
      `/downloads/${encodeURIComponent(token)}?issue=${encodeURIComponent(reason.error || 'sign_failed')}`,
    );
  }

  const {url} = await signRes.json();
  return redirect(url, {headers: {'Cache-Control': 'no-store'}});
}

/** @typedef {import('./+types/downloads.$token.$fileId').Route} Route */
