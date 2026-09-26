import {useRef, useState} from 'react';
import {ResponsiveImage} from '~/components/ResponsiveImage';
import {Link} from 'react-router';
import {Money, useAnalytics} from '@shopify/hydrogen';
import {useVariantUrl} from '~/lib/variants';
import {parseWorksWith, isMultistream} from '~/lib/platforms';
import {PlatformIcon} from '~/components/PlatformIcon';
import {findVideoMedia, pickBestMp4Source} from '~/lib/video';
import {hasRealDiscount} from '~/lib/price';

/**
 * True on devices that support a real `:hover` (mouse/trackpad). Touch
 * devices report `hover: none` even if a mouseenter event ever sneaks
 * through, so gate playback on this rather than trusting the event alone
 * -- the point is no autoplay on tap, not just no stuck hover state.
 */
function canHover() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(hover: hover)').matches
  );
}

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * The card's "Chat" or "Goal" badge.
 *
 * Prefer `productType`, which the category pass set deliberately on every
 * active product and which the smart collections are built on. The old
 * title-only test read "goal" before "chat", so every combo listing (there
 * are many named "Chat and Goal Widget") was badged Goal even when it sits
 * in the Chat Widget collection. CLAUDE.md flags exactly this trap.
 *
 * Title text stays as the fallback for the handful of products that have no
 * productType set, and there "chat" wins first: a combo listing is the
 * common case and reads as a chat widget with a goal bar included.
 * @param {string} title
 * @param {string} [productType]
 */
function widgetKind(title, productType) {
  const type = (productType || '').toLowerCase();
  if (type.includes('chat')) return 'Chat';
  if (type.includes('goal')) return 'Goal';
  if (type) return null;
  if (/chat/i.test(title)) return 'Chat';
  if (/goal/i.test(title)) return 'Goal';
  return null;
}

/**
 * Publishes a `custom_select_item` event on the Hydrogen analytics bus so
 * PixelBus.jsx (via app/lib/analytics/events.js) can map it to
 * `select_item`, joining it back to whichever `view_item_list` the card
 * was shown in. `listId`/`listName` are only
 * passed by callers that also fire a matching `view_item_list` (collection
 * pages); other callers (home, search) still pass a stable list label so
 * the click is attributable even without a paired list view.
 * @param {{
 *   publish: ReturnType<typeof useAnalytics>['publish'];
 *   product: CollectionItemFragment | ProductItemFragment | RecommendedProductFragment;
 *   listId?: string;
 *   listName?: string;
 *   index?: number;
 * }}
 */
function publishSelectItem({publish, product, listId, listName, index}) {
  publish('custom_select_item', {
    product: {
      id: product.id,
      title: product.title,
      price: product.priceRange?.minVariantPrice?.amount,
      productType: product.productType,
    },
    listId,
    listName,
    index,
  });
}

/**
 * @param {{
 *   product:
 *     | CollectionItemFragment
 *     | ProductItemFragment
 *     | RecommendedProductFragment;
 *   loading?: 'eager' | 'lazy';
 *   listId?: string;
 *   listName?: string;
 *   index?: number;
 * }}
 */
/**
 * Below this many units the proof line is hidden. A low number is worse than
 * no number: it tells a shopper the thing does not sell.
 */
const SOLD_PROOF_FLOOR = 10;

