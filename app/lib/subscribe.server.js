/**
 * Turn a homepage email signup into a real Shopify marketing subscriber.
 *
 * Why this exists: the newsletter action only ever emailed Todd a
 * notification. It never created a customer and never set marketing consent,
 * so nobody landed on a list, nothing could ever send them the WELCOME10 code,
 * and the shop's subscriber count stayed at the 49 people who predate the
 * site. `WELCOME10` had 0 redemptions in the 6 days after it was created. That
 * was never a discount problem, it was a delivery problem.
 *
 * Why the Admin API and not the Storefront API: Storefront `customerCreate`
 * lists `password` as REQUIRED (verified against the 2025-01 schema on
 * 2026-09-14). Using it would mean inventing a password and creating a full
 * account for somebody who only wanted a discount code. The Online Store's
 * classic `/contact` form endpoint is also gone for this shop: POSTing
 * `form_type=customer` returns 403 on the myshopify domain and 405 on the
 * Hydrogen app.
 *
 * **Inert without `PRIVATE_ADMIN_API_TOKEN`.** No token, no call, no error:
 * the caller still sends its own notification and the page still shows the
 * code, exactly as before. That is deliberate, so shipping this cannot break
 * the form if the token is missing or later rotated.
 *
 * Needs `write_customers` and `read_customers` on a custom app token.
 */
const API_VERSION = '2025-01';

// NOTE: these documents are deliberately NOT tagged `#graphql`. Hydrogen's
// codegen validates every tagged document against the STOREFRONT schema, and
// these are Admin API operations, so tagging them fails the build with
// "Unknown type CustomerInput".

const CREATE = `
  mutation Subscribe($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer { id defaultEmailAddress { emailAddress marketingState } }
      userErrors { field message }
    }
  }
`;

const FIND = `
  query FindCustomer($q: String!) {
    customers(first: 1, query: $q) {
      nodes { id defaultEmailAddress { emailAddress marketingState } }
    }
  }
`;

const RESUBSCRIBE = `
  mutation Resubscribe($input: CustomerEmailMarketingConsentUpdateInput!) {
    customerEmailMarketingConsentUpdate(input: $input) {
      customer { id defaultEmailAddress { emailAddress marketingState } }
      userErrors { field message }
    }
  }
`;

/**
 * @param {{env: Record<string, string|undefined>, query: string, variables: object}} args
 */
async function admin({env, query, variables}) {
  const response = await fetch(
    `https://${env.PUBLIC_STORE_DOMAIN}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': env.PRIVATE_ADMIN_API_TOKEN,
      },
      body: JSON.stringify({query, variables}),
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok) throw new Error(`Admin API ${response.status}`);
  const body = await response.json();
  if (body.errors) throw new Error(JSON.stringify(body.errors).slice(0, 200));
  return body.data;
}

/**
 * Subscribe an email address to marketing. Never throws: a signup must not
 * fail because Shopify did, since the visitor has already been shown the
 * code.
 *
 * @param {{email: string, env: Record<string, string|undefined>}} args
 * @returns {Promise<{ok: boolean, state: 'skipped'|'created'|'resubscribed'|'already'|'failed', reason?: string}>}
 */
export async function subscribeToMarketing({email, env}) {
  if (!env?.PRIVATE_ADMIN_API_TOKEN || !env?.PUBLIC_STORE_DOMAIN) {
    return {ok: false, state: 'skipped'};
  }

  try {
    const created = await admin({
      env,
      query: CREATE,
      variables: {
        input: {
          email,
          // Tagged so a later campaign can segment "came from the site" from
          // the customers who predate it.
          tags: ['newsletter', 'site-signup'],
          emailMarketingConsent: {
            marketingState: 'SUBSCRIBED',
            // Single opt in: the visitor typed their address into a form that
            // said what they were getting. Shopify's own default for this.
            marketingOptInLevel: 'SINGLE_OPT_IN',
          },
        },
      },
    });

    const errors = created?.customerCreate?.userErrors ?? [];
    if (!errors.length) return {ok: true, state: 'created'};

    // Already a customer (a past buyer, or a repeat signup). Not an error:
    // update their consent instead of leaving them unsubscribed.
    const taken = errors.some((e) => /taken|already/i.test(e.message ?? ''));
    if (!taken) {
      return {ok: false, state: 'failed', reason: errors[0]?.message};
    }

    const found = await admin({
      env,
      query: FIND,
      variables: {q: `email:${JSON.stringify(email)}`},
    });
    const existing = found?.customers?.nodes?.[0];
    if (!existing) return {ok: false, state: 'failed', reason: 'not found'};
    if (existing.defaultEmailAddress?.marketingState === 'SUBSCRIBED') {
      return {ok: true, state: 'already'};
    }

    const updated = await admin({
      env,
      query: RESUBSCRIBE,
      variables: {
        input: {
          customerId: existing.id,
          emailMarketingConsent: {
            marketingState: 'SUBSCRIBED',
            marketingOptInLevel: 'SINGLE_OPT_IN',
          },
        },
      },
    });
    const updateErrors =
      updated?.customerEmailMarketingConsentUpdate?.userErrors ?? [];
    if (updateErrors.length) {
      return {ok: false, state: 'failed', reason: updateErrors[0]?.message};
    }
    return {ok: true, state: 'resubscribed'};
  } catch (error) {
    return {ok: false, state: 'failed', reason: String(error).slice(0, 120)};
  }
}
