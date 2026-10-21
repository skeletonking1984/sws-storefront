import {redirect, useLoaderData} from 'react-router';
import {Money, Image} from '@shopify/hydrogen';
import {DownloadsList} from '~/components/DownloadsList';
import {CUSTOMER_ORDER_QUERY} from '~/graphql/customer-account/CustomerOrderQuery';
import {
  downloadsConfig,
  WORKER_FETCH_TIMEOUT_MS,
} from '~/lib/downloadsWorker.server';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({data}) => {
  return [
    {title: `Order ${data?.order?.name}`},
    {name: 'robots', content: 'noindex'},
  ];
};

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({params, context}) {
  const {customerAccount} = context;
  if (!params.id) {
    return redirect('/account/orders');
  }

  const orderId = atob(params.id);
  const {data, errors} = await customerAccount.query(CUSTOMER_ORDER_QUERY, {
    variables: {
      orderId,
      language: customerAccount.i18n.language,
    },
  });

  if (errors?.length || !data?.order) {
    throw new Error('Order not found');
  }

  const {order} = data;

  // sws-downloads: ask the Worker for this order's
  // token AND its file list in one call, so the page can render a Download
  // button per file instead of a link to another page that then shows the
  // buttons. Non-fatal on any failure -- the rest of the order page must
  // still render, the email link does not depend on this call at all, and
  // /account/downloads is always reachable from the nav.
  let downloadToken = null;
  let downloadProducts = [];
  const {url: downloadsUrl, secret: downloadsServiceSecret} =
    downloadsConfig(context);
  if (downloadsUrl && downloadsServiceSecret) {
    try {
      const numericOrderId = order.id.split('/').pop();
      const res = await fetch(
        `${downloadsUrl}/api/order/${numericOrderId}/token`,
        {
          headers: {Authorization: `Bearer ${downloadsServiceSecret}`},
          signal: AbortSignal.timeout(WORKER_FETCH_TIMEOUT_MS),
        },
      );
      if (res.ok) {
        const json = await res.json();
        downloadToken = json.token ?? null;
        downloadProducts = json.products ?? [];
      }
    } catch (err) {
      console.error('sws-downloads order token lookup failed:', err);
    }
  }

  // Extract line items directly from nodes array
  const lineItems = order.lineItems.nodes;

  // Extract discount applications directly from nodes array
  const discountApplications = order.discountApplications.nodes;

  // Get fulfillment status from first fulfillment node
  const fulfillmentStatus = order.fulfillments.nodes[0]?.status ?? 'N/A';

  // Get first discount value with proper type checking
  const firstDiscount = discountApplications[0]?.value;

  // Type guard for MoneyV2 discount
  const discountValue =
    firstDiscount?.__typename === 'MoneyV2' ? firstDiscount : null;

  // Type guard for percentage discount
  const discountPercentage =
    firstDiscount?.__typename === 'PricingPercentageValue'
      ? firstDiscount.percentage
      : null;

  return {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    fulfillmentStatus,
    downloadToken,
    downloadProducts,
  };
}

