import {useLoaderData} from 'react-router';

/**
 * Buyer-facing download page for sws-downloads (repos/sws-downloads),
 * SWS's own digital file delivery Worker. Reached from the order
 * confirmation email link (email/order-confirmation-snippet.liquid) or the
 * "Get your download" button on /account/orders/:id.
 *
 * The token in the URL IS the capability -- same token Shopify already put
 * in order_status_url, so no login is required and none of this ever sees
 * a customer email/name/address. See repos/sws-downloads/PLAN.md.
 *
 * @type {Route.MetaFunction}
 */
export const meta = () => [
  {title: 'Your download'},
  {name: 'robots', content: 'noindex, nofollow'},
  {name: 'referrer', content: 'no-referrer'},
];

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({params, context, request}) {
  const {token} = params;
  const downloadsUrl = context.env?.SWS_DOWNLOADS_URL;

  if (!downloadsUrl) {
    return Response.json(
      {status: 'unconfigured'},
      {status: 503, headers: {'Cache-Control': 'no-store'}},
    );
  }

  let entitlement;
  try {
    const res = await fetch(`${downloadsUrl}/api/entitlement/${encodeURIComponent(token)}`, {
      headers: {'Cache-Control': 'no-cache'},
    });
    entitlement = await res.json();
  } catch (err) {
    console.error('sws-downloads /api/entitlement fetch failed:', err);
    entitlement = {status: 'error'};
  }

  return Response.json(
    {token, entitlement, currentUrl: request.url},
    {headers: {'Cache-Control': 'no-store'}},
  );
}

export default function DownloadsToken() {
  /** @type {LoaderReturnData} */
  const {token, entitlement, currentUrl} = useLoaderData();
  const status = entitlement?.status;

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={{fontSize: '1.4rem', marginBottom: '0.5rem'}}>Your download</h1>

        {status === 'ready' && <ReadyState token={token} entitlement={entitlement} />}
        {status === 'preparing' && <PreparingState currentUrl={currentUrl} />}
        {status === 'refunded' && <RefundedState />}
        {status === 'limit' && <LimitState />}
        {(status === 'unconfigured' || status === 'error' || !status) && <ErrorState />}
      </div>
    </div>
  );
}

function ReadyState({token, entitlement}) {
  return (
    <>
      {entitlement.order_name && (
        <p style={{color: '#6b6478', marginBottom: '1rem'}}>Order {entitlement.order_name}</p>
      )}
      {entitlement.lines?.length === 0 && (
        <p>No files found for this order yet. If this is unexpected, contact us.</p>
      )}
      {entitlement.lines?.map((line) => (
        <div key={line.product_id} style={{marginBottom: '1.25rem'}}>
          <h2 style={{fontSize: '1rem', marginBottom: '0.5rem'}}>{line.title}</h2>
          <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
            {line.files.map((file) => (
              <li key={file.id} style={{marginBottom: '0.5rem'}}>
                <a
                  href={`/downloads/${encodeURIComponent(token)}/${file.id}`}
                  style={downloadLinkStyle}
                >
                  Download {file.filename}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p style={{fontSize: '0.8rem', color: '#6b6478', marginTop: '1.5rem'}}>
        {entitlement.download_count}/{entitlement.max_downloads} downloads used. Each download link
        works for a few minutes after you click it, so re-click the button above if a download does
        not start.
      </p>
    </>
  );
}

function PreparingState({currentUrl}) {
  return (
    <>
      <p>We are still preparing your files. This usually takes under a minute.</p>
      <p>
        <a href={currentUrl} style={downloadLinkStyle}>
          Refresh this page
        </a>
      </p>
      <p style={{fontSize: '0.8rem', color: '#6b6478', marginTop: '1rem'}}>
        If this order does not include a digital download, or this page still says preparing after
        a few minutes, contact us and we will sort it out.
      </p>
    </>
  );
}

function RefundedState() {
  return <p>This order was refunded or cancelled, so the download is no longer available.</p>;
}

function LimitState() {
  return (
    <p>
      This order has reached its download limit. Contact us if you need your files again and we
      will reset it.
    </p>
  );
}

function ErrorState() {
  return <p>We could not load your download right now. Please try again in a moment.</p>;
}

const pageStyle = {
  minHeight: '60vh',
  display: 'flex',
  justifyContent: 'center',
  padding: '2rem 1rem',
  background: '#141020',
  color: '#f4f1fb',
};

const cardStyle = {
  width: '100%',
  maxWidth: '420px',
};

const downloadLinkStyle = {
  display: 'inline-block',
  background: '#7c3aed',
  color: '#ffffff',
  textDecoration: 'none',
  padding: '0.6rem 1rem',
  borderRadius: '6px',
  fontSize: '0.9rem',
};

/** @typedef {import('./+types/downloads.$token').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
