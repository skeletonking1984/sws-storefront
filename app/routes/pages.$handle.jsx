import {data, useLoaderData} from 'react-router';
import {redirectIfHandleIsLocalized} from '~/lib/redirect';
import {FaqAccordion} from '~/components/FaqAccordion';
import {HowItWorksSteps} from '~/components/HowItWorksSteps';
import {ContactPage} from '~/components/ContactPage';
import {buildMeta, getOrigin} from '~/lib/seo';

const CUSTOM_LAYOUTS = {
  'faq-frequently-asked-questions': (page) => <FaqAccordion html={page.body} />,
  'how-it-works': (page) => <HowItWorksSteps html={page.body} />,
  contact: () => <ContactPage />,
};

/**
 * @type {Route.MetaFunction}
 */
export const meta = ({data, matches, location}) => {
  const origin = getOrigin(matches);
  const title = data?.page.title ?? '';
  return buildMeta({
    title: `${title} | Stream Widget Shop`,
    description:
      data?.page.seo?.description ||
      `${title}: Stream Widget Shop, animated chat and goal widgets for Twitch, YouTube, and multistream.`,
    url: `${origin}${location.pathname}`,
  });
};

/**
 * @param {Route.LoaderArgs} args
 */
export async function loader(args) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return {...deferredData, ...criticalData};
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 * @param {Route.LoaderArgs}
 */
async function loadCriticalData({context, request, params}) {
  if (!params.handle) {
    throw new Error('Missing page handle');
  }

  const [{page}] = await Promise.all([
    context.storefront.query(PAGE_QUERY, {
      variables: {
        handle: params.handle,
      },
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  if (!page) {
    throw new Response('Not Found', {status: 404});
  }

  redirectIfHandleIsLocalized(request, {handle: params.handle, data: page});

  return {
    page,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 * @param {Route.LoaderArgs}
 */
function loadDeferredData({context}) {
  return {};
}

const CONTACT_MESSAGE_MAX_LENGTH = 5000;

/**
 * Server side handler for the contact page form. Only the `contact` handle
 * accepts a POST, everything else 405s. Validates input, absorbs bot
 * submissions via a honeypot, and sends real email through Resend when the
 * env vars are configured. Never throws, never claims a send that did not
 * happen.
 * @param {Route.ActionArgs} args
 */
export async function action({request, context, params}) {
  if (params.handle !== 'contact') {
    return data({ok: false, reason: 'not_found'}, {status: 405});
  }

  if (request.method !== 'POST') {
    return data({ok: false, reason: 'method_not_allowed'}, {status: 405});
  }

  const form = await request.formData();
  const name = (form.get('name') || '').toString().trim();
  const email = (form.get('email') || '').toString().trim();
  const message = (form.get('message') || '').toString().trim();
  const company = (form.get('company') || '').toString().trim();

  const values = {name, email, message};

  // Honeypot: bots fill every field including the hidden one. Silently
  // absorb it and report success so the bot moves on.
  if (company) {
    return {ok: true};
  }

  const fieldErrors = {};
  if (!name) fieldErrors.name = 'Enter your name.';
  if (!email) {
    fieldErrors.email = 'Enter your email.';
  } else if (!email.includes('@')) {
    fieldErrors.email = 'Enter a valid email.';
  }
  if (!message) {
    fieldErrors.message = 'Enter a message.';
  } else if (message.length > CONTACT_MESSAGE_MAX_LENGTH) {
    fieldErrors.message = `Message must be ${CONTACT_MESSAGE_MAX_LENGTH} characters or fewer.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {ok: false, reason: 'invalid', fieldErrors, values};
  }

  const {
    PRIVATE_RESEND_API_KEY,
    PRIVATE_CONTACT_TO_EMAIL,
    PRIVATE_CONTACT_FROM_EMAIL,
  } = context.env;

  if (!PRIVATE_RESEND_API_KEY || !PRIVATE_CONTACT_TO_EMAIL) {
    return {ok: false, reason: 'not_configured', values};
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PRIVATE_RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: PRIVATE_CONTACT_FROM_EMAIL || 'onboarding@resend.dev',
        to: PRIVATE_CONTACT_TO_EMAIL,
        reply_to: email,
        subject: `SWS contact form: ${name}`,
        text: message,
      }),
    });

    if (!response.ok) {
      return {ok: false, reason: 'send_failed', values};
    }

    return {ok: true};
  } catch {
    return {ok: false, reason: 'send_failed', values};
  }
}

export default function Page() {
  /** @type {LoaderReturnData} */
  const {page} = useLoaderData();
  const customLayout = CUSTOM_LAYOUTS[page.handle];

  return (
    <div className="page">
      <header>
        <h1>{page.title}</h1>
      </header>
      {customLayout ? (
        <main>{customLayout(page)}</main>
      ) : (
        <main dangerouslySetInnerHTML={{__html: page.body}} />
      )}
    </div>
  );
}

const PAGE_QUERY = `#graphql
  query Page(
    $language: LanguageCode,
    $country: CountryCode,
    $handle: String!
  )
  @inContext(language: $language, country: $country) {
    page(handle: $handle) {
      handle
      id
      title
      body
      seo {
        description
        title
      }
    }
  }
`;

/** @typedef {import('./+types/pages.$handle').Route} Route */
/** @typedef {ReturnType<typeof useLoaderData<typeof loader>>} LoaderReturnData */
