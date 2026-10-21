/**
 * Now Playing early access gate (file name keeps the old beta slug), shared (server + component) helpers. No secrets here.
 *
 * The early access zip is NOT linked anywhere in the storefront. The only way to a
 * download link is the claim flow (app/lib/nowPlayingBeta.server.js), which
 * asks the sws-downloads Worker for a slot and gets a short-lived signed URL.
 */
export const BETA_SLUG = 'now-playing';
export const BETA_MARKER = '<div data-sws-beta-gate></div>';

const ZIP_NAME = 'SWS-Now-Playing-(?:BETA|Early-Access)';
const ZIP_URL_RE = new RegExp(
  `https?:\\/\\/[^\\s"'<>\\\\]*${ZIP_NAME}[^\\s"'<>\\\\]*`,
  'gi',
);
const ZIP_BARE_RE = new RegExp(`${ZIP_NAME}[^\\s"'<>\\\\]*`, 'gi');
const ZIP_ANCHOR_RE = new RegExp(
  `<a\\b[^>]*${ZIP_NAME}[^>]*>[\\s\\S]*?<\\/a>`,
  'gi',
);

/**
 * 2026-10-05: the program is called "Early access" (product decision), never "beta", and
 * never "free". The Admin page body and title are editable by anyone and
 * have drifted before, so every visible phrasing is mapped here, server side,
 * whatever Admin says. Tags and attributes are left alone (the gate marker,
 * hrefs and the worker slug keep the word "beta" internally).
 */
const EARLY = 'Early access';

function earlyText(text, titleCase) {
  const head = titleCase ? 'Early Access' : EARLY;
  const lower = titleCase ? 'Early Access' : 'early access';
  return String(text)
    .replace(
      /(?:Limited|Free)\s+beta\s*:\s*10 spots\./gi,
      `${EARLY} \u00b7 10 spots.`,
    )
    .replace(/Free while we test\.?/gi, `${EARLY} \u00b7 10 spots.`)
    .replace(/\b(?:the\s+)?free(?:\s|&nbsp;|&#160;|\u00a0)+beta\b/gi, (m) =>
      /^the/i.test(m) ? `the ${lower}` : head,
    )
    .replace(/\blimited(?:\s|&nbsp;|&#160;|\u00a0)+beta\b/gi, head)
    .replace(/\bBeta\b/g, head)
    .replace(/\bbeta\b/g, lower)
    .replace(/\bBETA\b/g, head.toUpperCase());
}

/** Map every "beta" phrasing in the TEXT nodes of an HTML string, never inside a tag. */
function earlyHtml(html) {
  return String(html)
    .split(/(<[^>]*>)/)
    .map((part) => (part.startsWith('<') ? part : earlyText(part, false)))
    .join('');
}

/**
 * The page body lives in Shopify Admin and has carried a direct zip link
 * ("Download the free beta") that bypassed the gate entirely. Strip it here,
 * server side, so it never reaches the rendered HTML or the serialized loader
 * data, whatever the admin body says. Also maps the beta/free framing to
 * "Early access", and makes sure the gate has a marker to render at (right
 * above the Discord button, where the old download button was).
 */
export function sanitizeNowPlayingBody(html) {
  let body = earlyHtml(
    String(html || '')
      .replace(ZIP_ANCHOR_RE, '')
      .replace(ZIP_URL_RE, '#')
      .replace(ZIP_BARE_RE, ''),
  );
  if (!body.includes(BETA_MARKER)) {
    const flexP = body.indexOf('<p style="display:flex');
    body =
      flexP === -1
        ? body + BETA_MARKER
        : body.slice(0, flexP) + BETA_MARKER + body.slice(flexP);
  }
  return body;
}

export function sanitizeNowPlayingPage(page) {
  if (!page || page.handle !== BETA_SLUG) return page;
  const retitle = (s) => (typeof s === 'string' ? earlyText(s, true) : s);
  return {
    ...page,
    title: retitle(page.title),
    body: sanitizeNowPlayingBody(page.body),
    seo: page.seo
      ? {
          ...page.seo,
          title: retitle(page.seo.title),
          description: retitle(page.seo.description),
        }
      : page.seo,
  };
}
