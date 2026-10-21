/**
 * Names SWS must never put on a shopping or ad channel.
 *
 * Kept in one module because more than one thing needs it: the product feed
 * refuses these outright, and the IP audit reports on them. Two copies of this
 * list would drift, and the half that drifts is the half that ships Pokemon to
 * an ad network.
 *
 * Word boundaries are not decoration here. "witch" without \b matches inside
 * "Twitch", and nearly every product in this catalogue says Twitch, so a sloppy
 * pattern would reject the entire feed. That exact bug has now been made twice
 * in this codebase, in blogCrossSell.js and in the blog hero assigner.
 */
export const IP_TERMS = [
  /\bpok[eé]?-?\s?mon\b/i,
  /\bpikachu\b/i,
  /\beevee\b/i,
  /\bbulbasaur\b/i,
  /\bcharizard\b/i,
  /\bstar\s?wars\b/i,
  /\bmandalorian\b/i,
  /\bgrogu\b/i,
  /\byoda\b/i,
  /\bvalorant\b/i,
  /\bbrimstone\b/i,
  /\bgenshin\b/i,
  /\bfortnite\b/i,
  /\bminecraft\b/i,
  /\bzelda\b/i,
  /\boverwatch\b/i,
  /\bhello\s?kitty\b/i,
  /\bsanrio\b/i,
  /\bdisney\b/i,
];
