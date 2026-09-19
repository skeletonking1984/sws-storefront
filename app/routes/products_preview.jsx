import {redirect} from 'react-router';

/**
 * Shopify admin's "Preview" button on a product builds
 * `<primary-domain>/products_preview?preview_key=...`. That is an Online Store
 * (Liquid) route. This storefront is Hydrogen and has no such route, so the
 * button landed on the catch-all and rendered a bare 404 on the customer-facing
 * domain.
 *
 * Forward it to the myshopify domain, which still serves the Online Store and
 * knows how to resolve a preview key. The Storefront API never returns draft
 * products, so Hydrogen genuinely cannot render the draft itself; handing the
 * request back to the Online Store is the only thing that can.
 *
 * `_sws` guards against a redirect loop: if Shopify bounces the myshopify
 * domain back to the primary domain, the second pass renders an explanation
 * instead of forwarding again.
 */
export async function loader({request, context}) {
  const url = new URL(request.url);
  const key = url.searchParams.get('preview_key');
  const domain = context?.env?.PUBLIC_STORE_DOMAIN;

  if (key && domain && !url.searchParams.has('_sws')) {
    const target = new URL(`https://${domain}/products_preview`);
    target.searchParams.set('preview_key', key);
    target.searchParams.set('_sws', '1');
    return redirect(target.toString(), 302);
  }

  return {key, domain: domain ?? null};
}

export default function ProductsPreview({loaderData}) {
  const {key, domain} = loaderData ?? {};
  return (
    <div className="products-preview">
      <h1>Preview lives on the Online Store</h1>
      <p>
        This storefront is headless, so it cannot render a draft product. The
        Storefront API only returns products that are Active and published to a
        sales channel.
      </p>
      <ul>
        <li>
          To check copy and images on a draft, use the preview link on the
          product in Shopify admin, on the <code>shopifypreview.com</code>{' '}
          domain rather than this one.
        </li>
        <li>
          To see the real page, set the product Active and publish it to{' '}
          <b>Stream Widget Shop Headless</b> and <b>SWS Storefront</b>, then open{' '}
          <code>/products/&lt;handle&gt;</code> here.
        </li>
      </ul>
      {key ? (
        <p className="products-preview__key">
          preview key <code>{key}</code>
          {domain ? (
            <>
              {' '}
              &middot;{' '}
              <a href={`https://${domain}/products_preview?preview_key=${key}`}>
                try the Online Store directly
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      <p>
        <a href="/collections/all">Browse the live catalogue</a>
      </p>
    </div>
  );
}

/** @typedef {import('./+types/products_preview').Route} Route */
