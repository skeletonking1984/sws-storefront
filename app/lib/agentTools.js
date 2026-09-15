/**
 * The WebMCP tool definitions, kept out of the React component so they can be
 * exercised without a browser or a DOM.
 *
 * Shape is fixed by the W3C Community Group WebMCP proposal: each tool is
 * {name, description, inputSchema, execute}, and `execute` resolves to
 * {content: [{type: 'text', text}]}.
 * https://webmachinelearning.github.io/webmcp/docs/proposal.html
 *
 * Both dependencies are injected rather than reached for, so a test can drive
 * these with a stub catalog and assert the contract:
 *   getJson(params)  -> the /api/agent response for those query params
 *   openCart()       -> show the shopper their cart
 *
 * @param {{getJson: (params: Record<string, unknown>) => Promise<any>, openCart: () => void, addToCart: (variantId: string, quantity: number) => Promise<boolean>}}
 */
export function createAgentTools({getJson, openCart, addToCart}) {
  const text = (value) => ({
    content: [
      {
        type: 'text',
        text: typeof value === 'string' ? value : JSON.stringify(value),
      },
    ],
  });

  const tools = [
    {
      name: 'search_widgets',
      description:
        'Search Stream Widget Shop for animated chat widgets, goal widgets, overlay packs and bundles. ' +
        'Returns the price, the streaming platforms each one genuinely supports, and a link. ' +
        'Use the platform filter rather than reading platform names out of a product title: titles are ' +
        'search keywords and frequently name platforms the widget does not actually support.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'What the shopper is looking for, e.g. "neon chat", "moon goal", "sakura".',
          },
          platform: {
            type: 'string',
            description:
              'Only return widgets that genuinely support this platform. One of Twitch, YouTube, Kick, OBS, StreamElements, Streamlabs.',
          },
          type: {
            type: 'string',
            description:
              'Narrow to one kind of product: "Chat Widget", "Goal Widget", "Overlay Pack" or "Bundle".',
          },
          limit: {
            type: 'number',
            description: 'How many results to return, 1 to 12. Defaults to 6.',
          },
        },
      },
      async execute(input) {
        const data = await getJson({
          op: 'search',
          q: input?.query,
          platform: input?.platform,
          type: input?.type,
          limit: input?.limit,
        });
        if (!data.results?.length) {
          return text(
            `No widgets matched${input?.platform ? ` for ${input.platform}` : ''}. Try a broader search term or drop the platform filter.`,
          );
        }
        return text(data);
      },
    },
    {
      name: 'get_widget_details',
      description:
        'Full detail for one widget by its handle: price, the platforms it supports, what the buyer receives, and whether it is in stock. ' +
        'Handles come from search_widgets or from a /products/<handle> URL.',
      inputSchema: {
        type: 'object',
        properties: {
          handle: {
            type: 'string',
            description:
              'The product handle, the last path segment of its /products/ URL.',
          },
        },
        required: ['handle'],
      },
      async execute(input) {
        if (!input?.handle) return text('A handle is required.');
        return text(await getJson({op: 'details', handle: input.handle}));
      },
    },
    {
      name: 'add_to_cart',
      description:
        'Add a widget to the shopping cart and open the cart drawer so the shopper can review it. ' +
        'Takes the variantId from search_widgets or get_widget_details. ' +
        'This only fills the cart: it never completes a purchase, and the shopper still has to go through checkout themselves.',
      inputSchema: {
        type: 'object',
        properties: {
          variantId: {
            type: 'string',
            description:
              'The variantId returned by search_widgets or get_widget_details.',
          },
          quantity: {
            type: 'number',
            description: 'How many to add. Defaults to 1.',
          },
        },
        required: ['variantId'],
      },
      async execute(input) {
        if (!input?.variantId) return text('A variantId is required.');
        const quantity = Math.max(1, Math.min(10, Number(input.quantity) || 1));

        // Goes through the app's own /cart action, the same route the Add to
        // cart button posts to, so an agent gets exactly the validation and
        // the side effects a shopper does and nothing bypasses the cart.
        const ok = await addToCart(input.variantId, quantity);
        if (!ok) return text('Could not add that to the cart.');

        // Show the shopper what just happened to their cart. An agent acting
        // silently on someone's basket is exactly the thing that makes this
        // API feel like something being done TO you.
        openCart();
        return text(
          `Added ${quantity} to the cart and opened the cart drawer. The shopper completes checkout themselves.`,
        );
      },
    },
  ];
  return tools;
}
