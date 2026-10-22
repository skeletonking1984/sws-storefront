/**
 * "What's included" and "Setup in 3 steps", right under the buy card.
 *
 * Why, 2026-10-22: the two questions a buyer of a digital widget asks before
 * paying are "what file do I actually get" and "can I install it". The page
 * answered both, but only inside the long description, below the fold on a
 * phone, in a different wording on every product. These two blocks put the
 * answer in the same place and the same shape on every PDP.
 *
 * Every line is generated from a checked source, never from title text:
 * - files: app/data/product-delivery.json (the real Etsy file manifest, via
 *   scripts/build-delivery-facts.mjs), the same facts the answer block uses.
 *   A product with no proven manifest says "the widget files" and names no
 *   count or format.
 * - platforms and host: the `custom.works_with` metafield, the only allowed
 *   source of a platform claim (see ProductHighlights.jsx).
 * - delivery: /policies/refund-policy "Getting your files".
 *
 * @param {{
 *   delivery?: {archives?: number, setupDoc?: string | null} | null,
 *   platforms?: string[] | null,
 *   productType?: string | null,
 *   noAccount?: boolean,
 * }} props
 */
export function ProductIncluded({
  delivery,
  platforms,
  productType,
  noAccount = false,
}) {
  const list = Array.isArray(platforms) ? platforms : [];
  const archives = delivery?.archives || 0;
  const doc = delivery?.setupDoc || null;
  const contents = productType === 'Emotes' ? 'emote files' : 'widget files';

  const included = [];
  if (archives > 0) {
    included.push(
      archives === 1
        ? `1 ZIP of ${contents}`
        : `${archives} ZIPs of ${contents}`,
    );
  } else {
    included.push(`The ${contents}, delivered as a download`);
  }
  if (doc) included.push(`${doc} setup guide`);
  included.push('Setup help by email if you get stuck');

  const host = noAccount
    ? null
    : list.includes('StreamElements')
      ? list.includes('Streamlabs')
        ? 'StreamElements or Streamlabs'
        : 'StreamElements'
      : list.includes('Streamlabs')
        ? 'Streamlabs'
        : null;

  const install = host
    ? `Import it into your free ${host} account${doc ? `, step by step in the ${doc} guide` : ''}.`
    : noAccount && list.includes('OBS')
      ? 'Add it to OBS as a browser source. No account needed.'
      : doc
        ? `Follow the ${doc} setup guide in the download.`
        : 'Follow the setup steps in the description below.';

  const destinations = ['Twitch', 'YouTube', 'Kick', 'TikTok'].filter((p) =>
    list.includes(p),
  );
  const golive = destinations.length
    ? `Add it to your scene and go live on ${joinOr(destinations)}.`
    : 'Add it to your scene and go live.';

  const steps = [
    'Check out. The download link is in your order email and on your account order page.',
    install,
    golive,
  ];

  return (
    <section
      className="product-included"
      aria-label="What's included and setup"
    >
      <div className="product-included-col">
        <h2 className="product-included-heading">What&rsquo;s included</h2>
        <ul className="product-included-list">
          {included.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
      <div className="product-included-col">
        <h2 className="product-included-heading">Setup in 3 steps</h2>
        <ol className="product-included-steps">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** "Twitch, YouTube or Kick", no Oxford comma, same as the answer block. */
function joinOr(items) {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`;
}
