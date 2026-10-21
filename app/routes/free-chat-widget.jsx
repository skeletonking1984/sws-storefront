import {useEffect, useRef} from 'react';
import {
  Form,
  useActionData,
  useLoaderData,
  useNavigation,
  Link,
} from 'react-router';
import {useAnalytics} from '@shopify/hydrogen';
import {signConfirmToken} from '~/lib/freeChatConfirm.server';
import {CONSENT_TEXT} from '~/lib/freeChatConsent';
import {FreeChatPageStyles} from '~/components/FreeChatPageStyles';
import {sendFreeChatConfirmEmail} from '~/lib/freeChatEmail.server';
import {verifyTurnstile} from '~/lib/turnstile.server';
import {markOfferSeen} from '~/lib/offer';
import {isValidEmail} from '~/lib/freeChatValidation';
import {
  THROTTLE_CACHE_NAME,
  isEmailThrottled,
  isIpThrottled,
  markEmailSent,
  recordIpSend,
} from '~/lib/freeChatThrottle.server';
import {buildMeta, getOrigin, absoluteAsset} from '~/lib/seo';
import {ogImageFreeChatJpg as freeChatOgImage} from '~/lib/cdnAssets';
import {OVERLAY_FEATURED_HANDLES} from '~/lib/nav';
import {brand} from '~/lib/brand.config';

// Same product the setup page (free-chat-widget_.confirm.jsx) links to;
// index 2 of OVERLAY_FEATURED_HANDLES is 'multistream-chat-widget-pack'.
const MULTISTREAM_PACK_HANDLE = OVERLAY_FEATURED_HANDLES[2];

/**
 * Stream Chat Lite signup landing page.
 *
 * Works without JavaScript: a plain `<Form method="post">` posts back to
 * this same route's `action`, which renders the result server-side on the
 * next response. No client-side fetch, no required hydration. Turnstile is
 * the one exception -- its widget needs its own script and an iframe, see
 * below, but the form still submits and the action still runs with no
 * token at all when `PUBLIC_TURNSTILE_SITE_KEY` is unset.
 *
 * Marketing consent is NOT recorded here. This route only sends a signed,
 * expiring confirm link; consent is recorded only after a verified click on
 * that link, in free-chat-widget.confirm.jsx. See CONSENT_TEXT below, the
 * exact line the shop owner approved, shown here verbatim above the submit button.
 */

/**
 * @param {import('react-router').LoaderFunctionArgs} args
 */
export async function loader({context}) {
  // Gated by brand.config.js `features.freeChat`: a clone with no Free Chat
  // Lite service 404s here instead of rendering a broken signup.
  if (!brand.features.freeChat) {
    throw new Response('Not found', {status: 404});
  }
  // Public key only, safe on the client. When unset the widget is not
  // rendered at all and the action below skips verification.
  return {turnstileSiteKey: context.env.PUBLIC_TURNSTILE_SITE_KEY || null};
}

export const meta = ({matches}) => {
  const origin = getOrigin(matches);
  return buildMeta({
    title: `Stream Chat Lite | Free multistream chat widget - ${brand.name}`,
    description:
      'A free multistream chat overlay that merges Twitch and Kick chat into one. Join the email list and use it free, forever.',
    url: `${origin}/free-chat-widget`,
    image: absoluteAsset(origin, freeChatOgImage),
    imageWidth: 1200,
    imageHeight: 630,
  });
};

/**
 * @param {import('react-router').ActionFunctionArgs} args
 */
