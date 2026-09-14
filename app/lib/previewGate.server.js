/**
 * Optional password gate for non production deployments.
 *
 * Why this exists: Oxygen preview deployments are gated by Shopify OAuth at
 * the edge, before this worker ever runs, so they cannot be opened on a phone
 * without logging into Shopify. The `--auth-bypass-token` the CLI can mint is
 * header only, verified 2026-09-14: as a header it returns 200, as any query
 * parameter it still returns 302, and a phone browser cannot send headers.
 *
 * So this gates the app itself instead, with a password simple enough to type
 * on a phone. Point it at a LAN address, a tunnel, or any future public
 * staging environment.
 *
 * **It is completely inert unless `PRIVATE_PREVIEW_PASSWORD` is set.** No
 * cookie, no branch taken, nothing rendered. Production never sets it, so
 * production is unaffected.
 *
 * Deliberately NOT a login: no accounts, no session store, no reset flow. One
 * shared password, one cookie. This guards a staging build from strangers and
 * search engines, nothing more. Never protect anything that matters with it.
 */
const COOKIE = 'sws_preview';

/**
 * Constant time-ish compare. Not a serious defence (the secret is a shared
 * word typed on a phone) but there is no reason to leak length or prefix.
 * @param {string} a
 * @param {string} b
 */
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * A cookie value that is not the password itself, so a stolen cookie from a
 * shared screenshot does not hand over the password. Uses the Web Crypto that
 * Oxygen's runtime already provides.
 * @param {string} password
 */
async function tokenFor(password) {
  const data = new TextEncoder().encode(`sws-preview:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32);
}

/** @param {string | null} header @param {string} name */
function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

/**
 * @param {string} origin
 * @param {boolean} wrong
 */
function formPage(origin, wrong) {
  const secure = origin.startsWith('https://') ? '' : '';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Stream Widget Shop preview</title></head>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0713;color:#f3effb;font:16px/1.5 system-ui,-apple-system,sans-serif">
<form method="POST" style="width:min(340px,88vw);display:flex;flex-direction:column;gap:14px">
<h1 style="font-size:1.15rem;margin:0">Preview build</h1>
<p style="margin:0;color:#a89ec4;font-size:.9rem">Not the live shop. Enter the preview password.</p>
${wrong ? '<p style="margin:0;color:#ff8ab0;font-size:.9rem">Wrong password.</p>' : ''}
<input type="password" name="password" autocomplete="current-password" autofocus
 style="font-size:16px;padding:14px;border-radius:12px;border:1px solid #3a2f55;background:#150e24;color:#f3effb">
<button type="submit" style="font-size:16px;font-weight:700;padding:14px;border-radius:999px;border:0;background:linear-gradient(100deg,#7fe6ff,#b79df2,#ff8ab0);color:#0b0713">Open preview</button>
</form></body></html>${secure}`;
}

/**
 * Returns a Response to send INSTEAD of the app, or null to let the request
 * through untouched.
 * @param {Request} request
 * @param {{PRIVATE_PREVIEW_PASSWORD?: string}} env
 * @returns {Promise<Response | null>}
 */
export async function previewGate(request, env) {
  const password = env?.PRIVATE_PREVIEW_PASSWORD;
  if (!password) return null;

  const expected = await tokenFor(password);
  const url = new URL(request.url);
  const secure = url.protocol === 'https:' ? ' Secure;' : '';

  if (request.method === 'POST') {
    const form = await request.clone().formData();
    const supplied = String(form.get('password') ?? '');
    if (safeEqual(supplied, password)) {
      return new Response(null, {
        status: 303,
        headers: {
          Location: url.pathname + url.search,
          'Set-Cookie': `${COOKIE}=${expected}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=604800`,
        },
      });
    }
    return new Response(formPage(url.origin, true), {
      status: 401,
      headers: {'Content-Type': 'text/html; charset=utf-8'},
    });
  }

  const cookie = readCookie(request.headers.get('Cookie'), COOKIE);
  if (cookie && safeEqual(cookie, expected)) return null;

  return new Response(formPage(url.origin, false), {
    status: 401,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
