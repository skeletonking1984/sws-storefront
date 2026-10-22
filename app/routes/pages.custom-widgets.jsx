import {useEffect, useRef, useState} from 'react';
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';
import {Money, useAnalytics} from '@shopify/hydrogen';
import {ResponsiveImage} from '~/components/ResponsiveImage';
import {PlatformIcon} from '~/components/PlatformIcon';
import {
  SETUP_HANDLES,
  StreamSetups,
  cleanSetupId,
  setupPrefill,
} from '~/components/StreamSetups';
import {
  BUDGET_OPTIONS,
  FIELD_LIMITS,
  PLATFORM_OPTIONS,
  UTM_KEYS,
  buildInquiryEmail,
  cleanOppref,
  parseInquiry,
  pickUtm,
} from '~/lib/commissionInquiry';
import {sendNotificationEmail} from '~/lib/notify.server';
import {
  sendLeadCreated,
  readOpprefCookie,
} from '~/lib/conversions/openaiAds.server';
import {
  isEmailThrottled,
  isIpThrottled,
  markEmailSent,
  recordIpSend,
} from '~/lib/freeChatThrottle.server';
import {buildMeta, getOrigin, absoluteAsset} from '~/lib/seo';
import {
  ogImageCustomWidgetsJpg as ogImageCustomWidgets,
  customWidgetsHeroDesktop1280Avif as heroDesktopAvif1280,
  customWidgetsHeroDesktop800Avif as heroDesktopAvif800,
  customWidgetsHeroDesktop1280Webp as heroDesktopWebp1280,
  customWidgetsHeroDesktop800Webp as heroDesktopWebp800,
  customWidgetsHeroDesktop1280Jpg as heroDesktopJpg1280,
  customWidgetsHeroMobile720Avif as heroMobileAvif720,
  customWidgetsHeroMobile480Avif as heroMobileAvif480,
  customWidgetsHeroMobile720Webp as heroMobileWebp720,
  customWidgetsHeroMobile480Webp as heroMobileWebp480,
  customWidgetsHeroMobile720Jpg as heroMobileJpg720,
} from '~/lib/cdnAssets';
import {brand} from '~/lib/brand.config';

const HERO_SIZES = '(min-width: 1041px) 1000px, calc(100vw - 2.5rem)';

/**
 * Custom widget commissions landing page, /pages/custom-widgets.
 *
 * Built for the ChatGPT Ads commissions test (content/ads/chatgpt-commissions-test.md).
 * The conversion is a qualified inquiry, not a sale: the form emails the shop owner and,
 * on success, the client publishes `custom_lead_submitted`, which becomes GA4
 * `generate_lead` (app/lib/analytics/events.js).
 *
 * ROUTE. A flat route file named `pages.custom-widgets.jsx` is a static
 * segment, which React Router ranks above the dynamic `pages.$handle.jsx`, so
 * this does not collide with Shopify Page routing. Verified by loading both
 * /pages/custom-widgets and /pages/contact. If a Shopify Page with the handle
 * `custom-widgets` is ever created, this route still wins and that page is
 * unreachable.
 *
 * Works without JavaScript: a plain <Form method="post"> posts to this
 * route's own action and the result renders server side, same as the contact
 * page. The analytics event is the only part that needs JS.
 *
 * SPAM GUARD. A honeypot field, per-IP (5 per 10 minutes) and per-email (1 per
 * 10 minutes) cooldowns on the Workers Cache API, and length caps on every
 * field. A honeypot hit or a throttled repeat returns a success-looking
 * response flagged `quiet`, which renders the thank-you state but publishes NO
 * analytics event, so a bot cannot inflate the lead count or the ad signal.
 *
 * 2026-10-07: a throttled repeat is additionally flagged `duplicate` and says
 * so on screen. A test submission from desktop and then from a phone both got
 * the same "Got it, thank you", and only the first mailed. A real person who
 * resubmits, or a second streamer behind one household IP, was being told
 * their $300 enquiry had been sent when it had not. The copy still never
 * names which limit was hit, and the honeypot branch stays unflagged.
 * No CAPTCHA: Turnstile exists in free-chat-widget.jsx and can be added here if
 * bots get past this.
 *
 * EDGE CACHE. /pages/ HTML with an empty query string is stored at the edge
 * and served to everyone (app/lib/edgeCache.server.js). Nothing in the loader
 * output is per visitor: the UTM values come from the query string, and any
 * request that has a query string is never stored.
 */

