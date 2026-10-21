/**
 * Claims a Now Playing beta slot from the sws-downloads Worker.
 *
 * SERVER ONLY. Uses the shared service secret (PRIVATE_DOWNLOADS_SERVICE_SECRET),
 * so a browser can never mint a link directly: the claim endpoint rejects
 * anything without it. Fails CLOSED: any problem returns {status: 'error'}
 * and the visitor gets no link.
 */
import {BETA_SLUG} from '~/lib/nowPlayingBeta';

const CLAIM_TIMEOUT_MS = 8000;

/**
 * @param {{email: string, env: Record<string, string|undefined>}} args
 * @returns {Promise<{status: 'granted', n: number, cap: number, left: number, url: string} | {status: 'waitlist', cap: number} | {status: 'error', reason: string}>}
 */
export async function claimNowPlayingBeta({email, env}) {
  const base = env?.SWS_DOWNLOADS_URL;
  const secret = env?.PRIVATE_DOWNLOADS_SERVICE_SECRET;
  if (!base) return {status: 'error', reason: 'missing_SWS_DOWNLOADS_URL'};
  if (!secret)
    return {
      status: 'error',
      reason: 'missing_PRIVATE_DOWNLOADS_SERVICE_SECRET',
    };
  try {
    const res = await fetch(
      `${base.replace(/\/$/, '')}/api/beta/${BETA_SLUG}/claim`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({email}),
        signal: AbortSignal.timeout(CLAIM_TIMEOUT_MS),
      },
    );
    if (!res.ok) return {status: 'error', reason: `worker_${res.status}`};
    const json = await res.json();
    if (json.status === 'granted' && typeof json.url === 'string') {
      return {
        status: 'granted',
        n: json.n,
        cap: json.cap,
        left: json.left,
        url: json.url,
      };
    }
    if (json.status === 'waitlist') return {status: 'waitlist', cap: json.cap};
    return {status: 'error', reason: 'unexpected_response'};
  } catch (err) {
    return {
      status: 'error',
      reason: err?.name === 'TimeoutError' ? 'timeout' : 'fetch_failed',
    };
  }
}

/** Short tag for the notification subject: GRANTED 3/10, WAITLIST, CLAIM ERROR. */
export function betaSubjectTag(beta) {
  if (!beta) return '';
  if (beta.status === 'granted') return `GRANTED ${beta.n}/${beta.cap}`;
  if (beta.status === 'waitlist') return 'WAITLIST';
  return `CLAIM ERROR: ${beta.reason}`;
}
