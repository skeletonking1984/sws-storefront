import {useLoaderData} from 'react-router';
import {DownloadsList} from '~/components/DownloadsList';
import {fetchTokenEntitlement} from '~/lib/downloadsWorker.server';

/**
 * /downloads/<token> -- where the order confirmation email's one button
 * lands.
 *
 * This renders the SAME Downloads list as /account/downloads, immediately,
 * with a Download button per file and no sign-in. The token in the URL IS
 * the capability (the same token Shopify already put in order_status_url),
 * so there is no login step, no interstitial and no "continue to your
 * download" page between the email and the buttons. That was the whole
 * complaint: email -> page -> button -> another page -> a counter.
 *
 * The token page URL itself does not expire. The short-lived thing is the
 * signed R2 URL minted invisibly behind each button, and the buyer never
 * sees or keeps one of those. An email from a year ago still opens this
 * page and the buttons still work.
 *
 * Nothing on this page states a download count, a quota or an expiry. See
 * app/components/DownloadsList.jsx.
 *
 * @type {Route.MetaFunction}
 */
export const meta = () => [
  {title: 'Your downloads'},
  {name: 'robots', content: 'noindex, nofollow'},
  {name: 'referrer', content: 'no-referrer'},
];

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({params, context, request}) {
  const {token} = params;
  const entitlement = await fetchTokenEntitlement(context, token);

  const url = new URL(request.url);
  // A download that could not be served bounces back here with
  // ?issue=<code>. The code is for our logs; the buyer gets one sentence.
  const hadIssue = url.searchParams.has('issue');
  url.searchParams.delete('issue');

  return Response.json(
    {token, entitlement, hadIssue, currentUrl: url.toString()},
    {headers: {'Cache-Control': 'no-store'}},
  );
}

export default function DownloadsToken() {
  /** @type {LoaderReturnData} */
  const {token, entitlement, hadIssue, currentUrl} = useLoaderData();
  const status = entitlement?.status;

  return (
    <div className="sws-dl-page">
      <div className="sws-dl-card">
        <h1 className="sws-dl-heading">Your downloads</h1>

        {hadIssue && (
          <p className="sws-dl-notice" role="status">
            That one did not go through. Try it again, and if it still will not
            start, reply to your order email and we will sort it out.
          </p>
        )}

        {status === 'ready' && (
          <ReadyState token={token} entitlement={entitlement} />
        )}
        {status === 'preparing' && <PreparingState currentUrl={currentUrl} />}
        {status === 'refunded' && <RefundedState />}
        {(status === 'unconfigured' || status === 'error' || !status) && (
          <ErrorState />
        )}
      </div>
    </div>
  );
}

function ReadyState({token, entitlement}) {
  // The Worker returns just this order (TOKEN_PAGE_SHOWS_ALL_ORDERS is
  // "false", so a forwarded order email cannot expose the buyer's other
  // orders), and this buyer's whole Downloads list only if that flag is
  // ever turned on. Either shape renders: `showOrderNames` keys off how
  // many came back, and the "See all your downloads in your account" link
  // is always there for the cross-order view. `lines` is the pre-2026-10-09
  // shape, kept so this page keeps working if it is ever deployed ahead of
  // the Worker.
  const orders =
    entitlement.orders ??
    (entitlement.lines
      ? [
          {
            entitlement_id: 'current',
            order_name: entitlement.order_name,
            products: entitlement.lines,
          },
        ]
      : []);

  return (
    <>
      <p className="sws-dl-intro">
        Click Download and the file saves. Nothing to set up first.
      </p>
      <DownloadsList
        orders={orders}
        showOrderNames={orders.length > 1}
        accountLinkHref="/account/downloads"
        hrefFor={(order, file) =>
          `/downloads/${encodeURIComponent(token)}/${file.id}`
        }
      />
    </>
  );
}

function PreparingState({currentUrl}) {
  return (
    <div className="sws-dl-empty">
      <p>
        We are still putting your files together. This usually takes seconds.
      </p>
      <p>
        <a className="sws-dl-button" href={currentUrl}>
          Refresh
        </a>
      </p>
      <p className="sws-dl-support">
        Having trouble? Reply to your order email and we&apos;ll sort it out.
      </p>
    </div>
  );
}

function RefundedState() {
  return (
    <div className="sws-dl-empty">
      <p>
        This order was refunded or cancelled, so the files are no longer
        available.
      </p>
      <p className="sws-dl-support">
        Having trouble? Reply to your order email and we&apos;ll sort it out.
      </p>
    </div>
  );
}

function ErrorState() {
  return (
    <div className="sws-dl-empty">
      <p>
        We could not load your files just now. Please try again in a moment.
      </p>
      <p className="sws-dl-support">
        Having trouble? Reply to your order email and we&apos;ll sort it out.
      </p>
    </div>
  );
}

/** @typedef {import('./+types/downloads.$token').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
