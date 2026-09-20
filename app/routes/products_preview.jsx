/**
 * Shopify admin's Preview button on a product builds
 * `<primary-domain>/products_preview?preview_key=...`, an Online Store (Liquid)
 * route this Hydrogen app has no equivalent of. Without this file it lands on
 * the catch-all and renders a bare 404 on the customer-facing domain.
 *
 * MEASURED 2026-09-20, because the first version of this route guessed wrong.
 * It used to forward the request to the myshopify domain on the theory that the
 * Online Store still knows how to resolve a preview key. It does not, and the
 * forward made things worse. The full chain, every hop checked with curl and a
 * key minted seconds earlier:
 *
 *   1. nrexo0v3u7oga9x3-*.shopifypreview.com/products_preview?preview_key=K
 *      200, and it renders the draft correctly.
 *   2. The Hydrogen Redirect Theme (role MAIN, layout/theme.liquid) runs on
 *      that page. Its guard exempts only designMode, /checkpoint,
 *      /throttle/queue and /challenge, so on any other hostname it fires
 *      window.location.replace(href.replace(currentHostname, 'streamwidgetshop.com')).
 *      The rendered draft is thrown away client side, milliseconds after it
 *      arrived.
 *   3. That lands here. The old forward sent it to 72470e-33.myshopify.com,
 *      which 301s to shop.streamwidgetshop.com, which 404s. A preview key is
 *      only valid on the shopifypreview.com session host, never on the store's
 *      own domain, so the forward could not have worked for anyone.
 *   4. The 404 page is served by the same redirect theme, so its script fires
 *      again and sends the browser back here, now carrying the loop guard.
 *      That is the page Todd screenshotted.
 *
 * So this route no longer forwards anywhere. A redirect to a URL proven to 404
 * is two extra hops and a worse error. It explains the loop instead, because
 * the thing that has to change lives in the theme, not here.
 *
 * ALSO TRUE AND EASY TO MISS: even once the theme is fixed, /products_preview
 * renders the ONLINE STORE theme, not this app. On a headless shop that is a
 * Liquid page for a product whose real page is built here, so it shows the copy
 * and the images and tells you nothing about the actual product page. Seeing
 * the real thing means publishing the product.
 *
 * Tested and does NOT help, so nobody re-derives it: appending
 * `preview_theme_id=<an unpublished theme>` to the preview URL. Shopify 302s
 * back to the plain preview URL and serves the MAIN theme regardless, with the
 * redirect script still in it. Verified with a cookie jar so the session theme
 * would have stuck if it were going to.
 */
export async function loader({request, context}) {
  const url = new URL(request.url);
  return {
    key: url.searchParams.get('preview_key'),
    domain: context?.env?.PUBLIC_STORE_DOMAIN ?? null,
  };
}

export const meta = () => [
  {title: 'Product preview | Stream Widget Shop'},
  {name: 'robots', content: 'noindex'},
];

export default function ProductsPreview({loaderData}) {
  const {key} = loaderData ?? {};
  return (
    <div className="products-preview">
      <h1>This is the redirect theme, not a broken product</h1>
      <p className="products-preview__lead">
        The draft rendered fine. The Hydrogen Redirect Theme then sent the
        browser here, because it rewrites the hostname on every Online Store
        page and the preview host is not the storefront host.
      </p>

      <ol className="products-preview__chain">
        <li>
          <code>shopifypreview.com</code> returns the draft, 200.
        </li>
        <li>
          The theme&rsquo;s script replaces the hostname with{' '}
          <code>streamwidgetshop.com</code> and the page is gone.
        </li>
        <li>You land here.</li>
      </ol>

      <h2>To make Preview work, one line in the theme</h2>
      <p>
        Online Store &rarr; Themes &rarr; <b>hydrogen-redirect-theme-main</b>{' '}
        &rarr; Edit code &rarr; <code>layout/theme.liquid</code>. Add a fourth
        condition to the guard that already exempts{' '}
        <code>/checkpoint</code>:
      </p>
      <pre className="products-preview__code">
        {`window.location.hostname.indexOf('.shopifypreview.com') === -1 &&`}
      </pre>
      <p>
        A preview host is never a customer, so it should never be redirected to
        the storefront.
      </p>

      <h2>To see the real product page</h2>
      <p>
        Preview renders the <i>Online Store</i> theme. This shop is headless, so
        even a working preview shows a Liquid page, not the page a buyer gets.
        Set the product Active and publish it to{' '}
        <b>Stream Widget Shop Headless</b> and <b>SWS Storefront</b>, then open{' '}
        <code>/products/&lt;handle&gt;</code> here.
      </p>

      {key ? (
        <p className="products-preview__key">
          preview key <code>{key}</code>
        </p>
      ) : null}

      <p>
        <a className="sws-btn-primary" href="/collections/all">
          Browse the live catalogue
        </a>
      </p>
    </div>
  );
}

/** @typedef {import('./+types/products_preview').Route} Route */
