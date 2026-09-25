import {Money} from '@shopify/hydrogen';
import {hasRealDiscount} from '~/lib/price';

/**
 * @param {{
 *   price?: MoneyV2;
 *   compareAtPrice?: MoneyV2 | null;
 * }}
 */
export function ProductPrice({price, compareAtPrice}) {
  // Only a real discount (compareAtPrice strictly greater than price) is
  // shown struck through. Equal, missing or backwards compareAtPrice values
  // render as a plain price -- see app/lib/price.js.
  const onSale = hasRealDiscount(price, compareAtPrice);
  return (
    <div aria-label="Price" className="product-price" role="group">
      {onSale ? (
        <div className="product-price-on-sale">
          <span className="sr-only">Sale price </span>
          {price ? <Money data={price} /> : null}
          <span className="sr-only">Regular price </span>
          <s>
            <Money data={compareAtPrice} />
          </s>
        </div>
      ) : price ? (
        <Money data={price} />
      ) : (
        <span>&nbsp;</span>
      )}
    </div>
  );
}

/** @typedef {import('@shopify/hydrogen/storefront-api-types').MoneyV2} MoneyV2 */
