import {useState} from 'react';
import {ResponsiveImage} from '~/components/ResponsiveImage';


/**
 * Etsy-style product gallery: thumbnail rail + large main viewer.
 * Supports both images and videos (Shopify Media API).
 * @param {{media: Array<any>}}
 */
export function ProductGallery({media}) {
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
            aria-label={`View media ${index + 1}`}
          >
            <img
              src={
                item.__typename === 'Video'
                  ? item.previewImage?.url
                  : item.image?.url
              }
              alt=""
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
            alt={active.image.altText || ''}
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
