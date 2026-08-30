const KNOWN_PLATFORMS = [
  'Twitch',
  'YouTube',
  'TikTok',
  'Kick',
  'OBS',
  'Streamlabs',
  'StreamElements',
  'VTuber',
];

/**
 * Scans product title/description text for known streaming platform names
 * and returns the matched ones in a stable, de-duplicated order.
 * @param {string} text
 * @returns {string[]}
 */
export function detectPlatforms(text) {
  if (!text) return [];
  const found = new Set();
  for (const platform of KNOWN_PLATFORMS) {
    const pattern = new RegExp(platform.replace(/\s/g, '\\s*'), 'i');
    if (pattern.test(text)) {
      found.add(platform);
    }
  }
  return Array.from(found);
}
