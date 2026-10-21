import {Analytics, getShopAnalytics, useNonce} from '@shopify/hydrogen';
import {useEffect, useState} from 'react';
import {
  Outlet,
  useRouteError,
  isRouteErrorResponse,
  Links,
  Meta,
  Scripts,
  ScrollRestoration,
  useRouteLoaderData,
} from 'react-router';
import faviconPng from '~/assets/favicon.png';
import {appleTouchIconPng as appleTouchIcon, logoWebp} from '~/lib/cdnAssets';
import baloo2Latin from '~/assets/fonts/baloo-2-latin.woff2?url';
import nunitoLatin from '~/assets/fonts/nunito-latin.woff2?url';
import {FOOTER_QUERY, HEADER_QUERY, NAV_QUERY} from '~/lib/fragments';
import {OVERLAY_FEATURED_HANDLES, WIDGETS_FEATURED_HANDLE} from '~/lib/nav';
import {resolveCollection} from '~/lib/collectionHandles';
import {brand} from '~/lib/brand.config';
import resetStyles from '~/styles/reset.css?url';
import appStyles from '~/styles/app.css?url';
import tailwindCss from './styles/tailwind.css?url';
import {PageLayout} from './components/PageLayout';
import {PixelBus} from './components/pixels/PixelBus';
import {Starfield} from './components/Starfield';
import {buildAnalyticsConfig} from '~/lib/analytics/registry';
import {loadLiveBannerForPage} from '~/lib/liveBanner';

/**
 * This is important to avoid re-fetching root queries on sub-navigations
 * @type {ShouldRevalidateFunction}
 */
export const shouldRevalidate = ({formMethod, currentUrl, nextUrl}) => {
  // revalidate when a mutation is performed e.g add to cart, login...
  if (formMethod && formMethod !== 'GET') return true;

  // revalidate when manually revalidating via useRevalidator
  if (currentUrl.toString() === nextUrl.toString()) return true;

  // Defaulting to no revalidation for root loader data to improve performance.
  // When using this feature, you risk your UI getting out of sync with your server.
  // Use with caution. If you are uncomfortable with this optimization, update the
  // line below to `return defaultShouldRevalidate` instead.
  // For more details see: https://remix.run/docs/en/main/route/should-revalidate
  return false;
};

/**
 * The main and reset stylesheets are added in the Layout component
 * to prevent a bug in development HMR updates.
 *
 * This avoids the "failed to execute 'insertBefore' on 'Node'" error
 * that occurs after editing and navigating to another page.
 *
 * It's a temporary fix until the issue is resolved.
 * https://github.com/remix-run/remix/issues/9242
 */
export function links() {
  return [
    {
      rel: 'preconnect',
      href: 'https://cdn.shopify.com',
    },
    {
      rel: 'preconnect',
      href: 'https://shop.app',
    },
    /*
     * The two fonts the first screen actually paints in, preloaded from our
     * own origin. They used to come from a render blocking Google Fonts
     * stylesheet behind two preconnects, which meant the hero painted in the
     * fallback and then jumped: Lighthouse attributed 0.1322 of the homepage's
     * 0.1323 CLS to that single reflow. latin-ext is deliberately NOT
     * preloaded, its unicode-range keeps it off pages that do not need it.
     */
    /*
     * The logo is the homepage LCP element, and it is the header and footer
     * brand mark on every other page, so it is worth the early request
     * everywhere.
     */
    {rel: 'preload', as: 'image', href: logoWebp, fetchPriority: 'high'},
    {
      rel: 'preload',
      as: 'font',
      type: 'font/woff2',
      href: baloo2Latin,
      crossOrigin: 'anonymous',
    },
    {
      rel: 'preload',
      as: 'font',
      type: 'font/woff2',
      href: nunitoLatin,
      crossOrigin: 'anonymous',
    },
    {rel: 'icon', type: 'image/png', sizes: '32x32', href: faviconPng},
    {rel: 'apple-touch-icon', sizes: '180x180', href: appleTouchIcon},
  ];
}

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader(args) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  const {storefront, env} = args.context;

  // True when server.js decided this response may be stored by Oxygen's
  // full-page cache. Such a response is handed to every visitor, so it must
  // hold nothing about one visitor: no cart, no login state. They are fetched
  // by the browser from /api/v instead (see useVisitor below).
  const visitorPending = Boolean(args.context.edgeCacheable);

  // Canonical origin for SEO tags (canonical link, og:url, twitter). Uses
  // the production domain whenever the request actually came in on it, and
  // falls back to the real request origin otherwise (localhost, an Oxygen
  // preview host, etc). Never hardcode the myshopify.dev preview host here.
  const requestUrl = new URL(args.request.url);
  const origin =
    requestUrl.hostname === brand.domain ? brand.origin : requestUrl.origin;

  return {
    ...deferredData,
    ...criticalData,
    origin,
    visitorPending,
    /*
     * Chrome origin trial token for WebMCP. Without one served by the page,
     * `document.modelContext` is undefined for every ordinary Chrome visitor
     * and every registerTool call in AgentTools.jsx is a silent no-op: the
     * chrome://flags switch only helps the person who flipped it.
     *
     * Optional. Unset, the meta tag is simply not rendered and nothing
     * breaks. Register the origin at https://developer.chrome.com/origintrials
     * and set PUBLIC_WEBMCP_ORIGIN_TRIAL_TOKEN on both Oxygen environments.
     */
    webmcpOriginTrialToken:
      (brand.features.webmcp && env.PUBLIC_WEBMCP_ORIGIN_TRIAL_TOKEN) || null,
    // Stream Chat Lite nav link + homepage slot, launched 2026-09-26.
    // Kept as a flag so it can be switched off in one place.
    showPreviewFeatures: true,
    publicStoreDomain: env.PUBLIC_STORE_DOMAIN,
    shop: getShopAnalytics({
      storefront,
      publicStorefrontId: env.PUBLIC_STOREFRONT_ID,
    }),
    // Browser analytics config, derived from env by the pixel registry
    // (see app/lib/analytics/registry.js) -- adding a platform never
    // requires touching this file again, only writing the new adapter
    // under app/lib/analytics/pixels/ and adding it to that registry's
    // array. GA4 is live (PUBLIC_GA4_MEASUREMENT_ID). X and Meta pixel IDs
    // do not exist yet; every adapter no-ops cleanly while its env vars
    // are unset, see app/lib/analytics/pixels/*.js.
    analyticsConfig: buildAnalyticsConfig(env),
    consent: {
      checkoutDomain: env.PUBLIC_CHECKOUT_DOMAIN,
      storefrontAccessToken: env.PUBLIC_STOREFRONT_API_TOKEN,
      withPrivacyBanner: false,
      // localize the privacy banner
      country: args.context.storefront.i18n.country,
      language: args.context.storefront.i18n.language,
    },
  };
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 * @param {Route.LoaderArgs}
 */
