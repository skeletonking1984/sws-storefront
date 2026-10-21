import {CartForm} from '@shopify/hydrogen';
import {useFetcher} from 'react-router';

/**
 * Hydrogen's `CartForm`, plus the declarative WebMCP attributes.
 *
 * Why this exists rather than passing the attributes to `CartForm`:
 * `CartForm` destructures exactly {children, action, inputs, route,
 * fetcherKey} and renders `<fetcher.Form action={route} method="post">`. It
 * does not spread the rest, so a `toolname` handed to it is **silently
 * dropped** and the markup looks unchanged. Checked in
 * node_modules/@shopify/hydrogen/dist/development/index.cjs.
 *
 * So this reproduces what CartForm does, using its own public constants
 * (`CartForm.INPUT_NAME` and `CartForm.ACTIONS`) rather than re-deriving the
 * payload shape, and adds the attributes to the real <form>. The rendered
 * markup is intended to be identical to CartForm's apart from those
 * attributes, which is exactly what was diffed to verify it.
 *
 * Setting the attributes from JavaScript after mount would also turn the
 * Lighthouse audit green, and was deliberately not done: the whole point of
 * the declarative API is that an agent can read a form's purpose with no
 * script running.
 *
 * @param {{
 *   children: React.ReactNode | ((fetcher: any) => React.ReactNode);
 *   action?: string;
 *   inputs?: Record<string, unknown>;
 *   route?: string;
 *   fetcherKey?: string;
 *   toolname: string;
 *   tooldescription: string;
 * }}
 */
export function AnnotatedCartForm({
  children,
  action,
  inputs,
  route,
  fetcherKey,
  toolname,
  tooldescription,
}) {
  const fetcher = useFetcher({key: fetcherKey});

  return (
    <fetcher.Form
      action={route || ''}
      method="post"
      toolname={toolname}
      tooldescription={tooldescription}
    >
      {(action || inputs) && (
        <input
          type="hidden"
          name={CartForm.INPUT_NAME}
          value={JSON.stringify({action, inputs})}
        />
      )}
      {typeof children === 'function' ? children(fetcher) : children}
    </fetcher.Form>
  );
}
