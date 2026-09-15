import {CartForm} from '@shopify/hydrogen';
import {AnnotatedCartForm} from '~/components/AnnotatedCartForm';

/**
 * @param {{
 *   analytics?: unknown;
 *   children: React.ReactNode;
 *   disabled?: boolean;
 *   lines: Array<OptimisticCartLineInput>;
 *   onClick?: () => void;
 * }}
 */
export function AddToCartButton({
  analytics,
  children,
  disabled,
  lines,
  onClick,
}) {
  return (
    // Declarative WebMCP. This is the buy action on every product page, and
    // it was the one form on a PDP that Lighthouse reported as missing
    // annotations. AnnotatedCartForm exists because CartForm drops unknown
    // props, see that file.
    <AnnotatedCartForm
      route="/cart"
      inputs={{lines}}
      action={CartForm.ACTIONS.LinesAdd}
      toolname="add_widget_to_cart"
      tooldescription="Add this widget to the shopping cart. Fills the cart only, the shopper still completes checkout themselves."
    >
      {(fetcher) => (
        <>
          <input
            name="analytics"
            type="hidden"
            value={JSON.stringify(analytics)}
          />
          <button
            type="submit"
            className="add-to-cart-button sws-btn sws-btn-primary"
            onClick={onClick}
            disabled={disabled ?? fetcher.state !== 'idle'}
          >
            {children}
          </button>
        </>
      )}
    </AnnotatedCartForm>
  );
}

/** @typedef {import('react-router').FetcherWithComponents} FetcherWithComponents */
/** @typedef {import('@shopify/hydrogen').OptimisticCartLineInput} OptimisticCartLineInput */
