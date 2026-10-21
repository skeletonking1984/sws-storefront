import {useLoaderData} from 'react-router';
import {absoluteAsset, buildMeta, getOrigin} from '~/lib/seo';
import {ogImageBundleJpg as bundleOgImage} from '~/lib/cdnAssets';
import {BundleBuilder} from '~/components/BundleBuilder';
import topSellers from '~/data/top-sellers.json';
import bundleKits from '~/data/bundle-kits.json';
// Server only: the full review text. The loader picks a few short ones and
// sends only those to the page.
import etsyReviewsData from '~/data/etsy-reviews.json';
import bundleStyles from '~/styles/bundle.css?url';

export function links() {
  return [{rel: 'stylesheet', href: bundleStyles}];
}

/** @type {Route.MetaFunction} */
export const meta = ({matches, location}) => {
  const origin = getOrigin(matches);
  return buildMeta({
    title: 'Build Your Own Bundle | Stream Widget Shop',
    description:
      'Pick any 3 to 9 animated stream widgets and save up to 45%. 3 widgets save 25%, 6 save 35%, 9 save 45%. Works with Twitch, Kick, YouTube, OBS, Streamlabs and StreamElements.',
    url: `${origin}${location.pathname}`,
    // Own share card, not the site banner: real listing art in a 3x3 grid
    // with the 3/6/9 tiers, rendered from an HTML template. It is a true 1200x630 banner, so it declares
    // that size and gets the large X card.
    image: absoluteAsset(origin, bundleOgImage),
    imageWidth: 1200,
    imageHeight: 630,
  });
};

/** @param {Route.LoaderArgs} */
export async function loader({context}) {
  const {storefront} = context;
  const [{widgets}, {kits}, {eligible}] = await Promise.all([
    storefront.query(WIDGETS_QUERY),
    storefront.query(KITS_QUERY),
    storefront.query(ELIGIBLE_QUERY, {
      variables: {query: BUNDLE_ELIGIBLE_QUERY},
    }),
  ]);

  const rank = new Map((topSellers.handles || []).map((h, i) => [h, i]));
  const newCutoff = Date.now() - NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  // The widgets collection plus any ACTIVE product tagged bundle-eligible,
  // deduped by id (the collection copy wins). The Storefront API only returns
  // published products, so there is no status filter to add.
  const merged = new Map();
  for (const p of [
    ...(widgets?.products?.nodes || []),
    ...(eligible?.nodes || []),
  ]) {
    if (p && !merged.has(p.id)) merged.set(p.id, p);
  }

  const items = [...merged.values()]
    .map((p) => {
      const v = p.variants?.nodes?.[0];
      const price = Number(v?.price?.amount || 0);
      if (!v || !v.availableForSale || price <= 0) return null;
      return {
        id: p.id,
        handle: p.handle,
        title: p.title,
        type: p.productType || '',
        image: p.featuredImage
          ? {url: p.featuredImage.url, alt: p.featuredImage.altText || p.title}
          : null,
        variantId: v.id,
        price,
        createdAt: p.createdAt,
        top: rank.has(p.handle) ? rank.get(p.handle) : null,
        isNew: isNewProduct(p.createdAt, newCutoff),
      };
    })
    .filter(Boolean)
    // New (created in the last 14 days, newest first), then best sellers by
    // top-sellers.json rank, then A to Z.
    .sort((a, b) => {
      if (a.isNew !== b.isNew) return a.isNew ? -1 : 1;
      if (a.isNew && b.isNew) {
        const byDate = Date.parse(b.createdAt) - Date.parse(a.createdAt);
        if (byDate) return byDate;
      }
      if (a.top !== null && b.top !== null) return a.top - b.top;
      if (a.top !== null) return -1;
      if (b.top !== null) return 1;
      return a.title.localeCompare(b.title);
    });

  const byId = new Map(items.map((w) => [w.id, w]));
  const kitProducts = new Map(
    (kits?.products?.nodes || []).map((p) => [p.handle, p]),
  );
  const curated = (bundleKits.kits || [])
    .map((k) => {
      const p = kitProducts.get(k.handle);
      const comps = k.components.filter((id) => byId.has(id));
      if (!p || comps.length < 3) return null;
      return {
        name: k.name,
        handle: k.handle,
        price: Number(p.priceRange?.minVariantPrice?.amount || 0),
        image: p.featuredImage
          ? {url: p.featuredImage.url, alt: p.featuredImage.altText || k.name}
          : null,
        components: comps.slice(0, 9),
      };
    })
    .filter(Boolean);

  return {items, curated, reviews: pickReviews(), rating: etsyReviewsData.shop};
}

/** Products created within this many days get the "New" badge and sort first. */
const NEW_WINDOW_DAYS = 14;

/** Storefront API search syntax: active products tagged for bundling. */
const BUNDLE_ELIGIBLE_QUERY = 'tag:bundle-eligible';

/**
 * @param {string | undefined} createdAt
 * @param {number} cutoff epoch ms
 */
function isNewProduct(createdAt, cutoff) {
  const t = Date.parse(createdAt || '');
  return Number.isFinite(t) && t >= cutoff;
}

/** Skip 5-star reviews that mention a problem (keeps the sidebar quotes fully positive). */
const MIXED_RE =
  /issue|problem|error|bug|confus|painstak|difficult|wish|complain|doesn|didn|\bnot\b|couldn|lol/i;

/** Six short real 5-star reviews, one per product, newest first. */
function pickReviews() {
  const out = [];
  for (const p of Object.values(etsyReviewsData.products || {})) {
    const r = (p.reviews || []).find(
      (x) =>
        x.rating === 5 &&
        x.language === 'en' &&
        x.text &&
        x.text.length >= 30 &&
        x.text.length <= 110 &&
        !MIXED_RE.test(x.text) &&
        /^[A-Z]/.test(x.text) &&
        /[.!]$/.test(x.text) &&
        !/\b[A-Z]{4,}\b/.test(x.text) &&
        !/[\u2013\u2014]/.test(x.text),
    );
    if (r && !out.some((o) => o.text === r.text))
      out.push({text: r.text, date: r.date});
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);
}

export default function BundlePage() {
  const data = useLoaderData();
  return <BundleBuilder {...data} />;
}

const BUNDLE_WIDGET_FRAGMENT = `#graphql
  fragment BundleWidget on Product {
    id
    handle
    title
    productType
    createdAt
    featuredImage { url altText width height }
    variants(first: 1) {
      nodes { id availableForSale price { amount currencyCode } }
    }
  }
`;

const WIDGETS_QUERY = `#graphql
  query BundleWidgets($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    widgets: collection(handle: "widgets") {
      products(first: 250) {
        nodes { ...BundleWidget }
      }
    }
  }
  ${BUNDLE_WIDGET_FRAGMENT}
`;

const ELIGIBLE_QUERY = `#graphql
  query BundleEligible(
    $query: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    eligible: products(first: 250, query: $query) {
      nodes { ...BundleWidget }
    }
  }
  ${BUNDLE_WIDGET_FRAGMENT}
`;

const KITS_QUERY = `#graphql
  query BundleKits($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    kits: collection(handle: "bundles") {
      products(first: 20) {
        nodes {
          handle
          title
          featuredImage { url altText }
          priceRange { minVariantPrice { amount currencyCode } }
        }
      }
    }
  }
`;

/** @typedef {import('./+types/bundle').Route} Route */
