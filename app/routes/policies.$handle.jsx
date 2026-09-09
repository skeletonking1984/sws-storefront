import {Link, useLoaderData} from 'react-router';
import {buildMeta, getOrigin} from '~/lib/seo';
import {getPolicyOverride, SUPPORT_EMAIL} from '~/lib/policyContent';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({data, matches, location}) => {
  const origin = getOrigin(matches);
  const title = data?.policy.title ?? '';
  return buildMeta({
    title: `${title} | Stream Widget Shop`,
    description:
      data?.policy.summary ?? `${title} for Stream Widget Shop.`,
    url: `${origin}${location.pathname}`,
  });
};

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({params, context}) {
  if (!params.handle) {
    throw new Response('No handle was passed in', {status: 404});
  }

  // Privacy and refund are authored in the app, see app/lib/policyContent.js.
  const override = getPolicyOverride(params.handle);
  if (override) {
    return {policy: override};
  }

  const policyName = params.handle.replace(/-([a-z])/g, (_, m1) =>
    m1.toUpperCase(),
  );

  const data = await context.storefront.query(POLICY_CONTENT_QUERY, {
    variables: {
      privacyPolicy: false,
      shippingPolicy: false,
      termsOfService: false,
      refundPolicy: false,
      [policyName]: true,
      language: context.storefront.i18n?.language,
    },
  });

  const policy = data.shop?.[policyName];

  if (!policy) {
    throw new Response('Could not find the policy', {status: 404});
  }

  return {policy};
}

export default function Policy() {
  /** @type {LoaderReturnData} */
  const {policy} = useLoaderData();

  return (
    <div className="policy">
      <Link className="policy-back" to="/policies">
        Back to policies
      </Link>
      <h1>{policy.title}</h1>
      {policy.summary ? <p className="policy-lede">{policy.summary}</p> : null}
      {policy.updated ? (
        <p className="policy-updated">Last updated {policy.updated}</p>
      ) : null}
      <div
        className="policy-body"
        dangerouslySetInnerHTML={{__html: policy.body}}
      />
      <p className="policy-help">
        Still stuck? Email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and a real
        person will get back to you.
      </p>
    </div>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/latest/objects/Shop
const POLICY_CONTENT_QUERY = `#graphql
  fragment Policy on ShopPolicy {
    body
    handle
    id
    title
    url
  }
  query Policy(
    $country: CountryCode
    $language: LanguageCode
    $privacyPolicy: Boolean!
    $refundPolicy: Boolean!
    $shippingPolicy: Boolean!
    $termsOfService: Boolean!
  ) @inContext(language: $language, country: $country) {
    shop {
      privacyPolicy @include(if: $privacyPolicy) {
        ...Policy
      }
      shippingPolicy @include(if: $shippingPolicy) {
        ...Policy
      }
      termsOfService @include(if: $termsOfService) {
        ...Policy
      }
      refundPolicy @include(if: $refundPolicy) {
        ...Policy
      }
    }
  }
`;

/**
 * @typedef {keyof Pick<
 *   Shop,
 *   'privacyPolicy' | 'shippingPolicy' | 'termsOfService' | 'refundPolicy'
 * >} SelectedPolicies
 */

/** @typedef {import('./+types/policies.$handle').Route} Route */
/** @typedef {import('@shopify/hydrogen/storefront-api-types').Shop} Shop */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
