import {useLoaderData} from 'react-router';
import {DownloadsList} from '~/components/DownloadsList';
import {CUSTOMER_DOWNLOADS_QUERY} from '~/graphql/customer-account/CustomerDownloadsQuery';
import {
  fetchCustomerDownloads,
  numericCustomerId,
} from '~/lib/downloadsWorker.server';

/**
 * /account/downloads -- the Downloads page, modelled on Etsy's
 * "Purchases & Downloads". ONE page listing every file this customer has
 * ever bought, across every order, newest order first, each with a
 * Download button that works on one click.
 *
 * This is the home for files. The order confirmation email and the account
 * order page both point here; nothing else needs to be the "download
 * page".
 *
 * No counters, no expiry, no quotas on this page. See
 * app/components/DownloadsList.jsx for why that is a rule and not a
 * preference.
 *
 * @type {Route.MetaFunction}
 */
export const meta = () => [
  {title: 'Your downloads'},
  {name: 'robots', content: 'noindex, nofollow'},
];

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context, request}) {
  const {customerAccount} = context;
  // Throws into the account layout's own auth handling when not logged in,
  // exactly like the other /account/* routes.
  const {data, errors} = await customerAccount.query(CUSTOMER_DOWNLOADS_QUERY, {
    variables: {language: customerAccount.i18n.language},
  });
  if (errors?.length || !data?.customer) {
    throw new Error('Customer not found');
  }

  const customerId = numericCustomerId(data.customer.id);
  const email = data.customer.emailAddress?.emailAddress ?? null;

  const {orders, unavailable} = await fetchCustomerDownloads(context, {
    customerId,
    email,
  });

  // A download that could not be served bounces back here with ?issue=<code>.
  // The code is for us; the buyer gets one sentence and never sees it.
  const hadIssue = new URL(request.url).searchParams.has('issue');

  return Response.json(
    {orders, unavailable, hadIssue},
    {headers: {'Cache-Control': 'no-cache, no-store, must-revalidate'}},
  );
}

export default function AccountDownloads() {
  /** @type {LoaderReturnData} */
  const {orders, unavailable, hadIssue} = useLoaderData();

  return (
    <div className="account-downloads">
      <h1 className="sws-dl-heading">Downloads</h1>
      <p className="sws-dl-intro">
        Everything you have bought. Click Download and the file saves.
      </p>
      {hadIssue && (
        <p className="sws-dl-notice" role="status">
          That one did not go through. Try it again, and if it still will not
          start, reply to your order email and we will sort it out.
        </p>
      )}
      <DownloadsList
        orders={orders}
        unavailable={unavailable}
        hrefFor={(order, file) =>
          `/account/downloads/${order.entitlement_id}/${file.id}`
        }
      />
    </div>
  );
}

/** @typedef {import('./+types/account.downloads').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
