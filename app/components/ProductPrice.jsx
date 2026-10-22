import {Money} from '@shopify/hydrogen';
import {hasRealDiscount} from '~/lib/price';

/**
 * `showSavings` adds "Save $X" beside a real discount. PDP buy box only:
 * the sticky bar and cart lines have no room for it. The figure is the
 * product's own compareAtPrice minus its price, the same two numbers the
 * strikethrough already shows, never an invented "was" price.
 *
 * @param {{
 *   price?: MoneyV2;
 *   compareAtPrice?: MoneyV2 | null;
 *   showSavings?: boolean;
 * }}
 */
export function ProductPrice({price, compareAtPrice, showSavings = false}) {
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
          {showSavings && price ? (
            <span className="product-price-save">
              Save{' '}
              <Money
                data={{
                  amount: (
                    parseFloat(compareAtPrice.amount) - parseFloat(price.amount)
                  ).toFixed(2),
                  currencyCode: price.currencyCode,
                }}
              />
            </span>
          ) : null}
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