// Our own products only. No client commission work, no invented quotes.
// Handles are verified ACTIVE; a missing one is skipped, never faked.
const PROOF_PRODUCTS = [
  {
    handle:
      'demon-samurai-stream-overlay-pack-animated-katana-goal-bar-multistream-chat-alerts-digital-download',
    name: 'Demon Samurai overlay pack',
    blurb: 'A full animated overlay where the sword is the goal bar.',
  },
  {
    handle: 'celestial-stream-kit',
    name: 'Celestial Stream Kit',
    blurb: 'Ten moon and star overlays: chat widgets, goal bars and a scene.',
  },
  {
    handle: 'multistream-chat-widget-pack',
    name: 'Multistream Chat Widget Pack',
    blurb:
      'Ten skins of one chat widget, so the look can change with your channel.',
  },
];

const HOW_IT_WORKS = [
  {
    title: 'Tell us the idea',
    body: 'Fill in the form below with what you want and a rough budget.',
  },
  {
    title: 'Get a quote and a sketch',
    body: 'We reply by email with a price and a first sketch to react to.',
  },
  {
    title: 'Get a tested widget',
    body: 'We build it, test it in OBS and Streamlabs, and send the files with setup steps.',
  },
];

// Only the platforms we have actually shipped for. Several shop products
// also list TikTok, but no custom commission has shipped for it and the
// form's platform list has no TikTok or Ko-fi option, so they stay off here.
const WORKS_ON = ['Twitch', 'Kick', 'YouTube'];

const PROOF_QUERY = `#graphql
  fragment CommissionProof on Product {
    handle
    title
    featuredImage { url altText }
    priceRange { minVariantPrice { amount currencyCode } }
  }
  query CommissionProof(
    $h0: String!
    $h1: String!
    $h2: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    p0: product(handle: $h0) { ...CommissionProof }
    p1: product(handle: $h1) { ...CommissionProof }
    p2: product(handle: $h2) { ...CommissionProof }
  }
`;

// Real products behind the "Full stream setups" showcase. Only the fire
// sword needs media (its demo loop); the others just need to exist so a
// product link is never shown for a missing or unpublished handle.
const SETUP_QUERY = `#graphql
  query StreamSetupProducts(
    $blade: String!
    $jar: String!
    $parlour: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    blade: product(handle: $blade) {
      handle
      featuredImage { url }
      media(first: 10) {
        nodes {
          ... on Video {
            sources { url mimeType width }
          }
        }
      }
    }
    jar: product(handle: $jar) { handle }
    parlour: product(handle: $parlour) { handle }
  }
`;

/** Smallest mp4 for phones, a 720p one for wide stages. */
function pickBladeVideo(blade) {
  if (!blade) return null;
  const mp4s = (blade.media?.nodes || [])
    .flatMap((m) => m.sources || [])
    .filter((s) => s.mimeType === 'video/mp4' && s.width)
    .sort((a, b) => a.width - b.width);
  const sd = mp4s.find((s) => s.width >= 640) || mp4s[0];
  const hd = mp4s.find((s) => s.width >= 1200) || null;
  const poster = blade.featuredImage?.url
    ? `${blade.featuredImage.url}${blade.featuredImage.url.includes('?') ? '&' : '?'}width=960`
    : null;
  return {
    handle: blade.handle,
    sd: sd?.url || null,
    hd: hd?.url || null,
    poster,
  };
}

export const meta = ({matches}) => {
  const origin = getOrigin(matches);
  return buildMeta({
    title: `Custom stream widgets, built for your channel | ${brand.name}`,
    description:
      'Custom chat, goal and alert widgets for Twitch, Kick and YouTube. Commissions start at $300. Send an idea and get a quote and a sketch.',
    url: `${origin}/pages/custom-widgets`,
    // Dedicated 1200x630 card (scripts/make-custom-widgets-og-card.mjs). The
    // site default shows the jar and "Instant download", which is off-topic here.
    image: absoluteAsset(origin, ogImageCustomWidgets),
    imageWidth: 1200,
    imageHeight: 630,
  });
};

/**
 * The hero art is the LCP element. Preload the AVIF rendition (every current
 * browser takes it; the <picture> below still falls back to WebP and JPG), one
 * per breakpoint so a phone never fetches the desktop frame. `media` keeps the
 * two preloads mutually exclusive.
 */
