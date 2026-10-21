/**
 * The one Downloads surface, rendered identically in three places:
 *
 *   /account/downloads        every file the logged-in buyer owns
 *   /downloads/<token>        the same list, reached from an order email
 *                             with no login (the token is the capability)
 *   /account/orders/<id>      one order's files, inline
 *
 * It is one component on purpose. The old flow had a separate, plainer
 * "download page" that looked nothing like the account area, which is part
 * of why it read as a security checkpoint rather than a shop
 * (2026-10-09: the gated download flow felt like a security checkpoint, not a shop).
 *
 * RULE, and the reason this file exists: nothing here renders a download
 * count, a quota, an expiry, a countdown or a number of minutes. The caps
 * are real and enforced server-side by the downloads service;
 * the buyer sees a button. If a future change wants to add "3 of 20 used"
 * back, it is a product decision, not a UI tweak.
 */

const SUPPORT_LINE =
  "Having trouble? Reply to your order email and we'll sort it out.";

/**
 * @param {object} props
 * @param {Array} props.orders  [{entitlement_id, order_name, ordered_at, products: [...]}]
 * @param {(order, file) => string} props.hrefFor  one-click download URL builder
 * @param {string} [props.accountLinkHref]  shows "See all your downloads..." when set
 * @param {boolean} [props.unavailable]  the Worker could not be reached
 * @param {boolean} [props.showOrderNames]  false on a single-order surface
 */
export function DownloadsList({
  orders,
  hrefFor,
  accountLinkHref,
  unavailable = false,
  showOrderNames = true,
}) {
  if (unavailable) {
    return (
      <div className="sws-dl-empty">
        <p>
          We could not load your files just now. Please try again in a moment.
        </p>
        <p className="sws-dl-support">{SUPPORT_LINE}</p>
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="sws-dl-empty">
        <p>Nothing here yet. Files show up as soon as an order goes through.</p>
        <p className="sws-dl-support">{SUPPORT_LINE}</p>
      </div>
    );
  }

  return (
    <div className="sws-dl">
      {orders.map((order) => (
        <section
          className="sws-dl-order"
          key={order.entitlement_id ?? order.order_name}
        >
          {showOrderNames && order.order_name && (
            <h2 className="sws-dl-order-name">Order {order.order_name}</h2>
          )}
          {order.products.map((product) => (
            <div className="sws-dl-product" key={product.product_id}>
              <h3 className="sws-dl-product-title">
                {product.title ?? 'Your files'}
              </h3>
              <ul className="sws-dl-files">
                {product.files.map((file) => (
                  <li className="sws-dl-file" key={file.id}>
                    <span className="sws-dl-filename">{file.filename}</span>
                    {/* A plain <a>, never react-router's <Link>. These
                        targets are resource routes that 302 to R2; the
                        client router would follow that redirect with
                        fetch() and hand the browser nothing to save. */}
                    <a className="sws-dl-button" href={hrefFor(order, file)}>
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
      {accountLinkHref && (
        <p className="sws-dl-account-link">
          <a href={accountLinkHref}>See all your downloads in your account</a>
        </p>
      )}
      <p className="sws-dl-support">{SUPPORT_LINE}</p>
    </div>
  );
}

export {SUPPORT_LINE};
