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

/**
 * The INSTANT path, and the one that actually runs.
 *
 * `subscribeToMarketing` above needs an Admin token. That token has no
 * obtainable source: Shopify closed admin-created custom apps to new creation
 * ("You can no longer create new admin-created custom apps"), and a Dev
 * Dashboard app authenticates by OAuth and never issues a static one. Todd was
 * walked through four admin screens on 2026-09-16 before that was established.
 * Do not go looking for it again.
 *
 * So use the credential the storefront already holds. The PUBLIC Storefront
 * token can run `customerCreate`, because this is not an app writing an
 * arbitrary customer record, it is a person signing themselves up. That is
 * also why it demands a password: Shopify treats it as account creation, not
 * list management.
 *
 * Verified live against the real shop on 2026-09-17 with the public token from
 * `.env`: customer `10478258946238` came back `acceptsMarketing: true`, and the
 * Admin API reads it as `SUBSCRIBED` / `SINGLE_OPT_IN` / `ENABLED`. Same list,
 * same consent level, no credential to configure and nothing to rotate.
 *
 * WHAT THIS COSTS, and it is the honest tradeoff:
 *
 * - The subscriber gets a real customer ACCOUNT, with a random password nobody
 *   holds. If they ever want in, they use the reset link like anyone else. The
 *   alternative was a day of delay, and this is the cheaper one.
 * - The Storefront API cannot set tags, so these arrive untagged where the
 *   sweep's records carry `newsletter` / `launch-popup`. Provenance for a
 *   direct signup is the account's own creation date and consent timestamp.
 * - An address that is ALREADY a customer comes back `TAKEN`. The Storefront
 *   API cannot update someone else's consent, by design, so that case falls to
 *   step 4b of the nightly sweep, which now handles exactly it.
 *
 * Never throws. A signup must not fail because Shopify did: the visitor has
 * already been shown the code.
 *
 * @param {{email: string, storefront: any}} args
 * @returns {Promise<{ok: boolean, state: 'created'|'exists'|'skipped'|'failed', reason?: string}>}
 */
export async function subscribeViaStorefront({email, storefront}) {
  if (!storefront) return {ok: false, state: 'skipped'};

  try {
    const data = await storefront.mutate(STOREFRONT_SIGNUP, {
      variables: {
        input: {
          email,
          // Never used and never sent anywhere. Shopify requires a password on
          // this mutation; the account is a side effect of subscribing, not
          // the point of it.
          //
          // One UUID, not two: Shopify caps a customer password at 40
          // characters and rejects anything longer ("Password is too long"),
          // which is a userError, so the signup fails silently rather than
          // throwing. 36 characters of UUID is plenty for a password nobody
          // ever types.
          password: crypto.randomUUID(),
          acceptsMarketing: true,
        },
      },
    });

    const errors = data?.customerCreate?.customerUserErrors ?? [];
    if (!errors.length && data?.customerCreate?.customer) {
      return {ok: true, state: 'created'};
    }

    // Already a customer: a past buyer, or a repeat signup. Not a failure, and
    // not something this API is allowed to fix. The nightly sweep updates
    // their consent.
    //
    // The code is CUSTOMER_DISABLED, NOT `TAKEN`, and the message reads "We
    // have sent an email to <address>, please click the link included to
    // verify your email address" (verified against the live shop 2026-09-17).
    // So Shopify emails that person an account verification link on every
    // repeat signup. That is Shopify's behaviour, not something this code can
    // suppress, and it is the reason to keep the nightly sweep: it is the only
    // path that can subscribe an existing customer.
    if (
      errors.some(
        (e) =>
          e.code === 'CUSTOMER_DISABLED' ||
          e.code === 'TAKEN' ||
          /taken|already/i.test(e.message ?? ''),
      )
    ) {
      return {ok: true, state: 'exists'};
    }

    return {ok: false, state: 'failed', reason: errors[0]?.message};
  } catch (error) {
    return {ok: false, state: 'failed', reason: String(error).slice(0, 120)};
  }
}

const STOREFRONT_SIGNUP = `#graphql
  mutation NewsletterSignup($input: CustomerCreateInput!) {
    customerCreate(input: $input) {
      customer {
        id
      }
      customerUserErrors {
        code
        field
        message
      }
    }
  }
`;
