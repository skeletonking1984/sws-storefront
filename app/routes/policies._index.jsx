import {useLoaderData, Link} from 'react-router';
import {buildMeta, getOrigin} from '~/lib/seo';
import {getPolicyOverride} from '~/lib/policyContent';

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({matches, location}) => {
  const origin = getOrigin(matches);
  return buildMeta({
    title: 'Policies | Stream Widget Shop',
    description:
      'Shipping, refund, privacy, and terms of service policies for Stream Widget Shop.',
    url: `${origin}${location.pathname}`,
  });
};

/**
 * @param {Route.LoaderArgs}
 */
export async function loader({context}) {
  const data = await context.storefront.query(POLICIES_QUERY);

  const shopPolicies = data.shop;
  const policies = [
    shopPolicies?.privacyPolicy,
    shopPolicies?.shippingPolicy,
    shopPolicies?.termsOfService,
    shopPolicies?.refundPolicy,
    shopPolicies?.subscriptionPolicy,
  ].filter((policy) => policy != null);

  if (!policies.length) {
    throw new Response('No policies found', {status: 404});
  }

  return {policies};
}

export default function Policies() {
  /** @type {LoaderReturnData} */
  const {policies} = useLoaderData();

  return (
    <div className="policies">
      <h1>Policies</h1>
      <p className="policies-lede">
        The plain English version of how this shop works. Everything we sell is
        an instant digital download.
      </p>
      <div className="policies-grid">
        {policies.map((policy) => {
          const override = getPolicyOverride(policy.handle);
          return (
            <Link
              className="policies-card"
              key={policy.id}
              to={`/policies/${policy.handle}`}
            >
              <span className="policies-card-title">
                {override?.title ?? policy.title}
              </span>
              {override?.summary ? (
                <span className="policies-card-summary">
                  {override.summary}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

const POLICIES_QUERY = `#graphql
  fragment PolicyItem on ShopPolicy {
    id
    title
    handle
  }
  query Policies ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    shop {
      privacyPolicy {
        ...PolicyItem
      }
      shippingPolicy {
        ...PolicyItem
      }
      termsOfService {
        ...PolicyItem
      }
      refundPolicy {
        ...PolicyItem
      }
      subscriptionPolicy {
        id
        title
        handle
      }
    }
  }
`;

/** @typedef {import('./+types/policies._index').Route} Route */
/** @typedef {import('storefrontapi.generated').PoliciesQuery} PoliciesQuery */
/** @typedef {import('storefrontapi.generated').PolicyItemFragment} PolicyItemFragment */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
