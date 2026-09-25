import {redirect} from 'react-router';

/**
 * Resource route (no default export, same pattern as webhooks.orders.jsx
 * and api.e.jsx): mints a fresh signed R2 URL from the sws-downloads
 * Worker and 302s the browser straight to it. Never proxies the file
 * bytes through Oxygen -- the Worker streams directly from R2.
 *
 * @param {Route.LoaderArgs}
 */
// If the Worker hangs (not down, just slow), don't let this loader ride
// Oxygen's platform timeout -- fail fast back to the download page.
const WORKER_FETCH_TIMEOUT_MS = 6000;

export async function loader({params, context}) {
  const {token, fileId} = params;
  const downloadsUrl = context.env?.SWS_DOWNLOADS_URL;

  if (!downloadsUrl) {
    return redirect(`/downloads/${encodeURIComponent(token)}?error=unconfigured`);
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
    return redirect(`/downloads/${encodeURIComponent(token)}?error=sign_failed`);
  }

  if (!signRes.ok) {
    const reason = await signRes.json().catch(() => ({}));
    console.error(`sws-downloads /api/sign ${signRes.status}:`, reason);
    return redirect(`/downloads/${encodeURIComponent(token)}?error=${encodeURIComponent(reason.error || 'sign_failed')}`);
  }

  const {url} = await signRes.json();
  return redirect(url, {headers: {'Cache-Control': 'no-store'}});
}

/** @typedef {import('./+types/downloads.$token.$fileId').Route} Route */