async function loadCriticalData({context}) {
  const {storefront} = context;

  const [header, liveBanner] = await Promise.all([
    storefront.query(HEADER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        headerMenuHandle: 'main-menu', // Adjust to your header menu handle
      },
    }),
    // Sitewide "We're live" bar above the header. Metafield on AND channel
    // verified live (cached 60s); fails closed (null).
    //
    // Null for an edge cacheable response: that HTML is stored for up to
    // max-age + stale-while-revalidate (about 32 minutes) and would keep
    // saying "We're live" long after the stream ended. The browser gets the
    // banner from /api/v instead (never cached), see useVisitor below.
    loadLiveBannerForPage(context),
  ]);

  return {header, liveBanner};
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 * @param {Route.LoaderArgs}
 */
function loadDeferredData({context}) {
  const {storefront, customerAccount, cart} = context;
  // Edge cacheable response: no per-visitor data may be read here, not even
  // to render it. See `visitorPending` in the loader.
  const edgeCacheable = Boolean(context.edgeCacheable);

  // defer the footer query (below the fold)
  const footer = storefront
    .query(FOOTER_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        footerMenuHandle: 'footer', // Adjust to your footer menu handle
      },
    })
    .catch((error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });

  // Mega menu tiles/cards + search palette "Top widgets" thumbnails. Runs
  // on every route via the root loader, so this must never block TTFB:
  // deferred, cached long, and swallows its own errors so a bad response
  // just falls back to plain links instead of breaking the whole nav.
  const navData = storefront
    .query(NAV_QUERY, {
      cache: storefront.CacheLong(),
      variables: {
        featuredWidgetHandle: WIDGETS_FEATURED_HANDLE,
        overlayHandle0: OVERLAY_FEATURED_HANDLES[0],
        overlayHandle1: OVERLAY_FEATURED_HANDLES[1],
        overlayHandle2: OVERLAY_FEATURED_HANDLES[2],
        overlayHandle3: OVERLAY_FEATURED_HANDLES[3],
      },
    })
    // NAV_QUERY fetches Chat/Goal Widgets under both their current and
    // legacy handle (see app/lib/collectionHandles.js and the header
    // comment on NAV_QUERY). Collapsed back down to the plain
    // `chatWidgets`/`goalWidgets` keys here, the one place that has to
    // know about the rename gap, so Header.jsx and everything else reads
    // exactly the shape it always has.
    .then((data) =>
      data
        ? {
            ...data,
            chatWidgets: resolveCollection(
              data.chatWidgetsCurrent,
              data.chatWidgetsLegacy,
            ),
            goalWidgets: resolveCollection(
              data.goalWidgetsCurrent,
              data.goalWidgetsLegacy,
            ),
          }
        : data,
    )
    .catch((error) => {
      console.error(error);
      return null;
    });

  return {
    cart: edgeCacheable ? null : cart.get(),
    isLoggedIn: edgeCacheable ? false : customerAccount.isLoggedIn(),
    footer,
    navData,
  };
}

/**
 * @param {{children?: React.ReactNode}}
 */
