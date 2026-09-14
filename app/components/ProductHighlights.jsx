import {parseWorksWith} from '~/lib/platforms';
import {PlatformIcon} from '~/components/PlatformIcon';

/**
 * Etsy-style "Highlights" block: platform badges + scannable digital-good
 * facts, shown between the buy box and the long description.
 *
 * Deliberately takes no `title`. The title used to feed platform detection
 * too, which is how a product called "... for Twitch" earned a Twitch badge
 * whether or not the widget reads Twitch chat.
 *
 * `worksWith` is the raw value of the `custom.works_with` product metafield,
 * a JSON array of platform names, and it is now the ONLY source. Each
 * product's list is derived from that product's own Etsy listing, which
 * docs/COPY-STANDARD.md names as authoritative, by
 * scripts/audit-platform-claims.mjs.
 *
 * There used to be a fallback to parsing the description's own "Works With"
 * prose for the 26 products with no metafield. That fallback is what let a
 * page confirm its own error: the Potion Bottle goal widget rendered Twitch,
 * YouTube and Kick badges read out of its own wrong copy, while Etsy listing
 * 1790033028 says "THIS ITEM IS FOR OBS/OBS STUDIO, STREAMLABS, AND
 * STREAMELEMENTS" and ships two zips and a setup PDF. Todd found it on
 * 2026-09-14. Prose is not a source of truth, it is the thing being checked,
 * and app/lib/platforms.js already records that substring matching cannot
 * tell a claim from its denial.
 *
 * All 125 storefront products now carry the metafield. A product without one
 * shows no badge row at all, which is the honest default: a wrong badge costs
 * a refund, a missing one costs a little scannability.
 * @param {{description: string, worksWith?: string | null, productType?: string}}
 */
export function ProductHighlights({description, worksWith, productType}) {
  const platforms = parseWorksWith(worksWith) || [];

  // Badges alone still leave a buyer guessing. Two things decide whether this
  // widget works for them, and neither is obvious from a row of logos: the
  // account it runs on, and whether it reads chat from anywhere but Twitch.
  // Both are said in words, generated from the same platform list, so they
  // can never drift from the badges above them.
  const host = platforms.includes('StreamElements')
    ? platforms.includes('Streamlabs')
      ? 'a free StreamElements or Streamlabs account'
      : 'a free StreamElements account'
    : platforms.includes('Streamlabs')
      ? 'a free Streamlabs account'
      : null;

  // Only say this on chat widgets. A goal widget does not read chat at all,
  // so "does not pull YouTube chat" would answer a question nobody asked.
  const isChat = /chat/i.test(productType || '');
  const missing = ['YouTube', 'Kick'].filter((p) => !platforms.includes(p));
  const chatNote =
    isChat && missing.length === 2 && platforms.includes('Twitch')
      ? 'Reads Twitch chat only. It does not pull YouTube or Kick chat.'
      : null;
  const customizable = /customi[sz]/i.test(description);

  return (
    <div className="product-highlights">
      {platforms.length > 0 && (
        <>
          <p className="product-highlights-label">Instant download, works with</p>
          <div className="product-platforms">
            {platforms.map((platform) => (
              <span key={platform} className="product-platform-badge">
                <PlatformIcon platform={platform} />
                {platform}
              </span>
            ))}
          </div>
        </>
      )}
      {(host || chatNote) && (
        <p className="product-highlights-note">
          {chatNote}
          {chatNote && host ? ' ' : null}
          {host ? `Runs on ${host}.` : null}
        </p>
      )}
      <p className="product-highlights-label">What you get</p>
      <ul className="product-highlights-list">
        <li>⚡ Instant digital download after purchase</li>
        <li>🎨 {customizable ? 'Customizable colors & fonts' : 'Ready to use out of the box'}</li>
        {/* Only claimed when OBS is actually in this product's platform list.
            It used to print on every product regardless, which is the same
            blanket-claim habit that put YouTube and Kick on a StreamElements
            only widget. */}
        {platforms.includes('OBS') && (
          <li>🛠️ Works with OBS Studio via browser source</li>
        )}
        <li>💬 Setup help if you get stuck</li>
      </ul>
    </div>
  );
}
