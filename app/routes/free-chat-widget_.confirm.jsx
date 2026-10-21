import {useState, useMemo, useEffect} from 'react';
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from 'react-router';
import {useAnalytics} from '@shopify/hydrogen';
import {verifyConfirmToken, TTL_MS} from '~/lib/freeChatConfirm.server';
import {
  getUsedRecord,
  isTokenUsed,
  markTokenUsed,
} from '~/lib/freeChatConfirmUse.server';
import {CONSENT_VERSION} from '~/lib/freeChatConsent';
import {subscribeViaStorefront} from '~/lib/subscribe.server';
import {mintWidgetToken} from '~/lib/freeChatMint.server';
import {sendNotificationEmail} from '~/lib/notify.server';
import {buildMeta, getOrigin, absoluteAsset} from '~/lib/seo';
import {OVERLAY_FEATURED_HANDLES} from '~/lib/nav';
import {WELCOME_CODE} from '~/components/EmailCapture';
import {FreeChatPageStyles} from '~/components/FreeChatPageStyles';
import {ogImageFreeChatJpg as freeChatOgImage} from '~/lib/cdnAssets';
import {brand} from '~/lib/brand.config';

const WIDGET_BASE_URL = brand.freeChat.widgetBaseUrl;
const MULTISTREAM_PACK_HANDLE = OVERLAY_FEATURED_HANDLES[2]; // 'multistream-chat-widget-pack'

// Stream Chat Lite offers Twitch and Kick only (2026-10-05). YouTube and
// TikTok are paid-widget features. The widget enforces it too
// (sws-free-chat d27f72c, live 2026-10-05): it connects Twitch and Kick at
// boot and holds ?yt= / ?tiktok= until /api/validate says the token is
// legacy, so a new token that adds them to its URL gets neither.
const PLATFORM_ORDER = ['twitch', 'kick'];
const PLATFORM_LABEL = {twitch: 'Twitch', kick: 'Kick'};
const DEFAULT_PICKED = ['twitch', 'kick'];

export const meta = ({matches}) => {
  const origin = getOrigin(matches);
  return buildMeta({
    title: `Set up Stream Chat Lite - ${brand.name}`,
    description:
      'Confirm your email and set up your free Stream Chat Lite widget URL.',
    url: `${origin}/free-chat-widget/confirm`,
    image: absoluteAsset(origin, freeChatOgImage),
    imageWidth: 1200,
    imageHeight: 630,
  });
};

/**
 * GET /free-chat-widget/confirm?token=...
 *
 * Verifies the signed email-confirm link and renders a page asking the
 * visitor to click a "Confirm and get my widget" button. That is ALL the
 * GET does. It never records marketing consent and never mints a widget
 * token -- a GET is followed by mail scanners and link previewers,
 * not just people, so a GET with a side effect opts a stranger's inbox scan
 * into the mailing list and mints them a widget token they never asked for.
 * Consent + mint moved into the POST action below, which only a real click
 * on the rendered button can trigger.
 *
 * @param {import('react-router').LoaderFunctionArgs} args
 */
export async function loader({request, context}) {
  // Gated by brand.config.js `features.freeChat`, same as free-chat-widget.jsx.
  if (!brand.features.freeChat) {
    throw new Response('Not found', {status: 404});
  }
  const token = new URL(request.url).searchParams.get('token');
  if (!token) {
    return {state: 'error', reason: 'missing'};
  }

  const verified = await verifyConfirmToken({token, env: context.env});
  if (!verified.ok) {
    return {state: 'error', reason: verified.reason};
  }

  // Already confirmed by a real click: reopen the same setup page with the
  // widget token minted then. Nothing is recorded or minted here, so a mail
  // scanner still gets nothing it could not get before the human clicked.
  const used = await getUsedRecord(token);
  if (used) {
    return used.widgetToken
      ? {state: 'resume', email: verified.email, widgetToken: used.widgetToken}
      : {state: 'used', email: verified.email};
  }

  return {state: 'ready', token, email: verified.email};
}

