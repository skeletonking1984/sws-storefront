import {useFetcher} from 'react-router';
import {BETA_MARKER as MARKER} from '~/lib/nowPlayingBeta';

/**
 * /pages/now-playing: capped, gated early access download (10 spots).
 *
 * The page body (Shopify admin) carries, or has one injected by the loader,
 * a `<div data-sws-beta-gate></div>` marker where the gate goes. The form
 * posts to the shared /api/newsletter path (marketing opt-in) with source
 * `now-playing-beta`; the server then claims a slot from the sws-downloads
 * Worker and returns a short-lived signed download link, or a waitlist
 * verdict when the 10 spots are gone. There is no zip URL in this file, in
 * the page body or in the served HTML: the link exists only in that response.
 */
export function NowPlayingBetaPage({html}) {
  const [before, after = ''] = String(html || '').split(MARKER);
  return (
    <>
      <div dangerouslySetInnerHTML={{__html: before}} />
      <NowPlayingBetaGate />
      <div dangerouslySetInnerHTML={{__html: after}} />
    </>
  );
}

function NowPlayingBetaGate() {
  const fetcher = useFetcher();
  const sending = fetcher.state !== 'idle';
  const beta = fetcher.data?.beta;

  if (beta?.status === 'granted') {
    return (
      <div className="sws-beta-gate sws-beta-gate-done">
        <p className="sws-beta-gate-note">
          You&rsquo;re in. Spot {beta.n} of {beta.cap}.
        </p>
        <a
          className="sws-btn sws-btn-primary sws-beta-gate-btn"
          href={beta.url}
        >
          Download early access
        </a>
        <p className="sws-beta-gate-fine">
          The link works for 10 minutes. Enter your email again for a fresh one.
        </p>
      </div>
    );
  }

  if (beta?.status === 'waitlist') {
    return (
      <div className="sws-beta-gate sws-beta-gate-done">
        <p className="sws-beta-gate-note">
          Early access is full. You&rsquo;re on the list for launch.
        </p>
      </div>
    );
  }

  // Claim could not be completed (Worker down, config). Never show a bare
  // error to a real visitor who gave us their email: the signup itself was
  // recorded and the owner's notification says CLAIM ERROR, so we follow up.
  if (beta?.status === 'error') {
    return (
      <div className="sws-beta-gate sws-beta-gate-done">
        <p className="sws-beta-gate-note">
          You&rsquo;re on the list. We couldn&rsquo;t issue your download just
          now, so we&rsquo;ll follow up by email.
        </p>
      </div>
    );
  }

  const failed = fetcher.data && !beta;

  return (
    <fetcher.Form
      method="post"
      action="/api/newsletter"
      className="sws-beta-gate"
    >
      <input type="hidden" name="source" value="now-playing-beta" />
      <label htmlFor="sws-beta-email" className="sws-beta-gate-label">
        Early access &middot; 10 spots. Enter your email to claim one.
      </label>
      <div className="sws-beta-gate-row">
        <input
          id="sws-beta-email"
          className="sws-beta-gate-input"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
        <button
          type="submit"
          className="sws-btn sws-btn-primary sws-beta-gate-btn"
          disabled={sending}
        >
          {sending ? 'Sending...' : 'Claim a spot'}
        </button>
      </div>
      <div aria-hidden="true" style={{position: 'absolute', left: '-9999px'}}>
        <label htmlFor="sws-beta-company">Company</label>
        <input
          id="sws-beta-company"
          name="company"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <p className="sws-beta-gate-fine">
        You&rsquo;ll also get SWS news and new widget drops. Unsubscribe any
        time.
      </p>
      {failed ? (
        <p className="sws-beta-gate-error" role="alert">
          That email didn&rsquo;t go through. Check it and try again.
        </p>
      ) : null}
    </fetcher.Form>
  );
}
