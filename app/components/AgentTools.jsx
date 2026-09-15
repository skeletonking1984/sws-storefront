import {CartForm} from '@shopify/hydrogen';
import {useEffect, useRef} from 'react';
import {useAside} from '~/components/Aside';
import {createAgentTools} from '~/lib/agentTools';

/**
 * WebMCP tool registration: hands an AI agent real, typed functions instead of
 * making it infer the shop from screenshots and DOM guesses.
 *
 * Spec: the W3C Community Group WebMCP proposal, `navigator.modelContext`
 * (https://webmachinelearning.github.io/webmcp/docs/proposal.html). A tool is
 * {name, description, inputSchema, execute}; `execute(input, agent)` resolves
 * to {content: [{type: 'text', text}]}. `provideContext()` and `clearContext()`
 * were removed in the March 2026 revision, so registerTool / unregisterTool
 * are the only entry points and this file must not reintroduce the old shape.
 *
 * Feature detected and completely inert where the API does not exist, which is
 * every browser that has not enabled it. Nothing here runs during SSR.
 *
 * The tool definitions themselves live in app/lib/agentTools.js so they can be
 * exercised without a browser; this component only supplies the three things
 * they need from the running page and manages the registration lifecycle.
 *
 * Why this shop is worth exposing this way: the one question a widget buyer
 * actually has is "does this work with what I stream on", and this catalog is
 * the rare one that can answer it honestly, because `custom.works_with` is
 * ground truthed per product against its own Etsy listing. Titles here are
 * Etsy keyword titles that name platforms the widget does not support, so the
 * search tool filters on the metafield and the tool descriptions say so, to
 * steer an agent away from re-deriving a platform claim from a title.
 */
export function AgentTools() {
  const {open} = useAside();
  // Tools are registered once and outlive any given render, so anything they
  // close over has to come through a ref or it goes stale.
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    if (typeof navigator === 'undefined') return undefined;
    const ctx = navigator.modelContext;
    if (!ctx || typeof ctx.registerTool !== 'function') return undefined;

    const tools = createAgentTools({
      async getJson(params) {
        const search = new URLSearchParams(
          Object.entries(params).filter(
            ([, v]) => v !== undefined && v !== null && v !== '',
          ),
        );
        const res = await fetch(`/api/agent?${search}`, {
          headers: {Accept: 'application/json'},
        });
        if (!res.ok) throw new Error(`Catalog lookup failed (${res.status})`);
        return res.json();
      },

      openCart() {
        openRef.current('cart');
      },

      async addToCart(variantId, quantity) {
        const body = new FormData();
        body.append(
          'cartFormInput',
          JSON.stringify({
            action: CartForm.ACTIONS.LinesAdd,
            inputs: {lines: [{merchandiseId: variantId, quantity}]},
          }),
        );
        const res = await fetch('/cart', {method: 'POST', body});
        return res.ok;
      },
    });

    const registered = [];
    for (const tool of tools) {
      try {
        ctx.registerTool(tool);
        registered.push(tool.name);
      } catch (error) {
        // registerTool throws when the name is already taken. A duplicate is
        // not worth breaking the page over, and swallowing it silently would
        // hide a real collision, so report it and let the rest register.
        console.warn(`WebMCP: could not register ${tool.name}`, error);
      }
    }

    return () => {
      if (typeof ctx.unregisterTool !== 'function') return;
      for (const name of registered) {
        try {
          ctx.unregisterTool(name);
        } catch {
          // Already gone, or the page is tearing down. Nothing to do.
        }
      }
    };
  }, []);

  return null;
}
