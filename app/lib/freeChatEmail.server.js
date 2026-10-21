/**
 * Confirmation email for the Stream Chat Lite free-widget signup.
 *
 * SERVER ONLY. Reuses the storefront's existing Resend integration
 * (`PRIVATE_RESEND_API_KEY`, same env var name notify.server.js already
 * reads) but sends TO the visitor, not to the shop owner, so it is a separate function
 * rather than a call into sendNotificationEmail.
 */

import {OVERLAY_FEATURED_HANDLES} from '~/lib/nav';
import {brand} from '~/lib/brand.config';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 8000;
const DEFAULT_FROM = `${brand.chatFromEmail.name} <${brand.chatFromEmail.address}>`;
// Same product the setup page (free-chat-widget_.confirm.jsx) and the
// landing page (free-chat-widget.jsx) link to.
const MULTISTREAM_PACK_HANDLE = OVERLAY_FEATURED_HANDLES[2]; // 'multistream-chat-widget-pack'

/**
 * @param {{env: Record<string, string|undefined>, to: string, confirmUrl: string, origin?: string}} args
 * @returns {Promise<{ok: true, id?: string} | {ok: false, reason: string}>}
 */
export async function sendFreeChatConfirmEmail({env, to, confirmUrl, origin}) {
  if (!env?.PRIVATE_RESEND_API_KEY) {
    return {ok: false, reason: 'not_configured'};
  }

  const from =
    (env.PRIVATE_CONTACT_FROM_EMAIL &&
      env.PRIVATE_CONTACT_FROM_EMAIL.includes(`@${brand.domain}`) &&
      env.PRIVATE_CONTACT_FROM_EMAIL) ||
    DEFAULT_FROM;

  const site = origin || brand.origin;
  const upsellUrl = `${site}/products/${MULTISTREAM_PACK_HANDLE}?utm_source=stream-chat-lite&utm_medium=free-widget&utm_campaign=email`;

  const text = [
    'Confirm your email to get Stream Chat Lite free.',
    '',
    'Click to confirm and finish setup:',
    confirmUrl,
    '',
    'This link expires in 48 hours.',
    '',
    `Get Stream Chat Lite free by joining the ${brand.name} email list.`,
    'Unsubscribe anytime, your widget keeps working.',
    '',
    'Stream Chat Lite connects Twitch and Kick and shows a small "Free chat by Stream Widget Shop" line under the chat.',
    '',
    'Want YouTube and TikTok too, plus themed skins, avatars and animated alerts? See the Multistream Chat Widget Pack:',
    upsellUrl,
    'Stream Chat Lite stays free either way.',
    '',
    'If you did not request this, ignore this email, nothing was created.',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1024;">
      <h2 style="margin: 0 0 12px;">Confirm your email to get Stream Chat Lite free</h2>
      <p style="margin: 0 0 20px; line-height: 1.5;">One click and your widget setup page is ready.</p>
      <p style="margin: 0 0 24px;">
        <a href="${confirmUrl}" style="background:#f0509a;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600;">Confirm and set up my widget</a>
      </p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #555;">Link expires in 48 hours.</p>
      <p style="margin: 0 0 8px; font-size: 13px; color: #555;">Get Stream Chat Lite free by joining the ${brand.name} email list. Unsubscribe anytime, your widget keeps working.</p>
      <p style="margin: 16px 0 8px; font-size: 13px; color: #333;">Stream Chat Lite connects Twitch and Kick and shows a small &ldquo;Free chat by Stream Widget Shop&rdquo; line under the chat.</p>
      <p style="margin: 8px 0 8px; font-size: 13px; color: #333;">Want YouTube and TikTok too, plus themed skins, avatars and animated alerts? See the <a href="${upsellUrl}" style="color:#1a1024;font-weight:600;text-decoration:underline;">Multistream Chat Widget Pack</a>. Stream Chat Lite stays free either way.</p>
      <p style="margin: 20px 0 0; font-size: 12px; color: #888;">If you did not request this, ignore this email, nothing was created.</p>
    </div>
  `;

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.PRIVATE_RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      body: JSON.stringify({
        from,
        to,
        subject: 'Confirm your email to get Stream Chat Lite free',
        text,
        html,
      }),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return {
        ok: false,
        reason: `send_failed_${response.status}: ${body.slice(0, 150)}`,
      };
    }
    const body = await response.json().catch(() => null);
    return {ok: true, id: body?.id};
  } catch (error) {
    return {ok: false, reason: `send_failed: ${String(error).slice(0, 100)}`};
  }
}
