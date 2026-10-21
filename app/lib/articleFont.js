import spaceGroteskLatin from '~/assets/fonts/space-grotesk-latin.woff2?url';

/**
 * Preload link for the long-form reading face (`--font-article`).
 *
 * Shared because TWO routes now paint in it: blog articles and the product
 * description. Not in root.jsx, because every other page would pay ~22KB for a
 * face it never renders.
 *
 * Duplicating the literal in both routes was the alternative and it is the kind
 * of thing that quietly drifts: one route gets a font swap, the other keeps
 * preloading the old file and nobody notices, because a missing preload is not
 * an error. It is just a flash of fallback text.
 *
 * latin-ext is deliberately not preloaded; its unicode-range keeps it off pages
 * with no extended-latin characters.
 */
export const articleFontPreload = {
  rel: 'preload',
  as: 'font',
  type: 'font/woff2',
  href: spaceGroteskLatin,
  crossOrigin: 'anonymous',
};