export async function action({request, context}) {
  const formData = await request.formData();
  const email = (formData.get('email') || '').toString().trim();
  const company = (formData.get('company') || '').toString().trim();
  const turnstileToken = (
    formData.get('cf-turnstile-response') || ''
  ).toString();

  // Honeypot: bots fill every field. Absorb it without sending anything,
  // same pattern as the existing newsletter form.
  if (company) return {ok: true};

  if (!isValidEmail(email)) {
    return {ok: false, reason: 'invalid', values: {email}};
  }

  // Oxygen sets `oxygen-buyer-ip` on every request (confirmed in
  // node_modules/@shopify/mini-oxygen's own header map and read the same
  // way inside @shopify/hydrogen's Storefront API client). CF-Connecting-IP
  // is checked first in case a future proxy layer in front of Oxygen sets
  // it, same precedence style as app/routes/api.e.jsx.
  const ip =
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('oxygen-buyer-ip') ||
    undefined;

  const verified = await verifyTurnstile({
    token: turnstileToken,
    ip,
    env: context.env,
  });
  if (!verified.ok) {
    return {ok: false, reason: 'verify', values: {email}};
  }

  const normalizedEmail = email.toLowerCase();
  const cache = await caches.open(THROTTLE_CACHE_NAME);
  const [emailThrottled, ipThrottled] = await Promise.all([
    isEmailThrottled(cache, normalizedEmail),
    ip ? isIpThrottled(cache, ip) : false,
  ]);
  if (emailThrottled || ipThrottled) {
    // Same success-looking response as a real send. Never reveal to the
    // caller whether this address was just mailed or this IP hit its cap.
    return {ok: true, values: {email}};
  }

  const signed = await signConfirmToken({
    email,
    source: 'free-chat',
    env: context.env,
  });
  if (!signed.ok) {
    return {ok: false, reason: signed.reason, values: {email}};
  }

  const origin = new URL(request.url).origin;
  const confirmUrl = `${origin}/free-chat-widget/confirm?token=${encodeURIComponent(signed.token)}`;

  const sent = await sendFreeChatConfirmEmail({
    env: context.env,
    to: email,
    confirmUrl,
    origin,
  });

  if (!sent.ok) {
    console.error(`[free-chat] confirm email not sent: ${sent.reason}`);
    return {ok: false, reason: sent.reason, values: {email}};
  }

  // Mark the cooldown only on a real send, so a send that failed on a
  // transient error does not lock a real address out of a retry.
  await Promise.all([
    markEmailSent(cache, normalizedEmail),
    ip ? recordIpSend(cache, ip) : null,
  ]);

  return {ok: true, values: {email}};
}

