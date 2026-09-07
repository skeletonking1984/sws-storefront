import {Link} from 'react-router';
import {Image, Money} from '@shopify/hydrogen';
import {useVariantUrl} from '~/lib/variants';
import {detectPlatforms} from '~/lib/platforms';
import {PlatformIcon} from '~/components/PlatformIcon';

/**
 * A product is tagged "Chat" or "Goal" here purely from its title text —
 * the same signal CLAUDE.md documents as more reliable than the product
 * tags themselves for this catalog.
 * @param {string} title
 */
function widgetKind(title) {
  if (/goal/i.test(title)) return 'Goal';
  if (/chat/i.test(title)) return 'Chat';
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
  const kind = widgetKind(product.title);
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