/**
 * POST /free-chat-widget/confirm, body: token=...
 *
 * Records marketing consent (the existing storefront customerCreate path,
 * see subscribeViaStorefront's own comments for its known limitation on an
 * address that is ALREADY a Shopify customer -- that case falls to the
 * nightly sweep, same as the homepage newsletter
 * form), mints a widget token, and marks the token used so a second POST
 * with the same token (a reopened tab, a replayed request) gets the
 * friendly "already confirmed" state instead of a second consent record
 * and a second mint. Consent text version and timestamp are stored by the
 * token service (sws-free-chat's /api/mint), alongside the token itself,
 * since that is the durable record of what this specific widget install
 * agreed to.
 *
 * @param {import('react-router').ActionFunctionArgs} args
 */
export async function action({request, context}) {
  const formData = await request.formData();
  const token = (formData.get('token') || '').toString();
  if (!token) {
    return {state: 'error', reason: 'missing'};
  }

  const verified = await verifyConfirmToken({token, env: context.env});
  if (!verified.ok) {
    return {state: 'error', reason: verified.reason};
  }

  if (await isTokenUsed(token)) {
    return {state: 'used', email: verified.email};
  }

  const consent = await subscribeViaStorefront({
    email: verified.email,
    storefront: context.storefront,
  });
  if (!consent.ok) {
    console.error(
      `[free-chat] consent not recorded: ${consent.state}${consent.reason ? ` (${consent.reason})` : ''}`,
    );
  }

  const minted = await mintWidgetToken({
    email: verified.email,
    env: context.env,
  });
  if (!minted.ok) {
    console.error(`[free-chat] token mint failed: ${minted.reason}`);
  }

  // Remaining lifetime of the SIGNED token, not a fresh 48h: no reason to
  // remember "used" past the point this token would have stopped verifying
  // anyway.
  await markTokenUsed(
    token,
    TTL_MS - (Date.now() - verified.iat),
    minted.ok ? minted.token : null,
  );

  // Every Stream Chat Lite download sends a notification to NOTIFY_EMAIL.
  // Confirm is the moment the widget is handed over, so this is the download. waitUntil keeps the send
  // off the visitor's response; a failed send is logged, never shown to them.
  const consentState = consent.ok
    ? consent.state
    : `failed:${consent.reason || consent.state}`;
  const country =
    request.headers.get('oxygen-buyer-country') ||
    request.headers.get('cf-ipcountry') ||
    'unknown';
  const notify = sendNotificationEmail({
    env: context.env,
    origin: new URL(request.url).origin,
    replyTo: verified.email,
    subject: `Stream Chat Lite signup: ${verified.email}${minted.ok ? '' : ' (WIDGET LINK NOT MINTED)'}`,
    text: [
      'Someone just confirmed and got the free Stream Chat Lite widget.',
      '',
      `Email: ${verified.email}`,
      `When: ${new Date().toISOString()}`,
      `Country: ${country}`,
      `Marketing list: ${consentState}`,
      `Widget link minted: ${minted.ok ? 'yes' : `NO (${minted.reason})`}`,
      `Consent version: ${CONSENT_VERSION}`,
      '',
      'Reply to this email to reach them directly.',
    ].join('\n'),
  })
    .then((r) => {
      if (!r?.ok)
        console.error(`[free-chat] signup notification failed: ${r?.reason}`);
    })
    .catch((e) =>
      console.error(`[free-chat] signup notification threw: ${e?.message}`),
    );
  if (context.waitUntil) context.waitUntil(notify);
  else await notify;

  return {
    state: 'ok',
    email: verified.email,
    consentState,
    consentVersion: CONSENT_VERSION,
    widgetToken: minted.ok ? minted.token : null,
  };
}