export const links = () => [
  {
    rel: 'preload',
    as: 'image',
    type: 'image/avif',
    media: '(max-width: 760px)',
    imageSrcSet: `${heroMobileAvif480} 480w, ${heroMobileAvif720} 720w`,
    imageSizes: HERO_SIZES,
    fetchPriority: 'high',
  },
  {
    rel: 'preload',
    as: 'image',
    type: 'image/avif',
    media: '(min-width: 761px)',
    imageSrcSet: `${heroDesktopAvif800} 800w, ${heroDesktopAvif1280} 1280w`,
    imageSizes: HERO_SIZES,
    fetchPriority: 'high',
  },
];

/**
 * @param {import('react-router').LoaderFunctionArgs} args
 */
export async function loader({request, context}) {
  const url = new URL(request.url);

  let tiles = [];
  let setupProducts = {blade: null, jar: null, parlour: null};
  const setupQuery = context.storefront
    .query(SETUP_QUERY, {
      variables: SETUP_HANDLES,
      cache: context.storefront.CacheLong(),
    })
    .then((data) => {
      setupProducts = {
        blade: pickBladeVideo(data?.blade),
        jar: data?.jar?.handle || null,
        parlour: data?.parlour?.handle || null,
      };
    })
    .catch((error) => {
      // Showcase still renders from code; only product links and the fire
      // video drop out.
      console.error('[custom-widgets] setup products failed', error);
    });
  try {
    const data = await context.storefront.query(PROOF_QUERY, {
      variables: {
        h0: PROOF_PRODUCTS[0].handle,
        h1: PROOF_PRODUCTS[1].handle,
        h2: PROOF_PRODUCTS[2].handle,
      },
      cache: context.storefront.CacheLong(),
    });
    tiles = PROOF_PRODUCTS.map((entry, i) => ({
      entry,
      product: data?.[`p${i}`],
    }))
      .filter(({product}) => product?.featuredImage?.url)
      .map(({entry, product}) => ({
        handle: product.handle,
        name: entry.name,
        blurb: entry.blurb,
        image: product.featuredImage,
        price: product.priceRange.minVariantPrice,
      }));
  } catch (error) {
    // The proof tiles are a nicety. The form must still render if the
    // catalogue is down, so a failed query shows the page without them.
    console.error('[custom-widgets] proof tiles failed', error);
  }

  await setupQuery;

  return {
    tiles,
    setupProducts,
    // "Request this setup" without JS lands here as ?setup=<id>#inquiry.
    setup: cleanSetupId(url.searchParams.get('setup')),
    // Read from the landing URL, so they arrive in the form even with JS off.
    utm: pickUtm(url.searchParams),
    oppref: cleanOppref(url.searchParams.get('oppref')),
  };
}

/**
 * @param {import('react-router').ActionFunctionArgs} args
 */
export async function action({request, context}) {
  if (request.method !== 'POST') {
    return {ok: false, reason: 'method_not_allowed'};
  }

  const formData = await request.formData();
  const parsed = parseInquiry(formData);
  const {values, fieldErrors, utm} = parsed;

  // Honeypot: absorb the bot, show it the thank-you, send and track nothing.
  if (parsed.honeypot) return {ok: true, quiet: true, values};

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ok: false,
      reason: 'invalid',
      fieldErrors,
      values,
      utm,
      oppref: parsed.oppref,
    };
  }

  // Same precedence as free-chat-widget.jsx and api.e.jsx.
  const ip =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('oxygen-buyer-ip') ||
    undefined;

  const cache = await caches.open('commission-throttle');
  const normalizedEmail = values.email.toLowerCase();
  const [emailThrottled, ipThrottled] = await Promise.all([
    isEmailThrottled(cache, normalizedEmail),
    ip ? isIpThrottled(cache, ip) : false,
  ]);
  if (emailThrottled || ipThrottled) {
    // `duplicate` changes the copy to say no second request was sent. It does
    // NOT say which limit was hit, so it tells a real person the truth without
    // handing a spammer a probe for the email vs IP boundary. The honeypot
    // branch above deliberately omits it: a bot keeps seeing the plain
    // thank-you and learns nothing.
    return {ok: true, quiet: true, duplicate: true, values};
  }

  const origin = new URL(request.url).origin;
  const pageUrl = `${origin}/pages/custom-widgets`;
  const {subject, text} = buildInquiryEmail({values, utm, pageUrl});

  const sent = await sendNotificationEmail({
    env: context.env,
    subject,
    text,
    replyTo: values.email,
    origin,
  });

  if (!sent.ok) {
    console.error(`[custom-widgets] inquiry email not sent: ${sent.reason}`);
    return {ok: false, reason: sent.reason, values, utm, oppref: parsed.oppref};
  }

  // Cooldown only after a real send, so a transient failure does not lock a
  // real person out of retrying.
  await Promise.all([
    markEmailSent(cache, normalizedEmail),
    ip ? recordIpSend(cache, ip) : null,
  ]);

  // One id, used by the browser pixel and the server call so ChatGPT Ads
  // counts the lead once. No-op unless both OpenAI env vars are set.
  const eventId = `lead_${crypto.randomUUID()}`;
  context.waitUntil(
    sendLeadCreated({
      env: context.env,
      eventId,
      sourceUrl: pageUrl,
      oppref: parsed.oppref || readOpprefCookie(request),
    }).catch(() => {}),
  );

  return {ok: true, values, utm, eventId};
}

