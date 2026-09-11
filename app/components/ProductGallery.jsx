import {useState} from 'react';
import {Image} from '@shopify/hydrogen';

/**
 * Etsy-style product gallery: thumbnail rail + large main viewer.
 * Supports both images and videos (Shopify Media API).
 * @param {{media: Array<any>}}
 */
export function ProductGallery({media}) {
  const items = media?.length ? media : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const active = items[activeIndex];

  if (!items.length) {
    return <div className="product-gallery-main product-gallery-empty" />;
  }

  // Most products import their demo video last, behind every photo, so the
  // default active item (index 0) is almost always an image and the video
  // never lands in the server-rendered HTML: nothing for Google to find
  // before the gallery's client-side state can change it. This finds the
  // video regardless of gallery position so a real <video> with real
  // <source> children is always present in the SSR output, without
  // changing which item is shown first.
  const videoItem = items.find((item) => item.__typename === 'Video');

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
          <Image
            data={active.image}
            alt={active.image.altText || ''}
            sizes="(min-width: 45em) 50vw, 100vw"
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

      {/* Visually hidden, not display:none: a real <video> with real
          <source> children server-rendered for crawlers, distinct from the
          visible player above so playback (autoplay/controls/looping) never
          doubles up. Only rendered when the video isn't already the visible
          active item, since that one already covers this. preload="metadata"
          keeps it free to load: no bytes beyond the container header. */}
      {videoItem && active?.__typename !== 'Video' && (
        <video
          key={`seo-${videoItem.id}`}
          poster={videoItem.previewImage?.url}
          preload="metadata"
          muted
          playsInline
          tabIndex={-1}
          aria-hidden="true"
          className="product-gallery-video-seo"
        >
          {videoItem.sources?.map((source) => (
            <source key={source.url} src={source.url} type={source.mimeType} />
          ))}
        </video>
      )}
    </div>
  );
}
