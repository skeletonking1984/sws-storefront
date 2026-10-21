/**
 * Image and video assets, served from the Shopify CDN rather than committed.
 *
 * This public copy of the storefront keeps binaries out of git. Each URL
 * below is the exact file the live storefront already
 * serves from its Oxygen deployment; the filename hash is the Vite content
 * hash of the original asset, so the bytes match what the production build
 * would emit. Fonts and the favicon stay in `app/assets/`.
 */
const CDN =
  'https://cdn.shopify.com/oxygen-v2/59908/173949/355505/4780771/assets/';

/** app/assets/apple-touch-icon.png */
export const appleTouchIconPng = `${CDN}apple-touch-icon-DLv362QY.png`;
/** app/assets/custom-widgets-hero/desktop-1280.avif */
export const customWidgetsHeroDesktop1280Avif = `${CDN}desktop-1280-D7uptP9D.avif`;
/** app/assets/custom-widgets-hero/desktop-1280.jpg */
export const customWidgetsHeroDesktop1280Jpg = `${CDN}desktop-1280-Vm5MywBg.jpg`;
/** app/assets/custom-widgets-hero/desktop-1280.webp */
export const customWidgetsHeroDesktop1280Webp = `${CDN}desktop-1280-BOZdf6AO.webp`;
/** app/assets/custom-widgets-hero/desktop-800.avif */
export const customWidgetsHeroDesktop800Avif = `${CDN}desktop-800-DQqLmcNO.avif`;
/** app/assets/custom-widgets-hero/desktop-800.webp */
export const customWidgetsHeroDesktop800Webp = `${CDN}desktop-800-LojAyOnD.webp`;
/** app/assets/custom-widgets-hero/mobile-480.avif */
export const customWidgetsHeroMobile480Avif = `${CDN}mobile-480-BeX9ccOA.avif`;
/** app/assets/custom-widgets-hero/mobile-480.webp */
export const customWidgetsHeroMobile480Webp = `${CDN}mobile-480-vYN9qdlO.webp`;
/** app/assets/custom-widgets-hero/mobile-720.avif */
export const customWidgetsHeroMobile720Avif = `${CDN}mobile-720-ByD4-w4A.avif`;
/** app/assets/custom-widgets-hero/mobile-720.jpg */
export const customWidgetsHeroMobile720Jpg = `${CDN}mobile-720-B0jtVLDl.jpg`;
/** app/assets/custom-widgets-hero/mobile-720.webp */
export const customWidgetsHeroMobile720Webp = `${CDN}mobile-720-B-7xJGlo.webp`;
/** app/assets/free-chat-hero.webp */
export const freeChatHeroWebp = `${CDN}free-chat-hero-CZxSkBg6.webp`;
/** app/assets/hero-goalfill.mp4 */
export const heroGoalfillMp4 = `${CDN}hero-goalfill-CmdrfMjZ.mp4`;
/** app/assets/hero-goalfill-poster.jpg */
export const heroGoalfillPosterJpg = `${CDN}hero-goalfill-poster-CgNNDtLq.jpg`;
/** app/assets/hero-goalfill.webm */
export const heroGoalfillWebm = `${CDN}hero-goalfill-CuZA97dH.webm`;
/** app/assets/hero-goalfill.webp */
export const heroGoalfillWebp = `${CDN}hero-goalfill-iBofLE0Q.webp`;
/** app/assets/logo.png */
export const logoPng = `${CDN}logo-DRhzkg4y.png`;
/** app/assets/logo.webp */
export const logoWebp = `${CDN}logo-zaTnqR10.webp`;
/** app/assets/og-image-bundle.jpg */
export const ogImageBundleJpg = `${CDN}og-image-bundle-BdtdYzSh.jpg`;
/** app/assets/og-image-custom-widgets.jpg */
export const ogImageCustomWidgetsJpg = `${CDN}og-image-custom-widgets-DnheA3tl.jpg`;
/** app/assets/og-image-free-chat.jpg */
export const ogImageFreeChatJpg = `${CDN}og-image-free-chat-B_jQNV1D.jpg`;
/** app/assets/og-image.jpg */
export const ogImageJpg = `${CDN}og-image-4mjmVMbW.jpg`;
/** app/assets/pfp.webp */
export const pfpWebp = `${CDN}pfp-D3u3v1pY.webp`;
/** app/assets/streamelements.png */
export const streamelementsPng = `${CDN}streamelements-COXdV8x5.png`;