export function ProductItem({
  product,
  loading,
  listId,
  listName,
  index,
  headingLevel = 2,
  badge,
}) {
  const variantUrl = useVariantUrl(product.handle);
  const image = product.featuredImage;
  const kind = widgetKind(product.title, product.productType);
  // Card chips come from the `custom.works_with` metafield, the same single
  // source the PDP badge row uses, never from the title. Reading the title
  // gave a card a Twitch chip for saying "for Twitch" and a YouTube chip for
  // an SEO keyword the widget does not support, which is the error Todd found
  // on the Potion Bottle PDP on 2026-09-14 (see ProductHighlights.jsx). A
  // product with no metafield shows no chips, which is the honest default.
  const platforms = (parseWorksWith(product.worksWith?.value ?? product.worksWith) || []).slice(0, 4);
  const multistream = isMultistream(product);
  const {publish} = useAnalytics();

  // Product-level compareAt, aligned to the same minVariantPrice the card
  // already shows. Missing or non-discounting compareAtPrice never renders
  // -- see app/lib/price.js.
  const compareAtPrice = product.compareAtPriceRange?.minVariantPrice;
  const onSale = hasRealDiscount(product.priceRange?.minVariantPrice, compareAtPrice);

  const videoMedia = findVideoMedia(product.media?.nodes);
  const videoSource = videoMedia && pickBestMp4Source(videoMedia.sources);
  const videoRef = useRef(null);
  // True between mouseenter/focus and the matching leave/blur. A preview can
  // only start once the file has data, which arrives after the pointer may
  // already have gone, so the late start has to check this before playing.
  const wantsPreviewRef = useRef(false);
  const [videoActive, setVideoActive] = useState(false);

  function playPreview() {
    if (!videoSource || prefersReducedMotion()) return;
    wantsPreviewRef.current = true;
    setVideoActive(true);
    const el = videoRef.current;
    if (!el) return;

    // First hover on this card: promote `data-src` to `src`. See the element
    // below for why the URL is not in the markup. Nothing is fetched by the
    // assignment alone, because `preload="none"` still applies; the `el.load()`
    // at the bottom is what asks for bytes, exactly as before.
    if (!el.getAttribute('src') && el.dataset.src) {
      el.setAttribute('src', el.dataset.src);
    }

    // The preview never actually played before this. These elements carry
    // `preload="none"`, so on the first hover there is no data at all: the
    // seek is a no-op, `.play()` rejects, and the old `.catch(() => {})`
    // swallowed it with nothing to retry. The card sat on a frozen first
    // frame, which on a letterboxed clip reads as a broken image rather than
    // a still. Measured 2026-09-14: `is-active` set, opacity 1,
    // readyState 4, and `paused: true`; calling `.play()` by hand from the
    // console started it immediately.
    const start = () => {
      // The pointer may have left while the file was loading.
      if (!wantsPreviewRef.current || !el.isConnected) return;
      try {
        el.currentTime = 0;
      } catch {
        // Seeking before metadata exists throws in some browsers. Harmless:
        // a fresh element is already at 0.
      }
      // Still rejects for ordinary reasons (a fast leave, a backgrounded
      // tab). A grid of tiles is not the place for an unhandled rejection.
      el.play()?.catch(() => {});
    };

    // HAVE_CURRENT_DATA or better means it can start now.
    if (el.readyState >= 2) {
      start();
      return;
    }
    el.addEventListener('loadeddata', start, {once: true});
    // `preload="none"` means nothing has been requested yet, so ask.
    el.load();
  }

  function stopPreview() {
    wantsPreviewRef.current = false;
    setVideoActive(false);
    const el = videoRef.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
  }

  function handleMouseEnter() {
    if (!canHover()) return;
    playPreview();
  }

  function handleMouseLeave() {
    if (!canHover()) return;
    stopPreview();
  }

  // Keyboard focus should trigger the preview too ("not mouse only"), but a
  // touch tap also moves focus to a link right before it navigates, and a
  // touch device has no hover -- gating on canHover() here as well is what
  // keeps a tap on a phone from ever kicking off playback, while a real
  // keyboard on an ordinary mouse-equipped desktop still works.
  function handleFocus() {
    if (!canHover()) return;
    playPreview();
  }

  function handleBlur() {
    if (!canHover()) return;
    stopPreview();
  }

  return (
    <Link
      className="product-item"
      key={product.id}
      prefetch="intent"
      title={product.title}
      to={variantUrl}
      onClick={() =>
        publishSelectItem({publish, product, listId, listName, index})
      }
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {image && (
        // No aspectRatio prop: it makes Hydrogen add `crop=center` to the
        // CDN URL, which force-crops this catalog's mostly-non-square
        // source art. The wrapper handles square framing via object-fit:
        // contain instead, so the full image stays visible.
        <div className="product-item-image">
          {kind && <span className={`product-item-tag tag-${kind.toLowerCase()}`}>{kind}</span>}
          {/* The label used to read "reads chat from more than one platform",
              which was false on every goal widget wearing it: a goal widget
              counts tips and subs through StreamElements and reads no chat
              anywhere. Multistream here means the product WORKS on all three
              (Todd, 2026-09-22), so the label says that instead. */}
          {multistream && (
            <span
              className="product-item-ribbon"
              role="img"
              aria-label="Multistream: works on Twitch, YouTube and Kick"
            >
              <span className="product-item-ribbon-star" aria-hidden="true">
                ✦
              </span>
              Multistream
            </span>
          )}
          {/* Bottom-left, the one corner the kind tag (top-left) and the
              multistream ribbon (top-right) don't use. Only "New arrivals"
              passes this. */}
          {badge && <span className="product-item-new-badge">{badge}</span>}
          <ResponsiveImage
            alt={image.altText || product.title}
            data={image}
            loading={loading}
            /* Cards render 404px wide on desktop and 296px on a 360px phone,
               so asking for 100vw made the browser pick a 1280px candidate for
               a 296px box. */
            sizes="(min-width: 45em) 400px, 90vw"
            widths={[300, 400, 600, 800]}
            fallbackWidth={400}
          />
          {videoSource && (
            <video
              ref={videoRef}
              className={`product-item-video${videoActive ? ' is-active' : ''}`}
              /*
                The URL is in `data-src`, NOT `src`, and playPreview() copies it
                across on the first hover. This is the whole fix for Search
                Console's "Video isn't on a watch page", which covered 66 of the
                113 videos in `/sitemap/video/1.xml` on 2026-09-21.
                A crawlable `src` here put every product clip on collection,
                search, home and blog cross-sell pages, none of which are watch
                pages: the clip is decorative, aria-hidden and preload="none",
                and the product is not what the page is about. Google then
                indexed the file against the page it first saw it on rather than
                against the PDP the video sitemap nominates. `preload="none"`
                does not help, because the attribute is in the served HTML
                whether or not a byte is ever fetched. Googlebot renders JS but
                does not hover, so moving the assignment into the hover handler
                removes the file from those pages entirely while the visitor
                sees no change at all.
                The one watch page is the PDP, and ProductGallery.jsx keeps its
                real `src` for exactly that reason. Do not "tidy" this back.
              */
              data-src={videoSource.url}
              poster={videoMedia.previewImage?.url}
              muted
              loop
              playsInline
              preload="none"
              tabIndex={-1}
              aria-hidden="true"
            />
          )}
        </div>
      )}
      {/*
        The card's heading level depends on what encloses it, so it is a prop
        rather than a fixed tag. A collection page puts these straight under
        its <h1>, so 2 is right there; the homepage "Top widgets" grid and the
        PDP "More widgets" row both sit under an <h2>, so they pass 3.

        Lighthouse flagged this on the live homepage: a hardcoded <h4> under an
        <h2> skips a level, which is how a screen reader user loses the outline.
        Styling moved to `.product-item-title` so the level can vary without
        the card changing size.
      */}
      <CardHeading level={headingLevel} className="product-item-title">
        {product.title}
      </CardHeading>
      {/* Real units, real window, or nothing. Shown only above a floor because
          "3 sold" reads as nobody buys this, which is the opposite of proof,
          and a card that stays silent is never wrong. */}
      {product.soldUnits >= SOLD_PROOF_FLOOR && product.soldWindowDays ? (
        <p className="product-item-sold">
          <strong>{product.soldUnits}</strong> sold in {product.soldWindowDays}{' '}
          days
        </p>
      ) : null}
      <div className="product-item-footer">
        <span className="product-item-price-pill">
          {onSale && (
            <s className="product-item-compare-price">
              <span className="sr-only">Regular price </span>
              <Money data={compareAtPrice} />
            </s>
          )}
          <span className="sr-only">{onSale ? 'Sale price ' : 'Price '}</span>
          <Money data={product.priceRange.minVariantPrice} />
        </span>
        {platforms.length > 0 && (
          <span className="product-item-platforms">
            {platforms.map((platform) => (
              <PlatformIcon key={platform} platform={platform} />
            ))}
          </span>
        )}
      </div>
    </Link>
  );
}

/**
 * Renders h2 to h6 so a product card can sit at the right depth in whatever
 * section encloses it. Clamped, because a level outside that range would
 * produce an invalid tag.
 * @param {{level: number; className?: string; children: React.ReactNode}}
 */
function CardHeading({level, className, children}) {
  const Tag = `h${Math.min(6, Math.max(2, level))}`;
  return <Tag className={className}>{children}</Tag>;
}

/** @typedef {import('storefrontapi.generated').ProductItemFragment} ProductItemFragment */
/** @typedef {import('storefrontapi.generated').CollectionItemFragment} CollectionItemFragment */
/** @typedef {import('storefrontapi.generated').RecommendedProductFragment} RecommendedProductFragment */