export default function FreeChatWidgetConfirm() {
  /** @type {ReturnType<typeof loader>} */
  const data = useLoaderData();
  /** @type {ReturnType<typeof action>} */
  const actionData = useActionData();
  // The action's own result wins over the loader's revalidated read: a
  // successful POST marks the token used, so the loader that reruns right
  // after would otherwise report 'used' and hide the setup page it just
  // earned.
  const result = actionData ?? data;
  const navigation = useNavigation();
  const confirming = navigation.state !== 'idle';
  const {publish} = useAnalytics();

  // The one funnel step mapped to every ad platform's lead event (see
  // normalizeSignupConfirmed in app/lib/analytics/events.js), fired only
  // when the POST action actually confirmed (result.state === 'ok'; the one-time-link
  // security fix moved consent+mint off the GET loader onto a POST action --
  // see above -- so this must watch the ACTION's result, never the loader's
  // own 'ready'/'used'/'error' states, or a mail scanner opening the GET link
  // would fire a lead event with nothing actually confirmed). Guarded against
  // a page refresh re-firing it via the minted token itself.
  useEffect(() => {
    if (result.state !== 'ok') return;
    const dedupeKey = result.widgetToken
      ? `fc_lead_sent:${result.widgetToken}`
      : null;
    if (dedupeKey && typeof sessionStorage !== 'undefined') {
      if (sessionStorage.getItem(dedupeKey)) return;
      sessionStorage.setItem(dedupeKey, '1');
    }
    publish('custom_signup_confirmed', {source: 'free-chat'});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.state, result.widgetToken]);

  if (result.state === 'error') {
    return (
      <div className="free-chat-page">
        <FreeChatPageStyles />
        <h1>That link did not work</h1>
        <p>
          {result.reason === 'expired'
            ? 'This confirm link has expired (links last 48 hours).'
            : 'This confirm link is invalid.'}{' '}
          <Link to="/free-chat-widget">Request a new one</Link>.
        </p>
      </div>
    );
  }

  if (result.state === 'used') {
    return (
      <div className="free-chat-page">
        <FreeChatPageStyles />
        <h1>You are already confirmed</h1>
        <p>
          {result.email ? `${result.email} is confirmed. ` : ''}If you copied
          your widget URL, it keeps working. To get back to the setup page,{' '}
          <Link to="/free-chat-widget">send yourself a new link</Link>.
        </p>
      </div>
    );
  }

  if (result.state === 'ready') {
    return (
      <div className="free-chat-page">
        <FreeChatPageStyles />
        <h1>Confirm your email</h1>
        <p className="free-chat-lede">
          One more click to record consent for {result.email} and get your
          Stream Chat Lite widget URL.
        </p>
        <Form method="post">
          <input type="hidden" name="token" value={result.token} />
          <button
            type="submit"
            className="sws-btn sws-btn-primary"
            disabled={confirming}
          >
            {confirming ? 'Confirming...' : 'Confirm and get my widget'}
          </button>
        </Form>
      </div>
    );
  }

  return <SetupPage email={result.email} widgetToken={result.widgetToken} />;
}

function buildWidgetUrl({widgetToken, twitch, kickId, demo}) {
  const url = new URL(WIDGET_BASE_URL);
  if (demo) {
    url.searchParams.set('demo', '1');
    return url.toString();
  }
  if (widgetToken) url.searchParams.set('t', widgetToken);
  if (twitch) url.searchParams.set('twitch', twitch);
  if (kickId) url.searchParams.set('kickId', kickId);
  return url.toString();
}

