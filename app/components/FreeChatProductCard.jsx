import {Link} from 'react-router';
import {freeChatHeroWebp as heroImage} from '~/lib/cdnAssets';

/**
 * A product-style card for Stream Chat Lite (the free multistream chat
 * widget), for use inside a real `.products-grid`/`.products-grid` row.
 *
 * Deliberately NOT a `ProductItem`: this is not a Shopify product, has no
 * variant, price or handle, and must never be added to cart, never appear
 * in Product JSON-LD, and never appear in the product sitemap. It is
 * rendered directly into a grid alongside real `ProductItem`s (see
 * collections.all.jsx / collections.$handle.jsx), never mixed into the
 * `products.nodes` array those pages hand to pagination, Analytics
 * CollectionView or any Shopify query -- so pagination cursors, product
 * counts and structured data all stay untouched by its presence.
 *
 * `placement` feeds the click's UTM so GA4/order attribution can tell a
 * signup that started on the "chat widgets" collection from one that
 * started in search, per the SWS conversion tracking standard.
 *
 * @param {{headingLevel?: number; placement: string}} props
 */
/**
 * Grid placement switch. Off since 2026-10-05 (request to hide the card):
 * the card no longer leads the collection grids (/collections/*, /collections/all).
 * Search results, the header link and /free-chat-widget itself are unaffected.
 * Flip to true to bring the grid card back.
 */
export const SHOW_FREE_CHAT_GRID_CARD = false;

export function FreeChatProductCard({headingLevel = 2, placement}) {
  const Tag = `h${Math.min(6, Math.max(2, headingLevel))}`;
  const to = `/free-chat-widget?utm_source=stream-chat-lite&utm_medium=free-widget&utm_campaign=${encodeURIComponent(placement)}`;

  return (
    <Link
      className="product-item free-chat-product-card"
      to={to}
      prefetch="intent"
      title="Stream Chat Lite: free multistream chat widget"
    >
      <div className="product-item-image">
        <span className="product-item-tag tag-free">Free</span>
        <img
          src={heroImage}
          alt="Stream Chat Lite multistream chat overlay preview, Twitch and Kick chat merged into one feed"
          loading="lazy"
          width="1024"
          height="1024"
        />
      </div>
      <Tag className="product-item-title">
        Stream Chat Lite: Free Multistream Chat
      </Tag>
      <div className="product-item-footer">
        <span className="product-item-price-pill free-chat-product-card-price">
          Free, forever
        </span>
      </div>
    </Link>
  );
}
