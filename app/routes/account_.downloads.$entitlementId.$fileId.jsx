import {redirect} from 'react-router';
import {CUSTOMER_DOWNLOADS_QUERY} from '~/graphql/customer-account/CustomerDownloadsQuery';
import {
  numericCustomerId,
  signCustomerFile,
} from '~/lib/downloadsWorker.server';

/**
 * GET /account/downloads/:entitlementId/:fileId
 *
 * The one click behind every Download button on /account/downloads.
 * Resource route (no default export, same pattern as
 * downloads.$token.$fileId.jsx): it mints a fresh short-lived signed R2
 * URL from the Worker and 302s the browser straight to it. The file bytes
 * never pass through Oxygen.
 *
 * `account_.` rather than `account.`: this deliberately opts out of the
 * account.jsx layout. A route nested under that layout would need the
 * layout to render an <Outlet>, and a redirect-only resource route has no
 * business booting a layout's loader at all. The customer session comes
 * from context, not from the layout, so nothing is lost.
 *
 * Two independent checks happen before any byte moves:
 *   1. here: who is logged in, from the Customer Account API
 *   2. in the Worker: that this entitlement really belongs to that
 *      customer and this file is really in that order (/api/customer/sign)
 *
 * Step 2 is what makes the URL safe to hand-edit. Changing the ids in the
 * address bar gets a 403 from the Worker, not someone else's file.
 *
 * @param {Route.LoaderArgs}
 */
export async function loader({params, context}) {
  const {customerAccount} = context;
  const {entitlementId, fileId} = params;

  const {data, errors} = await customerAccount.query(CUSTOMER_DOWNLOADS_QUERY, {
    variables: {language: customerAccount.i18n.language},
  });
  if (errors?.length || !data?.customer) {
    // Not signed in (or the session died mid-click). Send them to the page
    // that will prompt sign-in and then show their files.
    return redirect('/account/downloads');
  }

  const result = await signCustomerFile(context, {
    customerId: numericCustomerId(data.customer.id),
    email: data.customer.emailAddress?.emailAddress ?? null,
    entitlementId: Number(entitlementId),
    fileId: Number(fileId),
  });

  if (!result.url) {
    // Back to the Downloads page with a reason the page turns into one
    // friendly sentence. No counter, no quota, no expiry ever reaches the
    // buyer -- see app/components/DownloadsList.jsx.
    return redirect(
      `/account/downloads?issue=${encodeURIComponent(result.error ?? 'unavailable')}`,
    );
  }

  return redirect(result.url, {headers: {'Cache-Control': 'no-store'}});
}

/** @typedef {import('./+types/account_.downloads.$entitlementId.$fileId').Route} Route */
