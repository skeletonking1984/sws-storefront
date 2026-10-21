/**
 * Email validation for the free-chat-widget signup. Deliberately
 * NOT a `.server.js` file: it touches no secret and no env, and keeping it
 * plain would let a future client-side check reuse the exact same rule
 * instead of drifting from it, the same reasoning as freeChatConsent.js.
 */

// RFC 5321 caps the whole address at 254 characters.
export const EMAIL_MAX_LENGTH = 254;

// Sane, not exhaustive: one local part, one @, one domain with at least
// one dot, no whitespace. Rejects the honeypot-adjacent junk a bot posts
// without rejecting a real address RFC 5322 would technically allow.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @param {unknown} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  if (email.length === 0 || email.length > EMAIL_MAX_LENGTH) return false;
  return EMAIL_REGEX.test(email);
}
