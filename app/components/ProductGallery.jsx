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
          <Image
            data={active.image}
            alt={active.image.altText || ''}
            sizes="(min-width: 45em) 50vw, 100vw"
            aspectRatio="1/1"
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
