import {Link} from 'react-router';
import {Image, Money} from '@shopify/hydrogen';
import {useVariantUrl} from '~/lib/variants';
import {detectPlatforms} from '~/lib/platforms';
import {PlatformIcon} from '~/components/PlatformIcon';

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
 * @param {{
 *   product:
 *     | CollectionItemFragment
 *     | ProductItemFragment
 *     | RecommendedProductFragment;
 *   loading?: 'eager' | 'lazy';
 * }}
 */
export function ProductItem({product, loading}) {
  const variantUrl = useVariantUrl(product.handle);
  const image = product.featuredImage;
  const kind = widgetKind(product.title, product.productType);
  const platforms = detectPlatforms(product.title).slice(0, 4);
  return (
    <Link
      className="product-item"
      key={product.id}
      prefetch="intent"
      to={variantUrl}
    >
      {image && (
        // No aspectRatio prop: it makes Hydrogen add `crop=center` to the
        // CDN URL, which force-crops this catalog's mostly-non-square
        // source art. The wrapper handles square framing via object-fit:
        // contain instead, so the full image stays visible.
        <div className="product-item-image">
          {kind && <span className={`product-item-tag tag-${kind.toLowerCase()}`}>{kind}</span>}
          <Image
            alt={image.altText || product.title}
            data={image}
            loading={loading}
            sizes="(min-width: 45em) 400px, 100vw"
          />
        </div>
      )}
      <h4>{product.title}</h4>
      <div className="product-item-footer">
        <span className="product-item-price-pill">
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

/** @typedef {import('storefrontapi.generated').ProductItemFragment} ProductItemFragment */
/** @typedef {import('storefrontapi.generated').CollectionItemFragment} CollectionItemFragment */
/** @typedef {import('storefrontapi.generated').RecommendedProductFragment} RecommendedProductFragment */
