import {useState} from 'react';
import {ResponsiveImage} from '~/components/ResponsiveImage';
import {subjectFromTitle} from '~/lib/productName';


/**
 * Etsy-style product gallery: thumbnail rail + large main viewer.
 * Supports both images and videos (Shopify Media API).
 *
 * `title` is the product's own title and it is not optional in practice.
 * Every image in this catalogue carries an EMPTY altText in Shopify (measured
 * 2026-09-19: the first 30 active products had alt "" on every IMAGE node and
 * a real one only on the videos), so an `altText || ''` fallback renders a
 * literal alt="" on the largest image of the page. This component is the only
 * place that can repair that at render time, and it needs the title to do it.
 *
 * @param {{media: Array<any>, title?: string}}
 */
export function ProductGallery({media, title}) {
  // The raw title is an Etsy keyword string. Announcing "Boba Drink Goal
  // Widget for Twitch | Cute Progress Bar | StreamElements Streamlabs OBS,
  // image 4 of 11" eleven times is not usable, so the gallery says the name
  // a person would say. Shared with the generator that writes alt into
  // Shopify, so the two cannot drift.
  const productName = subjectFromTitle(title);
  const items = media?.length ? media : [];

  /*
    Land on the VIDEO, not on media[0].

    Todd, 2026-09-15: "video should show first, like its selected when landed
    on and plays, but user can browse other media like now."

    These are animated widgets. A still of one is a picture of a thing that
    moves, and the motion IS the product, so the clip is the strongest asset on
    the page and it was sitting behind a thumbnail click. The <video> below
    already autoplays whenever it is the active item, so selecting it initially
    is the whole change; browsing is untouched.

    Lazy initialiser, so the search runs once on mount rather than on every
    render. If a product has no video this is 0, exactly as before.
  */
  const [activeIndex, setActiveIndex] = useState(() => {
    const firstVideo = items.findIndex((m) => m?.__typename === 'Video');
    return firstVideo === -1 ? 0 : firstVideo;
  });
  const active = items[activeIndex];

  if (!items.length) {
    return <div className="product-gallery-main product-gallery-empty" />;
  }

  const goTo = (index) => {
    setActiveIndex((index + items.length) % items.length);
  };

  return (
    <div className="product-gallery">
      <div className="product-gallery-thumbs">
        {items.map((item, index) => (
          <button
            key={item.id ?? index}
            type="button"
            className={`product-gallery-thumb${
              index === activeIndex ? ' active' : ''
            }`}
            onClick={() => setActiveIndex(index)}
            aria-label={thumbLabel(productName, item, index, items.length)}
          >
            {/*
              alt="" is correct HERE and only here: the <button> around this
              image already carries the full description in aria-label, so a
              non-empty alt would make a screen reader read the same thing
              twice. The SEO-relevant alt is on the main image below.
            */}
            <img
              src={
                item.__typename === 'Video'
                  ? item.previewImage?.url
                  : item.image?.url
              }
              alt=""
              aria-hidden="true"
              loading="lazy"
            />
            {item.__typename === 'Video' && (
              <span className="product-gallery-play" aria-hidden="true">
                ▶
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="product-gallery-main">
        {items.length > 1 && (
          <button
            type="button"
            className="product-gallery-arrow prev"
            onClick={() => goTo(activeIndex - 1)}
            aria-label="Previous media"
          >
            ‹
          </button>
        )}

        {active?.__typename === 'Video' ? (
          <video
            key={active.id}
            controls
            autoPlay
            loop
            muted
            playsInline
            poster={active.previewImage?.url}
            className="product-gallery-video"
          >
            {active.sources?.map((source) => (
              <source
                key={source.url}
                src={source.url}
                type={source.mimeType}
              />
            ))}
          </video>
        ) : active?.image ? (
          // No aspectRatio prop here on purpose: Hydrogen's <Image> adds a
          // `crop=center` param to Shopify's CDN URL whenever aspectRatio is
          // set, which force-crops non-square source art (most of this
          // catalog's images are landscape, not 1:1) and chops off content.
          // The container below handles square framing via object-fit:
          // contain instead, so nothing gets cropped.
          <ResponsiveImage
            data={active.image}
            alt={mainAlt(productName, active, activeIndex, items.length)}
            sizes="(min-width: 45em) 50vw, 100vw"
            /* The PDP's largest above the fold image, so it is the likely LCP
               on a product page: eager and high priority rather than lazy. */
            loading="eager"
            fetchPriority="high"
            widths={[400, 600, 800, 1200]}
            fallbackWidth={800}
          />
        ) : null}

        {items.length > 1 && (
          <button
            type="button"
            className="product-gallery-arrow next"
            onClick={() => goTo(activeIndex + 1)}
            aria-label="Next media"
          >
            ›
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * What the thumbnail BUTTON announces. "View media 3" told a screen reader
 * user nothing about what they were about to select.
 *
 * @param {string} productName
 * @param {any} item
 * @param {number} index
 * @param {number} total
 * @returns {string}
 */
function thumbLabel(productName, item, index, total) {
  const name = productName || 'this widget';
  if (item?.__typename === 'Video') return `Play the ${name} demo video`;
  return `View ${name}, image ${index + 1} of ${total}`;
}

/**
 * Alt text for the large image. Prefers whatever Shopify holds, because a
 * human-written alt in Admin beats anything generated here, and falls back to
 * a description built from the product's own title plus the image's position.
 *
 * The position matters: stamping the same title on all nine images of a
 * product is its own SEO finding, not a fix for one. Image 1 is the product
 * shot; the rest are explicitly numbered previews.
 *
 * @param {string} productName
 * @param {any} item
 * @param {number} index
 * @param {number} total
 * @returns {string}
 */
function mainAlt(productName, item, index, total) {
  const given = item?.image?.altText?.trim();
  if (given) return given;
  const name = productName || 'Stream widget';
  if (index === 0) return name;
  return `${name}, preview ${index + 1} of ${total}`;
}