export default function FreeChatWidget() {
  const {turnstileSiteKey} = useLoaderData();
  const result = useActionData();
  const navigation = useNavigation();
  const {publish} = useAnalytics();
  const sending = navigation.state !== 'idle';
  const sent = result?.ok === true;
  const failed = result?.ok === false;

  // Funnel step for GA4 only (see normalizeSignupSubmitted in
  // app/lib/analytics/events.js), fired once per successful action -- never
  // on a validation failure and never on a honeypot hit, both of which
  // return `ok: false` or the honeypot's own silent `{ok: true}` that never
  // reaches this branch's rendered success state anyway (the honeypot
  // branch returns before ever calling send/mint, and this component has
  // no way to tell it apart from a real send on `result.ok` alone -- see
  // the action above, `if (company) return {ok: true}` -- but a bot filling
  // a hidden field has no browser JS reason to run this effect either, so
  // in practice this only fires for a human's real submission).
  // Someone who just gave their email for Stream Chat Lite must not be
  // asked for it again by the 10% LaunchOffer popup (seen 2026-09-27).
  useEffect(() => {
    if (sending) markOfferSeen();
  }, [sending]);

  useEffect(() => {
    if (sent) publish('custom_signup_submitted', {source: 'free-chat'});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  return (
    <div className="free-chat-page">
      <FreeChatPageStyles />
      <style
        // Rules specific to this page only; shared base rules (.free-chat-page,
        // .free-chat-lede, .free-chat-error) live in FreeChatPageStyles, which
        // both this route and free-chat-widget_.confirm.jsx render, since
        // they are separate route modules and share no layout.
        dangerouslySetInnerHTML={{
          __html: `
        .free-chat-features { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin: 0 0 2rem; padding: 0; list-style: none; }
        .free-chat-features li { background: var(--sws-card-solid); border: 1px solid var(--sws-border); border-radius: 12px; padding: 0.85rem 1rem; font-size: 0.92rem; }
        .free-chat-form-card { background: var(--sws-card-solid); border: 1px solid var(--sws-border-strong); border-radius: 16px; padding: 1.75rem; max-width: 480px; }
        .free-chat-consent { font-size: 0.9rem; line-height: 1.5; color: var(--sws-sub); margin: 0 0 1.1rem; }
        .free-chat-form-card input[type="email"] { width: 100%; padding: 0.75rem 1rem; border-radius: 10px; border: 1px solid var(--sws-border); background: var(--sws-bg); color: var(--sws-text); font-size: 1rem; margin: 0 0 1rem; box-sizing: border-box; }
        .free-chat-honeypot { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
        .free-chat-success { font-size: 0.95rem; line-height: 1.5; }
        .cf-turnstile { margin: 0 0 1rem; }

        /*
         * Hero, redesigned 2026-09-27 (the previous hero needed to showcase
         * all features, i.e GIFs). The old hero was a
         * static hand-drawn mock (plain text chat, no GIF, no emote, no
         * badges) that could not prove anything it claimed. This embeds the
         * REAL v1 widget (brand.config.js freeChat.widgetBaseUrl, same file every buyer
         * gets) in its own continuous-loop showcase fixture (?demo=showcase,
         * see sws-free-chat/public/v1/chat.js), so every row here is the
         * actual production renderer: platform marks, role badges, a real
         * Twitch global emote (Kappa), and a real allowlisted Twitch chat
         * GIF, all on a loop, nothing faked.
         *
         * The widget's own #feed is a fixed 420x640 design (--chat-width in
         * chat.css, shared with every real OBS install, not something this
         * page should override) so --hero-scale shrinks the whole iframe
         * with a CSS transform at narrow widths instead of letting the
         * fixed-width feed clip inside a narrower box. Verified at 1440,
         * 1024, 390 and 360: no horizontal overflow at any of the four.
         */
        .free-chat-hero { margin: 0 0 2rem; }
        .free-chat-hero-tag { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.72rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--sws-holo-1); background: var(--sws-card-solid); border: 1px solid var(--sws-border-strong); border-radius: 999px; padding: 0.3rem 0.7rem; margin: 0 0 0.6rem; }
        .free-chat-hero-tag::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: var(--sws-holo-1); box-shadow: 0 0 6px var(--sws-holo-1); }
        .free-chat-hero-frame-wrap { --hero-scale: 1; position: relative; width: 100%; height: calc(640px * var(--hero-scale)); overflow: hidden; border-radius: 18px; border: 1px solid var(--sws-border); background: radial-gradient(120% 140% at 15% 0%, rgba(127, 230, 255, 0.16), transparent 55%), radial-gradient(120% 140% at 100% 100%, rgba(255, 138, 176, 0.14), transparent 55%), linear-gradient(180deg, var(--sws-bg-alt) 0%, var(--sws-bg) 100%); display: flex; justify-content: flex-end; }
        .free-chat-hero-frame { width: 420px; height: 640px; border: 0; flex: 0 0 auto; transform: scale(var(--hero-scale)); transform-origin: top right; }
        .free-chat-hero-caption { font-size: 0.85rem; color: var(--sws-sub); margin: 0.6rem 0 0; }
        @media (max-width: 640px) {
          .free-chat-hero-frame-wrap { --hero-scale: 0.78; }
        }
        @media (max-width: 400px) {
          .free-chat-hero-frame-wrap { --hero-scale: 0.72; }
        }
        .free-chat-landing-upsell { max-width: 480px; margin: 1.25rem 0 0; font-size: 0.88rem; color: var(--sws-text); line-height: 1.5; }
        .free-chat-landing-upsell a { color: var(--sws-accent-2); text-decoration: underline; }
      `,
        }}
      />

      <div className="free-chat-hero">
        <span className="free-chat-hero-tag">
          Live widget preview, not a mockup
        </span>
        <div className="free-chat-hero-frame-wrap">
          <iframe
            src={`${brand.freeChat.widgetBaseUrl}index.html?demo=showcase`}
            title="Stream Chat Lite running live: Twitch and Kick chat merged into one overlay, with role badges, a real Twitch emote and a real Twitch chat GIF"
            className="free-chat-hero-frame"
            loading="eager"
            scrolling="no"
          />
        </div>
        <p className="free-chat-hero-caption">
          This is the real widget running live, the same file your OBS browser
          source loads. Not a screenshot. The preview shows sample rows from
          Twitch and Kick, the two platforms the free widget connects.
        </p>
      </div>

      <h1>Stream Chat Lite: free multistream chat, forever</h1>
      <p className="free-chat-lede">
        One overlay that merges Twitch and Kick chat into a single feed. Works
        as an OBS or Streamlabs browser source, or a StreamElements custom
        widget. No CORS proxy, no time limit.
      </p>

      <ul className="free-chat-features">
        <li>Twitch and Kick, either one or both</li>
        <li>Twitch chat GIFs and emotes</li>
        <li>Role badges + name colors</li>
        <li>OBS, Streamlabs or StreamElements</li>
        <li>
          Small &ldquo;Free chat by Stream Widget Shop&rdquo; line under the
          feed
        </li>
      </ul>

      <div className="free-chat-form-card">
        {sent ? (
          <div className="free-chat-success">
            <p>
              {result.values?.email
                ? `Check your email (${result.values.email}) for a confirm link. Click it to finish setup and get your widget URL.`
                : 'Check your email for a confirm link. Click it to finish setup and get your widget URL.'}
            </p>
            <p>
              Nothing was added to any list yet, that happens after you confirm.
            </p>
          </div>
        ) : (
          <Form method="post">
            <p className="free-chat-consent">{CONSENT_TEXT}</p>
            <input
              type="email"
              name="email"
              required
              defaultValue={result?.values?.email}
              placeholder="you@example.com"
              aria-label="Email address"
            />
            <div className="free-chat-honeypot" aria-hidden="true">
              <label htmlFor="free-chat-company">Company</label>
              <input
                id="free-chat-company"
                name="company"
                type="text"
                tabIndex={-1}
                autoComplete="off"
              />
            </div>
            {turnstileSiteKey && (
              <TurnstileWidget siteKey={turnstileSiteKey} resetKey={result} />
            )}
            <button
              type="submit"
              className="sws-btn sws-btn-primary"
              disabled={sending}
            >
              {sending ? 'Sending...' : 'Send my confirm link'}
            </button>
            {failed && result.reason === 'invalid' && (
              <p className="free-chat-error">Enter a valid email address.</p>
            )}
            {failed && result.reason === 'verify' && (
              <p className="free-chat-error">
                We could not verify you are not a robot. Refresh the page and
                try again.
              </p>
            )}
            {failed &&
              result.reason !== 'invalid' &&
              result.reason !== 'verify' && (
                <p className="free-chat-error">
                  We could not send that just now. Try again in a minute, or{' '}
                  <Link to="/pages/contact">contact us</Link>.
                </p>
              )}
          </Form>
        )}
      </div>

      <p className="free-chat-landing-upsell">
        Want YouTube and TikTok too, plus themed skins, avatars and animated
        alerts? See the{' '}
        <Link
          to={`/products/${MULTISTREAM_PACK_HANDLE}?utm_source=stream-chat-lite&utm_medium=free-widget&utm_campaign=landing`}
        >
          Multistream Chat Widget Pack
        </Link>
        . Stream Chat Lite stays free either way.
      </p>
    </div>
  );
}

const TURNSTILE_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

/** One shared load of api.js, reused across client-side navigations. */
let turnstileScript;
function loadTurnstile() {
  if (typeof window === 'undefined') return Promise.reject(new Error('ssr'));
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!turnstileScript) {
    turnstileScript = new Promise((resolve, reject) => {
      const el = document.createElement('script');
      el.src = TURNSTILE_SRC;
      el.async = true;
      el.onload = () => resolve(window.turnstile);
      el.onerror = () => {
        turnstileScript = undefined;
        reject(new Error('turnstile_load_failed'));
      };
      document.head.appendChild(el);
    });
  }
  return turnstileScript;
}

/**
 * Explicit render, not the implicit `.cf-turnstile` scan. The implicit mode
 * only scans the DOM once, when api.js first loads, so reaching this page by
 * a client-side navigation (the header "Free Chat" link) rendered an empty
 * div, posted no token, and every signup failed the robot check. Rendering
 * from an effect works on hard loads and client navigations alike.
 *
 * `resetKey` changes on every action result: a token is single use, so a
 * failed submit (bad email, failed verify) needs a fresh one before retry.
 */
function TurnstileWidget({siteKey, resetKey}) {
  const ref = useRef(null);
  const widgetId = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !ref.current || widgetId.current !== null) return;
        widgetId.current = turnstile.render(ref.current, {
          sitekey: siteKey,
          action: 'free-chat-signup',
          // The normal widget is a fixed 300px wide and `flexible` has a 300px
          // minimum; only `compact` (150px wide, 140px tall) fits less. The
          // form is 230px at a 360px viewport (245 at 375, 260 at 390), so
          // the 300px iframe overflowed it and made the page 366px wide at
          // 360. Pick compact whenever the form box is narrower
          // than 300px. Measured once at render, which is enough for a form
          // whose width only changes with the viewport.
          size: ref.current.clientWidth < 300 ? 'compact' : 'normal',
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (widgetId.current !== null && window.turnstile) {
        window.turnstile.remove(widgetId.current);
      }
      widgetId.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey && widgetId.current !== null && window.turnstile) {
      window.turnstile.reset(widgetId.current);
    }
  }, [resetKey]);

  return <div ref={ref} className="cf-turnstile" />;
}