function SetupPage({email, widgetToken}) {
  const [twitch, setTwitch] = useState('');
  const [kickSlug, setKickSlug] = useState('');
  const [kickId, setKickId] = useState('');
  const [kickStatus, setKickStatus] = useState('idle'); // idle | loading | ok | manual
  const [copied, setCopied] = useState(false);
  const [seCopied, setSeCopied] = useState(false);
  const [picked, setPicked] = useState(DEFAULT_PICKED);

  // Keep what they typed across a refresh or a reopened link, in this
  // browser only. Same values already sit in the widget URL they copy.
  const storageKey = `fc_setup:${widgetToken || 'none'}`;
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
      if (saved) {
        setTwitch(saved.twitch || '');
        setKickSlug(saved.kickSlug || '');
        setKickId(saved.kickId || '');
        if (saved.kickId) setKickStatus('ok');
        // Older saves may carry youtube/tiktok picks and keys: those are
        // dropped here, only Twitch and Kick are offered.
        // Older saves have no `picked`: infer it from which platforms were
        // filled in.
        const savedPicks = Array.isArray(saved.picked)
          ? saved.picked.filter((name) => PLATFORM_ORDER.includes(name))
          : PLATFORM_ORDER.filter((name) =>
              name === 'twitch' ? saved.twitch : saved.kickId,
            );
        if (savedPicks.length) setPicked(savedPicks);
      }
    } catch {
      // Storage blocked or bad JSON: start empty, same as before.
    }
    setRestored(true);
  }, [storageKey]);
  useEffect(() => {
    if (!restored) return;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({twitch, kickSlug, kickId, picked}),
      );
    } catch {
      // Ignore: worst case the fields are empty after a refresh.
    }
  }, [restored, storageKey, twitch, kickSlug, kickId, picked]);

  async function resolveKick() {
    if (!kickSlug.trim()) return;
    setKickStatus('loading');
    try {
      const response = await fetch(
        `${brand.freeChat.kickUrlBase}?slug=${encodeURIComponent(kickSlug.trim())}`,
      );
      const body = await response.json();
      if (body.ok && body.kickId) {
        setKickId(String(body.kickId));
        setKickStatus('ok');
      } else {
        setKickStatus('manual');
      }
    } catch {
      setKickStatus('manual');
    }
  }

  const isPicked = (name) => picked.includes(name);
  function togglePlatform(name) {
    setPicked((current) =>
      current.includes(name)
        ? current.filter((n) => n !== name)
        : [...current, name],
    );
  }

  // Only picked platforms go into the URL, so what is copied is exactly what
  // the free widget will connect.
  const eff = {
    twitch: isPicked('twitch') ? twitch : '',
    kickId: isPicked('kick') ? kickId : '',
  };
  const liveUrl = useMemo(
    () => buildWidgetUrl({widgetToken, ...eff}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [widgetToken, eff.twitch, eff.kickId],
  );
  const previewUrl = useMemo(() => {
    const hasAny = eff.twitch || eff.kickId;
    return hasAny ? liveUrl : buildWidgetUrl({demo: true});
  }, [liveUrl, eff.twitch, eff.kickId]);

  // StreamElements has no Browser Source concept, so the widget ships as a
  // Custom Widget: one transparent, borderless iframe pointing at the same
  // URL the OBS/Streamlabs box above uses. Verified 2026-09-27 against a
  // local harness that nests this exact HTML inside a sandboxed iframe
  // inside a foreign-origin page (see sws-free-chat/test/check-se-framing.mjs):
  // transparency, a real Twitch chat GIF and the platform marks render
  // correctly through three levels of nesting, no console errors. Not yet
  // confirmed inside a real StreamElements dashboard, see marketing/SE-TEST.md.
  const seWidgetHtml = useMemo(
    () =>
      `<iframe src="${liveUrl}" allow="autoplay" style="width:100%;height:100%;border:0;background:transparent;" scrolling="no"></iframe>`,
    [liveUrl],
  );

  function copyUrl() {
    navigator.clipboard?.writeText(liveUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function copySeHtml() {
    navigator.clipboard?.writeText(seWidgetHtml).then(() => {
      setSeCopied(true);
      setTimeout(() => setSeCopied(false), 2000);
    });
  }

  return (
    <div className="free-chat-page">
      <FreeChatPageStyles />
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .free-chat-setup-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; align-items: start; }
        @media (max-width: 800px) { .free-chat-setup-grid { grid-template-columns: 1fr; } }
        .free-chat-field { margin: 0 0 1.1rem; }
        .free-chat-field label { display: block; font-weight: 700; margin: 0 0 0.35rem; }
        .free-chat-field input { width: 100%; padding: 0.65rem 0.9rem; border-radius: 8px; border: 1px solid var(--sws-border); background: var(--sws-bg); color: var(--sws-text); box-sizing: border-box; }
        .free-chat-field small { display: block; color: var(--sws-sub); margin-top: 0.3rem; font-size: 0.85rem; }
        .free-chat-platform-card { background: var(--sws-card-solid); border: 1px solid var(--sws-border); border-radius: 14px; padding: 1.25rem; margin: 0 0 1.25rem; }
        .free-chat-platform-card h3 { margin: 0 0 0.75rem; font-size: 1.05rem; }
        .free-chat-preview-frame { width: 100%; aspect-ratio: 1 / 2; max-width: 340px; border: 1px solid var(--sws-border); border-radius: 12px; background: #101020; overflow: hidden; }
        .free-chat-url-box { display: flex; gap: 0.5rem; margin: 1rem 0; }
        .free-chat-url-box input { flex: 1; font-family: monospace; font-size: 0.8rem; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--sws-border); background: var(--sws-bg); color: var(--sws-text); }
        .free-chat-url-box textarea { flex: 1; font-family: monospace; font-size: 0.78rem; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--sws-border); background: var(--sws-bg); color: var(--sws-text); resize: vertical; min-height: 4.5rem; }
        .free-chat-url-box button { flex: 0 0 auto; white-space: nowrap; }
        .free-chat-alt-hosts { margin-top: 1.75rem; }
        .free-chat-alt-hosts h3 { margin: 0 0 0.5rem; font-size: 1rem; }
        .free-chat-alt-steps { margin: 0.75rem 0 0.9rem; padding-left: 1.2rem; }
        .free-chat-alt-steps li { margin: 0 0 0.35rem; font-size: 0.9rem; }
        .free-chat-picker { border: 1px solid var(--sws-border); border-radius: 14px; padding: 1rem 1.25rem; margin: 0 0 1.75rem; min-width: 0; }
        .free-chat-picker legend { font-weight: 700; padding: 0 0.4rem; }
        .free-chat-picker-row { display: flex; flex-wrap: wrap; gap: 0.6rem; margin: 0.4rem 0 0.7rem; }
        .free-chat-pick { display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.5rem 0.9rem; border: 1px solid var(--sws-border); border-radius: 999px; background: var(--sws-card-solid); cursor: pointer; font-weight: 600; }
        .free-chat-pick.is-on { border-color: var(--sws-border-strong); }
        .free-chat-picker small { display: block; color: var(--sws-text); font-size: 0.85rem; }
        .free-chat-picker small a { color: var(--sws-accent-2); text-decoration: underline; }
        .free-chat-upsell { background: linear-gradient(135deg, rgba(240,80,154,0.14), rgba(127,230,255,0.10)); border: 1px solid var(--sws-border-strong); border-radius: 14px; padding: 1.5rem; margin-top: 2.5rem; }
      `,
        }}
      />

      <h1>You&rsquo;re confirmed. Set up your widget.</h1>
      <p className="free-chat-lede">
        {email} is on the list. Pick Twitch, Kick or both below, fill them in,
        copy the URL, and drop it into OBS.
      </p>

      <fieldset className="free-chat-picker">
        <legend>Which platforms? Free covers Twitch and Kick.</legend>
        <div className="free-chat-picker-row">
          {PLATFORM_ORDER.map((name) => {
            const on = isPicked(name);
            return (
              <label
                key={name}
                className={`free-chat-pick${on ? ' is-on' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => togglePlatform(name)}
                />
                {PLATFORM_LABEL[name]}
              </label>
            );
          })}
        </div>
        <small>
          YouTube and TikTok chat are in the{' '}
          <Link
            to={`/products/${MULTISTREAM_PACK_HANDLE}?utm_source=stream-chat-lite&utm_medium=free-widget&utm_campaign=setup-page-picker`}
          >
            Multistream Chat Widget Pack
          </Link>
          .
        </small>
      </fieldset>

      <div className="free-chat-setup-grid">
        <div>
          {isPicked('twitch') && (
            <div className="free-chat-platform-card">
              <h3>Twitch</h3>
              <div className="free-chat-field">
                <label htmlFor="fc-twitch">Channel name</label>
                <input
                  id="fc-twitch"
                  type="text"
                  value={twitch}
                  onChange={(e) =>
                    setTwitch(e.target.value.trim().toLowerCase())
                  }
                  placeholder="yourchannel"
                />
                <small>
                  Your Twitch username, exactly as it appears in your channel
                  URL.
                </small>
              </div>
            </div>
          )}

          {isPicked('kick') && (
            <div className="free-chat-platform-card">
              <h3>Kick</h3>
              <div className="free-chat-field">
                <label htmlFor="fc-kick">Channel name</label>
                <input
                  id="fc-kick"
                  type="text"
                  value={kickSlug}
                  onChange={(e) => {
                    setKickSlug(e.target.value);
                    setKickStatus('idle');
                  }}
                  onBlur={resolveKick}
                  placeholder="yourchannel"
                />
                <small>
                  {kickStatus === 'loading' &&
                    'Looking up your Kick chatroom...'}
                  {kickStatus === 'ok' && `Found it, chatroom id ${kickId}.`}
                  {kickStatus === 'manual' &&
                    'Couldn\'t auto-resolve that. Enter your chatroom id manually below (curl -A "Mozilla/5.0" https://kick.com/api/v2/channels/<yourname>, look for .chatroom.id).'}
                </small>
              </div>
              {(kickStatus === 'manual' || kickStatus === 'idle') && (
                <div className="free-chat-field">
                  <label htmlFor="fc-kickid">Kick chatroom id (manual)</label>
                  <input
                    id="fc-kickid"
                    type="text"
                    value={kickId}
                    onChange={(e) => setKickId(e.target.value.trim())}
                    placeholder="Fills in automatically"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div>
          <h3>Preview</h3>
          <iframe
            title="Stream Chat Lite preview"
            src={previewUrl}
            className="free-chat-preview-frame"
          />
          <p>
            <small>
              Showing demo chat until you enter at least one platform above. The
              demo shows sample Twitch and Kick rows.
            </small>
          </p>

          <h3>Your widget URL</h3>
          <div className="free-chat-url-box">
            <input
              type="text"
              readOnly
              value={liveUrl}
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              className="sws-btn sws-btn-ghost"
              onClick={copyUrl}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <p>
            <strong>OBS:</strong> add a Browser Source, paste this URL, set
            width 450 and height 900. Keeps working even if you ever unsubscribe
            from the email list. Twitch and Kick need no keys or logins: the URL
            only holds your channel names and your setup token. The free widget
            connects the platforms you picked (Twitch, Kick or both) and shows a
            small &ldquo;Free chat by Stream Widget Shop&rdquo; line under the
            chat.
          </p>

          <div className="free-chat-alt-hosts">
            <h3>Using StreamElements?</h3>
            <p>
              StreamElements does not have a Browser Source. Paste this as a
              Custom Widget instead, your URL is already filled in:
            </p>
            <div className="free-chat-url-box">
              <textarea
                readOnly
                value={seWidgetHtml}
                onFocus={(e) => e.target.select()}
                aria-label="StreamElements custom widget HTML"
              />
              <button
                type="button"
                className="sws-btn sws-btn-ghost"
                onClick={copySeHtml}
              >
                {seCopied ? 'Copied!' : 'Copy SE widget code'}
              </button>
            </div>
            <ol className="free-chat-alt-steps">
              <li>
                Go to streamelements.com/dashboard/overlays and open your
                overlay.
              </li>
              <li>
                Click the + button, then Custom Widget (under Static/Custom).
              </li>
              <li>Select it, then click Open Editor.</li>
              <li>
                Click the HTML tab, paste the code above, then close the editor.
              </li>
              <li>Resize the widget box to 450 x 900.</li>
            </ol>
            <p>
              <strong>Streamlabs Desktop:</strong> Add Source, Browser Source,
              paste your widget URL above, set width 450 and height 900, the
              same as OBS.
            </p>
          </div>
        </div>
      </div>

      <div className="free-chat-upsell">
        <h2>Want more? Multistream Chat Widget Pack</h2>
        <p>
          YouTube and TikTok chat too, plus 10 overlay skins, avatars, pronouns
          and 5 animated alerts (follow, tip, sub, cheer, raid). Stream Chat
          Lite stays free either way, with Twitch and Kick.
        </p>
        <p>
          <Link
            to={`/products/${MULTISTREAM_PACK_HANDLE}?utm_source=stream-chat-lite&utm_medium=free-widget&utm_campaign=setup-page-upsell`}
            className="sws-btn sws-btn-primary"
          >
            See the Multistream Chat Widget Pack
          </Link>
        </p>
        <p>
          <small>
            Use code {WELCOME_CODE} for 10% off, from the same list you just
            joined.
          </small>
        </p>
      </div>
    </div>
  );
}
