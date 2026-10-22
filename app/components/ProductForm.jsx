import {Link, useNavigate} from 'react-router';
import {AddToCartButton} from './AddToCartButton';
import {BuyNowButton} from './BuyNowButton';
import {useAside} from './Aside';
import {ProductPrice} from './ProductPrice';
import {compareAtIsValueSum} from '~/lib/price';

/**
 * @param {{
 *   productOptions: MappedProductOptions[];
 *   selectedVariant: ProductFragment['selectedOrFirstAvailableVariant'];
 *   product: {id: string; title: string; handle: string; productType?: string};
 *   buttonRef?: {current: HTMLButtonElement | null};
 * }}
 */
export function ProductForm({
  productOptions,
  selectedVariant,
  product,
  buttonRef,
}) {
  const available = Boolean(selectedVariant?.availableForSale);
  const navigate = useNavigate();
  const {open} = useAside();
  return (
    <div className="product-form">
      {productOptions.map((option) => {
        // If there is only a single value in the option values, don't display the option
        if (option.optionValues.length === 1) return null;

        return (
          <div className="product-options" key={option.name}>
            <h5>{option.name}</h5>
            <div className="product-options-grid">
              {option.optionValues.map((value) => {
                const {
                  name,
                  handle,
                  variantUriQuery,
                  selected,
                  available,
                  exists,
                  isDifferentProduct,
                  swatch,
                } = value;

                if (isDifferentProduct) {
                  // SEO
                  // When the variant is a combined listing child product
                  // that leads to a different url, we need to render it
                  // as an anchor tag
                  return (
                    <Link
                      className="product-options-item"
                      key={option.name + name}
                      prefetch="intent"
                      preventScrollReset
                      replace
                      to={`/products/${handle}?${variantUriQuery}`}
                      style={{
                        border: selected
                          ? '1px solid black'
                          : '1px solid transparent',
                        opacity: available ? 1 : 0.3,
                      }}
                    >
                      <ProductOptionSwatch swatch={swatch} name={name} />
                    </Link>
                  );
                } else {
                  // SEO
                  // When the variant is an update to the search param,
                  // render it as a button with javascript navigating to
                  // the variant so that SEO bots do not index these as
                  // duplicated links
                  return (
                    <button
                      type="button"
                      className={`product-options-item${exists && !selected ? ' link' : ''}`}
                      key={option.name + name}
                      style={{
                        border: selected
                          ? '1px solid black'
                          : '1px solid transparent',
                        opacity: available ? 1 : 0.3,
                      }}
                      disabled={!exists}
                      onClick={() => {
                        if (!selected) {
                          void navigate(`?${variantUriQuery}`, {
                            replace: true,
                            preventScrollReset: true,
                          });
                        }
                      }}
                    >
                      <ProductOptionSwatch swatch={swatch} name={name} />
                    </button>
                  );
                }
              })}
            </div>
            <br />
          </div>
        );
      })}
      {/* Buy now is the primary action, Add to cart the secondary one. On
          phones this row is the fixed bar at the bottom of the screen (see
          .product-buy-actions in app.css), and it also carries the price of
          the selected variant so price and both buttons are on screen
          without scrolling. That price is hidden on desktop, where the buy
          box already shows it. Sold out shows only the disabled Add to cart,
          as before. */}
      <div className="product-buy-actions">
        <div className="product-buy-actions-price" aria-hidden="true">
          <ProductPrice
            price={selectedVariant?.price}
            compareAtPrice={selectedVariant?.compareAtPrice}
            compareAtIsValue={compareAtIsValueSum(product.productType)}
          />
        </div>
        {available ? (
          <BuyNowButton selectedVariant={selectedVariant} product={product} />
        ) : null}
        <AddToCartButton
          buttonRef={buttonRef}
          disabled={!available}
          variant={available ? 'ghost' : 'primary'}
          onClick={() => {
            open('cart');
          }}
          lines={
            selectedVariant
              ? [
                  {
                    merchandiseId: selectedVariant.id,
                    quantity: 1,
                    selectedVariant,
                  },
                ]
              : []
          }
        >
          {available ? 'Add to cart' : 'Sold out'}
        </AddToCartButton>
      </div>
    </div>
  );
}

/**
 * @param {{
 *   swatch?: Maybe<ProductOptionValueSwatch> | undefined;
 *   name: string;
 * }}
 */
function ProductOptionSwatch({swatch, name}) {
  const image = swatch?.image?.previewImage?.url;
  const color = swatch?.color;

  if (!image && !color) return name;

  return (
    <div
      aria-label={name}
      className="product-option-label-swatch"
      style={{
        backgroundColor: color || 'transparent',
      }}
    >
      {!!image && <img src={image} alt={name} />}
    </div>
  );
}

/** @typedef {import('@shopify/hydrogen').MappedProductOptions} MappedProductOptions */
/** @typedef {import('@shopify/hydrogen/storefront-api-types').Maybe} Maybe */
/** @typedef {import('@shopify/hydrogen/storefront-api-types').ProductOptionValueSwatch} ProductOptionValueSwatch */
/** @typedef {import('storefrontapi.generated').ProductFragment} ProductFragment */