export function Layout({children}) {
  const nonce = useNonce();
  // Layout renders for error boundaries too, when the root loader may never
  // have run, so this has to tolerate undefined data rather than destructure.
  const rootData = useRouteLoaderData('root');
  const originTrialToken = rootData?.webmcpOriginTrialToken;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        {/* Tints mobile browser chrome (tab bar / status bar) to match the
            site's own background, brand.config.js `theme.color` (same value
            as --sws-bg in app/styles/app.css). */}
        <meta name="theme-color" content={brand.theme.color} />
        {/*
          Pinterest domain claim for the production domain (brand.config.js
          `domain`).

          Pinterest rejected all 122 items of /feed.pinterest.csv with Error
          139, "the item link values don't match the verified domain
          associated with this account". The account had already claimed
          the shop.<domain> checkout subdomain, the Oxygen URL and the
          myshopify domain, but never the apex, and every feed link points
          at the apex.

          Pinterest treats each domain as separate, so claiming the checkout
          host does nothing for links to the storefront.

          Their docs say the tag can be removed once claimed. It stays: it is
          one line, and re-claiming later is avoidable work. The value is a
          public verification string, not a credential.
        */}
        <meta
          name="p:domain_verify"
          content="0ae66c7f1313ebf7092aea3bc2e447df"
        />
        {/* Meta (Facebook) domain verification, added 2026-09-18. Required before
            Meta will attribute conversions to the production domain (brand.config.js
            `domain`), which gates running ads against the Shopify-fed dataset
            511838711286120. Meta's
            own note: verification fails if the tag is outside <head> or injected
            by JavaScript, so it is rendered server side here rather than by a
            pixel component. Public verification string, not a credential. */}
        <meta
          name="facebook-domain-verification"
          content="1xrp2sgk9we6sbcnmq37rm1t4i4ru8"
        />
        {/* Opts real visitors into the WebMCP origin trial, which is what
            makes document.modelContext exist for them at all. Must be in the
            head and must be present on the first response, so it cannot be
            injected later by script. */}
        {originTrialToken ? (
          <meta httpEquiv="origin-trial" content={originTrialToken} />
        ) : null}
        <link rel="stylesheet" href={tailwindCss}></link>
        <link rel="stylesheet" href={resetStyles}></link>
        <link rel="stylesheet" href={appStyles}></link>
        <Meta />
        <Links />
      </head>
      <body>
        {/* Behind everything, painted server side, never in the layout. See
            app/components/Starfield.jsx. */}
        <Starfield />
        {children}
        <ScrollRestoration nonce={nonce} />
        <Scripts nonce={nonce} />
      </body>
    </html>
  );
}

/**
 * Cart, login state and the live banner for a page that came out of the edge
 * cache.
 *
 * Such a page is rendered once for everybody, so it ships an empty cart, a
 * signed out header and no "We're live" banner. This fetches the real values
 * from /api/v, a route that is never cached, right after hydration. The same
 * request is also what sets the first-party `sws_cid`/`sws_ses` cookies a
 * cached response cannot set.
 *
 * Returns null until the answer arrives, which is also what the server
 * rendered (no banner either), so hydration matches. Once the page does a
 * real mutation (add to cart) the root loader revalidates, comes back with
 * `visitorPending: false` and live data, and this value is no longer used.
 *
 * @param {boolean | undefined} pending
 * @returns {{cart: object | null, isLoggedIn: boolean, liveBanner: object | null} | null}
 */
function useVisitor(pending) {
  const [visitor, setVisitor] = useState(null);
  useEffect(() => {
    if (!pending) return undefined;
    let cancelled = false;
    fetch('/api/v', {credentials: 'same-origin', cache: 'no-store'})
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json) setVisitor(json);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pending]);
  return visitor;
}

export default function App() {
  /** @type {RootLoader} */
  const data = useRouteLoaderData('root');
  const visitor = useVisitor(data?.visitorPending);

  if (!data) {
    return <Outlet />;
  }

  const live = data.visitorPending && visitor ? visitor : data;

  return (
    <Analytics.Provider
      cart={live.cart}
      shop={data.shop}
      consent={data.consent}
    >
      <PixelBus config={data.analyticsConfig} />
      <PageLayout
        {...data}
        cart={live.cart}
        isLoggedIn={live.isLoggedIn}
        liveBanner={live.liveBanner ?? null}
      >
        <Outlet />
      </PageLayout>
    </Analytics.Provider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  let errorMessage = 'Unknown error';
  let errorStatus = 500;

  if (isRouteErrorResponse(error)) {
    errorMessage = error?.data?.message ?? error.data;
    errorStatus = error.status;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  }

  return (
    <div className="route-error">
      <h1>Oops</h1>
      <h2>{errorStatus}</h2>
      {errorMessage && (
        <fieldset>
          <pre>{errorMessage}</pre>
        </fieldset>
      )}
    </div>
  );
}

/** @typedef {LoaderReturnData} RootLoader */

/** @typedef {import('react-router').ShouldRevalidateFunction} ShouldRevalidateFunction */
/** @typedef {import('./+types/root').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
