import {Link} from 'react-router';
import {Image, Money, useAnalytics} from '@shopify/hydrogen';
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
 * Publishes a `custom_select_item` event on the Hydrogen analytics bus so
 * GA4.jsx can map it to GA4's `select_item`, joining it back to whichever
 * `view_item_list` the card was shown in. `listId`/`listName` are only
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
export function ProductItem({product, loading, listId, listName, index}) {
  const variantUrl = useVariantUrl(product.handle);
  const image = product.featuredImage;
  const kind = widgetKind(product.title, product.productType);
  const platforms = detectPlatforms(product.title).slice(0, 4);
  const {publish} = useAnalytics();
  return (
    <Link
      className="product-item"
      key={product.id}
      prefetch="intent"
      to={variantUrl}
      onClick={() =>
        publishSelectItem({publish, product, listId, listName, index})
      }
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