export default function OrderRoute() {
  /** @type {LoaderReturnData} */
  const {
    order,
    lineItems,
    discountValue,
    discountPercentage,
    fulfillmentStatus,
    downloadToken,
    downloadProducts,
  } = useLoaderData();
  const hasFiles = downloadToken && downloadProducts?.length > 0;
  return (
    <div className="account-order">
      <h2>Order {order.name}</h2>
      <p>Placed on {new Date(order.processedAt).toDateString()}</p>
      {order.confirmationNumber && (
        <p>Confirmation: {order.confirmationNumber}</p>
      )}

      {/* Files first. This is a download shop; the line-item table is the
          receipt, the buttons are the product. One click each -- the
          /downloads/:token/:fileId resource route re-checks entitlement
          and 302s to a fresh signed URL. */}
      {hasFiles && (
        <section className="account-order-downloads">
          <h3 className="sws-dl-heading">Your files</h3>
          <DownloadsList
            orders={[
              {
                entitlement_id: order.id,
                order_name: order.name,
                products: downloadProducts,
              },
            ]}
            showOrderNames={false}
            hrefFor={(_order, file) =>
              `/downloads/${encodeURIComponent(downloadToken)}/${file.id}`
            }
          />
          <p className="sws-dl-account-link">
            <a href="/account/downloads">All downloads</a>
          </p>
        </section>
      )}

      <br />
      <div>
        <table>
          <thead>
            <tr>
              <th scope="col">Product</th>
              <th scope="col">Price</th>
              <th scope="col">Quantity</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((lineItem, lineItemIndex) => (
              // eslint-disable-next-line react/no-array-index-key
              <OrderLineRow key={lineItemIndex} lineItem={lineItem} />
            ))}
          </tbody>
          <tfoot>
            {((discountValue && discountValue.amount) ||
              discountPercentage) && (
              <tr>
                <th scope="row" colSpan={3}>
                  <p>Discounts</p>
                </th>
                <th scope="row">
                  <p>Discounts</p>
                </th>
                <td>
                  {discountPercentage ? (
                    <span>-{discountPercentage}% OFF</span>
                  ) : (
                    discountValue && <Money data={discountValue} />
                  )}
                </td>
              </tr>
            )}
            <tr>
              <th scope="row" colSpan={3}>
                <p>Subtotal</p>
              </th>
              <th scope="row">
                <p>Subtotal</p>
              </th>
              <td>
                <Money data={order.subtotal} />
              </td>
            </tr>
            <tr>
              <th scope="row" colSpan={3}>
                Tax
              </th>
              <th scope="row">
                <p>Tax</p>
              </th>
              <td>
                <Money data={order.totalTax} />
              </td>
            </tr>
            <tr>
              <th scope="row" colSpan={3}>
                Total
              </th>
              <th scope="row">
                <p>Total</p>
              </th>
              <td>
                <Money data={order.totalPrice} />
              </td>
            </tr>
          </tfoot>
        </table>
        <div>
          <h3>Shipping Address</h3>
          {order?.shippingAddress ? (
            <address>
              <p>{order.shippingAddress.name}</p>
              {order.shippingAddress.formatted ? (
                <p>{order.shippingAddress.formatted}</p>
              ) : (
                ''
              )}
              {order.shippingAddress.formattedArea ? (
                <p>{order.shippingAddress.formattedArea}</p>
              ) : (
                ''
              )}
            </address>
          ) : (
            <p>No shipping address defined</p>
          )}
          <h3>Status</h3>
          <div>
            <p>{fulfillmentStatus}</p>
          </div>
        </div>
      </div>
      <br />
      {/* Granted, but nothing uploaded for these products yet (or the
          Worker was unreachable). Point at the Downloads page rather than
          pretending the order has no files. */}
      {!hasFiles && (
        <p>
          <a href="/account/downloads" className="sws-btn sws-btn-primary">
            Your downloads
          </a>
        </p>
      )}
      <p>
        <a target="_blank" href={order.statusPageUrl} rel="noreferrer">
          View Order Status →
        </a>
      </p>
    </div>
  );
}

/**
 * @param {{lineItem: OrderLineItemFullFragment}}
 */
function OrderLineRow({lineItem}) {
  return (
    <tr key={lineItem.id}>
      <td>
        <div>
          {lineItem?.image && (
            <div>
              <Image data={lineItem.image} width={96} height={96} />
            </div>
          )}
          <div>
            <p>{lineItem.title}</p>
            <small>{lineItem.variantTitle}</small>
          </div>
        </div>
      </td>
      <td>
        <Money data={lineItem.price} />
      </td>
      <td>{lineItem.quantity}</td>
      <td>
        <Money data={lineItem.totalDiscount} />
      </td>
    </tr>
  );
}

/** @typedef {import('./+types/account.orders.$id').Route} Route */
/** @typedef {import('customer-accountapi.generated').OrderLineItemFullFragment} OrderLineItemFullFragment */
/** @typedef {import('customer-accountapi.generated').OrderQuery} OrderQuery */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