export default function CustomWidgetsPage() {
  const {
    tiles,
    setupProducts,
    setup,
    utm: landingUtm,
    oppref: landingOppref,
  } = useLoaderData();
  const messageRef = useRef(null);
  const prefillRef = useRef(setupPrefill(setup));
  const result = useActionData();
  const navigation = useNavigation();
  const {publish} = useAnalytics();
  const sending = navigation.state !== 'idle';
  const sent = result?.ok === true;
  const duplicate = result?.duplicate === true;
  const failed = result?.ok === false;
  const values = result?.values || {};
  const fieldErrors = result?.fieldErrors || {};

  // Campaign tags travel with the form. The loader gives them from the URL
  // (works with JS off); this keeps them for a visitor who clicked around the
  // site first and comes back to the form without the query string.
  const [utm, setUtm] = useState(landingUtm);
  useEffect(() => {
    try {
      if (Object.keys(landingUtm).length > 0) {
        sessionStorage.setItem(
          'sws_commission_utm',
          JSON.stringify(landingUtm),
        );
        setUtm(landingUtm);
      } else {
        const stored = JSON.parse(
          sessionStorage.getItem('sws_commission_utm') || '{}',
        );
        setUtm(
          pickUtm({
            get: (k) => (typeof stored?.[k] === 'string' ? stored[k] : null),
          }),
        );
      }
    } catch {
      // Storage blocked: the URL values, if any, are still in state.
    }
  }, [landingUtm]);

  // Fired once per real success. A quiet success (honeypot, cooldown) never
  // publishes. Carries campaign labels and the dedup id only, no contact
  // details, see normalizeLeadSubmitted in app/lib/analytics/events.js.
  useEffect(() => {
    if (sent && !result.quiet) {
      publish('custom_lead_submitted', {
        source: 'custom-widgets',
        eventId: result.eventId,
        utm: result.utm || utm,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // "Request this setup": prefill the message with the chosen kit, unless
  // the visitor has already written their own, then take them to the form.
  const requestSetup = (id) => {
    const field = messageRef.current;
    const text = setupPrefill(id);
    if (field && (!field.value.trim() || field.value === prefillRef.current)) {
      field.value = text;
      prefillRef.current = text;
    }
    const form = document.getElementById('inquiry');
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)')
      .matches;
    form?.scrollIntoView({
      behavior: smooth ? 'smooth' : 'auto',
      block: 'start',
    });
    if (field) {
      field.focus({preventScroll: true});
      field.setSelectionRange(field.value.length, field.value.length);
    }
  };

  const mailtoHref =
    failed && result.reason !== 'invalid' ? buildMailtoHref(values) : null;

  return (
    <div className="cw-page">
      <style dangerouslySetInnerHTML={{__html: STYLES}} />
      <div className="cw-wrap">
        <header className="cw-hero">
          {/* Moonflower pack art, SWS's own, text free. Decorative (alt=""); the H1 below is the real text. Eager + high priority: this is the LCP element. */}
          <picture className="cw-hero-art">
            <source
              type="image/avif"
              media="(max-width: 760px)"
              srcSet={`${heroMobileAvif480} 480w, ${heroMobileAvif720} 720w`}
              sizes={HERO_SIZES}
              width="720"
              height="400"
            />
            <source
              type="image/webp"
              media="(max-width: 760px)"
              srcSet={`${heroMobileWebp480} 480w, ${heroMobileWebp720} 720w`}
              sizes={HERO_SIZES}
              width="720"
              height="400"
            />
            <source
              media="(max-width: 760px)"
              srcSet={`${heroMobileJpg720} 720w`}
              sizes={HERO_SIZES}
              width="720"
              height="400"
            />
            <source
              type="image/avif"
              srcSet={`${heroDesktopAvif800} 800w, ${heroDesktopAvif1280} 1280w`}
              sizes={HERO_SIZES}
              width="1280"
              height="720"
            />
            <source
              type="image/webp"
              srcSet={`${heroDesktopWebp800} 800w, ${heroDesktopWebp1280} 1280w`}
              sizes={HERO_SIZES}
              width="1280"
              height="720"
            />
            <img
              src={heroDesktopJpg1280}
              width="1280"
              height="720"
              alt=""
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
          </picture>
          <div className="cw-hero-copy">
            <h1>
              Custom stream widgets, built for{' '}
              <span className="sws-holo">your channel</span>
            </h1>
            <p className="cw-price-line">Custom commissions start at $300.</p>
            <p className="cw-lede">
              Chat boxes, goal bars and alerts designed around your channel and
              built to run in OBS and Streamlabs. Tell us what you have in mind
              and we will send a quote and a sketch.
            </p>
            <div className="cw-cta-row">
              <a className="sws-btn sws-btn-primary" href="#inquiry">
                Request a quote
              </a>
              {tiles.length > 0 && (
                <a className="sws-btn sws-btn-ghost" href="#work">
                  See what we have built
                </a>
              )}
            </div>
          </div>
        </header>

        <StreamSetups products={setupProducts} onRequest={requestSetup} />

        {tiles.length > 0 && (
          <section className="cw-section" id="work" aria-labelledby="cw-work-h">
            <h2 id="cw-work-h">Our own work</h2>
            <p className="cw-section-note">
              These are Stream Widget Shop products you can buy today, shown so
              you can judge the quality. A commission is built around your
              channel instead.
            </p>
            <ul className="cw-tiles">
              {tiles.map((tile) => (
                <li key={tile.handle}>
                  <Link className="cw-tile" to={`/products/${tile.handle}`}>
                    <div className="cw-tile-img">
                      <ResponsiveImage
                        data={tile.image}
                        alt={`${tile.name}, a Stream Widget Shop product`}
                        sizes="(min-width: 48em) 320px, 90vw"
                        widths={[300, 400, 600, 800]}
                      />
                    </div>
                    <div className="cw-tile-body">
                      <h3>{tile.name}</h3>
                      <p>{tile.blurb}</p>
                      <span className="cw-tile-price">
                        <Money data={tile.price} withoutTrailingZeros />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="cw-section" aria-labelledby="cw-how-h">
          <h2 id="cw-how-h">How it works</h2>
          <ol className="cw-steps">
            {HOW_IT_WORKS.map((step, i) => (
              <li key={step.title}>
                <span className="cw-step-num" aria-hidden="true">
                  {i + 1}
                </span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="cw-section" aria-labelledby="cw-works-h">
          <h2 id="cw-works-h">Works on</h2>
          <ul className="cw-platforms">
            {WORKS_ON.map((platform) => (
              <li key={platform}>
                <PlatformIcon platform={platform} />
                {platform}
              </li>
            ))}
          </ul>
        </section>

        <section
          className="cw-section cw-form-section"
          id="inquiry"
          aria-labelledby="cw-form-h"
        >
          <h2 id="cw-form-h">Request a quote</h2>

          {sent ? (
            <div className="cw-success" role="status">
              {duplicate ? (
                <>
                  <h3>We already have your request.</h3>
                  <p>
                    You sent one a few minutes ago, so we did not send a second.{' '}
                    {"We'll email you a quote and a first sketch."}
                  </p>
                  <p>
                    Need to add something, or think this is a mistake? Write to{' '}
                    <a href={`mailto:${brand.supportEmail}`}>
                      {brand.supportEmail}
                    </a>{' '}
                    and we will pick it up there.
                  </p>
                </>
              ) : (
                <>
                  <h3>Got it, thank you.</h3>
                  <p>{"We'll email you a quote and a first sketch."}</p>
                  <p>
                    Anything to add? Reply to that email, or write to{' '}
                    <a href={`mailto:${brand.supportEmail}`}>
                      {brand.supportEmail}
                    </a>
                    .
                  </p>
                </>
              )}
            </div>
          ) : (
            <Form className="cw-form" method="post">
              <Field id="cw-name" label="Name" error={fieldErrors.name}>
                <input
                  id="cw-name"
                  name="name"
                  type="text"
                  autoComplete="off"
                  maxLength={FIELD_LIMITS.name}
                  required
                  defaultValue={values.name}
                  aria-invalid={fieldErrors.name ? 'true' : undefined}
                />
              </Field>

              <Field id="cw-email" label="Email" error={fieldErrors.email}>
                <input
                  id="cw-email"
                  name="email"
                  type="email"
                  autoComplete="off"
                  maxLength={FIELD_LIMITS.email}
                  required
                  defaultValue={values.email}
                  aria-invalid={fieldErrors.email ? 'true' : undefined}
                />
              </Field>

              <Field
                id="cw-platform"
                label="Platform"
                error={fieldErrors.platform}
              >
                <select
                  id="cw-platform"
                  name="platform"
                  required
                  defaultValue={values.platform || ''}
                  aria-invalid={fieldErrors.platform ? 'true' : undefined}
                >
                  <option value="" disabled>
                    Choose one
                  </option>
                  {PLATFORM_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field id="cw-budget" label="Budget" error={fieldErrors.budget}>
                <select
                  id="cw-budget"
                  name="budget"
                  required
                  defaultValue={values.budget || ''}
                  aria-invalid={fieldErrors.budget ? 'true' : undefined}
                >
                  <option value="" disabled>
                    Choose one
                  </option>
                  {BUDGET_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                id="cw-message"
                label="What do you want built?"
                error={fieldErrors.message}
                wide
              >
                <textarea
                  ref={messageRef}
                  id="cw-message"
                  name="message"
                  rows={6}
                  maxLength={FIELD_LIMITS.message}
                  required
                  defaultValue={values.message ?? prefillRef.current}
                  placeholder="A chat box in my channel's colors, a goal bar shaped like a sword, an alert for new subs..."
                  aria-invalid={fieldErrors.message ? 'true' : undefined}
                />
              </Field>

              <Field id="cw-deadline" label="Deadline (optional)" wide>
                <input
                  id="cw-deadline"
                  name="deadline"
                  type="text"
                  maxLength={FIELD_LIMITS.deadline}
                  defaultValue={values.deadline}
                  placeholder="For example: before November 15, or no rush"
                />
              </Field>

              {/* Honeypot. Off screen, skipped by keyboard and screen readers. */}
              <div className="cw-honeypot" aria-hidden="true">
                <label htmlFor="cw-company">Company</label>
                <input
                  id="cw-company"
                  name="company"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {/* Campaign tags and the ChatGPT Ads click reference, from the landing URL. */}
              {UTM_KEYS.map((key) =>
                utm[key] ? (
                  <input key={key} type="hidden" name={key} value={utm[key]} />
                ) : null,
              )}
              {landingOppref && (
                <input type="hidden" name="oppref" value={landingOppref} />
              )}

              <button
                type="submit"
                className="sws-btn sws-btn-primary"
                disabled={sending}
              >
                {sending ? 'Sending...' : 'Request a quote'}
              </button>

              {failed && result.reason === 'invalid' && (
                <p className="cw-error" role="alert">
                  Please fix the fields marked above.
                </p>
              )}
              {failed && result.reason !== 'invalid' && (
                <div className="cw-error" role="alert">
                  <p>
                    We could not send that just now. Try again in a minute, or
                    send it from your own email app:
                  </p>
                  {mailtoHref && (
                    <a className="sws-btn sws-btn-ghost" href={mailtoHref}>
                      Send it from my email app
                    </a>
                  )}
                </div>
              )}
            </Form>
          )}

          <p className="cw-fineprint">
            Prefer email? Write to{' '}
            <a href={`mailto:${brand.supportEmail}`}>{brand.supportEmail}</a>.
            Looking for a ready-made widget instead?{' '}
            <Link to="/collections/all">Browse the shop</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}

function Field({id, label, error, wide, children}) {
  return (
    <div className={wide ? 'cw-field cw-field-wide' : 'cw-field'}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error && (
        <p className="cw-field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

function buildMailtoHref(values) {
  const subject = `Custom widget inquiry from ${values?.name || 'the website'}`;
  const body = [
    values?.message || '',
    '',
    `Platform: ${values?.platform || ''}`,
    `Budget: ${values?.budget || ''}`,
    `Deadline: ${values?.deadline || ''}`,
  ].join('\n');
  // encodeURIComponent, not URLSearchParams: a "+" for a space shows up
  // literally in a mailto body.
  return `mailto:${brand.supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

const STYLES = `
  .cw-page { position: relative; isolation: isolate; margin: 0 -1rem; padding: 2rem 0 4rem; color: var(--sws-text); }
  .cw-wrap { max-width: 1040px; margin: 0 auto; padding: 0 1.25rem; }
  /* One dark backing plate under all content. Full width (it used to be
     1040px wide and left starfield strips either side at 1440), feathered at
     top and bottom only. The star layer and aurora are global; unmasked they
     put isolated bright pixels behind body text (worst point 1.9:1 measured),
     which the contrast gate counts. */
  .cw-page::before { content: ""; position: absolute; z-index: -2; inset: 0; background: rgba(11, 7, 19, 0.86); -webkit-mask-image: linear-gradient(180deg, transparent, #000 3rem, #000 calc(100% - 3rem), transparent); mask-image: linear-gradient(180deg, transparent, #000 3rem, #000 calc(100% - 3rem), transparent); pointer-events: none; }

  /* Hero: Moonflower night art on the right, copy on the left under a scrim
     (same recipe as the share card, og-image-custom-widgets.jpg). */
  .cw-hero { position: relative; isolation: isolate; overflow: hidden; display: flex; align-items: center; min-height: 28rem; border-radius: 22px; border: 1px solid var(--sws-border-strong); background: var(--sws-bg); }
  .cw-hero-art { position: absolute; inset: 0; z-index: -2; display: block; }
  .cw-hero-art img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 100% 40%; }
  .cw-hero::after { content: ""; position: absolute; inset: 0; z-index: -1; pointer-events: none; background: linear-gradient(90deg, rgba(11, 7, 19, 0.94) 0%, rgba(11, 7, 19, 0.90) 42%, rgba(11, 7, 19, 0.60) 60%, rgba(11, 7, 19, 0.16) 82%, rgba(11, 7, 19, 0.04) 100%); }
  .cw-hero-copy { position: relative; max-width: 33rem; padding: 3rem 0 3rem 3rem; }
  .cw-hero h1 { font-family: var(--font-display); font-weight: 800; font-size: clamp(2rem, 4.6vw, 2.9rem); line-height: 1.08; margin: 0 0 0.9rem; max-width: 24ch; }
  .cw-price-line { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.25rem, 3vw, 1.65rem); margin: 0 0 1rem; color: var(--sws-holo-3); }
  .cw-lede { font-size: 1.08rem; line-height: 1.6; max-width: 38rem; margin: 0 0 1.5rem; }
  .cw-cta-row { display: flex; flex-wrap: wrap; gap: 0.85rem; }
  .cw-cta-row .sws-btn-ghost { background: rgba(11, 7, 19, 0.75); }

  .cw-section { margin-top: 2.5rem; padding: 0; scroll-margin-top: 5.5rem; }
  .cw-section h2 { font-family: var(--font-display); font-weight: 800; font-size: clamp(1.5rem, 3.4vw, 2rem); margin: 0 0 0.6rem; }
  .cw-section-note { color: var(--sws-text); max-width: 40rem; line-height: 1.55; margin: 0 0 1.25rem; }

  .cw-tiles { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.1rem; }
  .cw-tile { display: block; height: 100%; background: var(--sws-card-solid); border: 1px solid var(--sws-border); border-radius: 18px; overflow: hidden; color: inherit; text-decoration: none; transition: transform 0.15s ease, border-color 0.15s ease; }
  .cw-tile:hover { transform: translateY(-4px); border-color: var(--sws-border-strong); }
  .cw-tile-img { aspect-ratio: 1 / 1; background: radial-gradient(90% 90% at 50% 40%, rgba(183, 157, 242, 0.22), transparent 70%), var(--sws-bg-alt); }
  .cw-tile-img img { width: 100%; height: 100%; object-fit: contain; display: block; }
  .cw-tile-body { padding: 1rem 1.1rem 1.2rem; }
  .cw-tile-body h3 { font-family: var(--font-display); font-weight: 800; font-size: 1.15rem; margin: 0 0 0.35rem; }
  .cw-tile-body p { margin: 0 0 0.7rem; line-height: 1.5; font-size: 0.95rem; }
  .cw-tile-price { display: inline-block; font-weight: 700; font-size: 0.9rem; border: 1px solid var(--sws-border-strong); border-radius: 999px; padding: 0.15rem 0.7rem; }

  .cw-steps { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.1rem; }
  .cw-steps li { background: var(--sws-card-solid); border: 1px solid var(--sws-border); border-radius: 18px; padding: 1.2rem 1.2rem 1.35rem; }
  .cw-step-num { display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; border-radius: 50%; background: var(--sws-holo-2); color: var(--sws-ink); border: 2px solid var(--sws-ink); font-family: var(--font-display); font-weight: 800; margin-bottom: 0.6rem; }
  .cw-steps h3 { font-family: var(--font-display); font-weight: 800; font-size: 1.15rem; margin: 0 0 0.35rem; }
  .cw-steps p { margin: 0; line-height: 1.5; }

  .cw-platforms { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.7rem; }
  .cw-platforms li { display: inline-flex; align-items: center; gap: 0.5rem; background: var(--sws-card-solid); border: 1px solid var(--sws-border-strong); border-radius: 999px; padding: 0.5rem 1.1rem; font-weight: 700; }
  .cw-platforms .platform-icon { width: 1.1rem; height: 1.1rem; fill: currentColor; }

  .cw-form-section { background: var(--sws-card-solid); border: 1px solid var(--sws-border-strong); border-radius: 22px; padding: 1.75rem 1.75rem 1.5rem; }
  .cw-form { max-width: none; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1.05rem 1.25rem; }
  .cw-form > .cw-field-wide, .cw-form > .sws-btn, .cw-form > .cw-error { grid-column: 1 / -1; }
  .cw-field label { display: block; font-weight: 700; margin: 0 0 0.35rem; }
  .cw-field input, .cw-field select, .cw-field textarea { width: 100%; box-sizing: border-box; font: inherit; color: var(--sws-text); background: var(--sws-bg); border: 1px solid var(--sws-border-strong); border-radius: 10px; padding: 0.7rem 0.9rem; }
  .cw-field textarea { resize: vertical; min-height: 7rem; }
  .cw-field ::placeholder { color: var(--sws-sub); opacity: 1; }
  .cw-field input:focus-visible, .cw-field select:focus-visible, .cw-field textarea:focus-visible { outline: 3px solid var(--sws-holo-1); outline-offset: 2px; }
  .cw-field [aria-invalid="true"] { border-color: var(--sws-holo-4); }
  .cw-field-error, .cw-error { color: var(--sws-holo-3); margin: 0.35rem 0 0; }
  .cw-error p { margin: 0 0 0.6rem; }
  .cw-form .sws-btn { justify-self: start; }
  .cw-honeypot { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
  .cw-success h3 { font-family: var(--font-display); font-weight: 800; font-size: 1.3rem; margin: 0 0 0.5rem; }
  .cw-success p { line-height: 1.55; margin: 0 0 0.6rem; }
  .cw-fineprint { margin: 1.25rem 0 0; line-height: 1.55; font-size: 0.95rem; }
  .cw-page a:not(.sws-btn) { color: var(--sws-holo-1); }

  @media (max-width: 760px) {
    .cw-page { padding-top: 1.25rem; }
    .cw-section { margin-top: 2rem; }
    /* Art on top, copy below: the moon and lantern never sit behind the heading. */
    .cw-hero { display: block; min-height: 0; border-radius: 18px; }
    .cw-hero-art { position: relative; inset: auto; z-index: auto; aspect-ratio: 9 / 5; }
    .cw-hero-art::after { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(11, 7, 19, 0) 55%, rgba(11, 7, 19, 0.9) 100%); }
    .cw-hero::after { display: none; }
    .cw-hero-copy { max-width: none; padding: 0 1.1rem 1.4rem; margin-top: -0.5rem; }
    .cw-form { grid-template-columns: minmax(0, 1fr); }
    .cw-tiles, .cw-steps { grid-template-columns: minmax(0, 1fr); }
    .cw-form-section { padding: 1.4rem 1.1rem 1.25rem; }
    .cw-cta-row .sws-btn { width: 100%; }
    .cw-form .sws-btn { justify-self: stretch; }
  }
  @media (prefers-reduced-motion: reduce) {
    .cw-tile { transition: none; }
    .cw-tile:hover { transform: none; }
  }
`;
