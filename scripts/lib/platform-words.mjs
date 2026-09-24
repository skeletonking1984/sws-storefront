/**
 * The platform words this catalog claims or denies, in one place.
 *
 * Why this exists: `audit-platform-claims.mjs` and `build-seo-fields.mjs`
 * each declared their own copy of the same chat/software platform lists.
 * They drifted the only way lists like this drift: `audit-platform-claims.mjs`
 * built its overclaim test from `CHAT` alone and never fed `SOFTWARE` into
 * it, so Streamlabs, StreamElements and OBS were invisible to that script on
 * every surface, not just the catalog title. Eight live titles claimed
 * Streamlabs against a metafield and an Etsy listing that both said
 * StreamElements-only, and `--check` exited 0. See BAT-161, BAT-160.
 *
 * One list, imported everywhere a platform claim gets checked or written.
 */

/** Chat platforms this catalog's widgets can claim to read. */
export const CHAT = ['Twitch', 'YouTube', 'Kick', 'TikTok'];

/** Broadcast software a product can claim to run through. */
export const SOFTWARE = ['StreamElements', 'Streamlabs', 'OBS'];

/** Every platform word, chat first, in the order copy is written. */
export const PLATFORM_WORDS = [...CHAT, ...SOFTWARE];

/** Never an overclaim: every active listing names Twitch or a Twitch-only
 * concept (bits, subs), verified. See audit-platform-claims.mjs header. */
export const BASELINE = 'Twitch';

/** Twitch-only concepts. Their presence implies Twitch even when the word
 * "Twitch" itself is absent (four listings use older boilerplate like this). */
export const TWITCH_ONLY = /\bbits\b|\bsub(s|scriber)?\b/i;
