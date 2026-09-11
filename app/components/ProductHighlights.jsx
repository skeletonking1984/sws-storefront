import {worksWithPlatforms} from '~/lib/platforms';
import {PlatformIcon} from '~/components/PlatformIcon';

/**
 * Reads the `custom.works_with` metafield value, which Shopify stores as a
 * JSON encoded array of strings for a list.single_line_text_field. Returns
 * null on anything unexpected so the caller falls through to the description
 * rather than rendering garbage.
 * @param {string | null | undefined} raw
 */
function parseWorksWith(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {
    return null;
  }
  return null;
}

/**
 * Etsy-style "Highlights" block: platform badges + scannable digital-good
 * facts, shown between the buy box and the long description.
 *
 * Deliberately takes no `title`. The title used to feed platform detection
 * too, which is how a product called "... for Twitch" earned a Twitch badge
 * whether or not the widget reads Twitch chat.
 *
 * `worksWith` is the raw value of the `custom.works_with` product metafield,
 * a JSON array of platform names. It is the preferred source because it is
 * structured data that a later copy edit cannot silently break, and because
 * each product's list was derived from that product's own Etsy listing body
 * rather than from whatever words happen to appear on the page. Products not
 * yet backfilled fall back to parsing their "Works With" section, and a
 * product with neither shows no badge row at all, which is the honest
 * default: a wrong badge costs a refund, a missing one costs a little
 * scannability.
 * @param {{description: string, worksWith?: string | null}}
 */
export function ProductHighlights({description, worksWith}) {
  const platforms = parseWorksWith(worksWith) || worksWithPlatforms(description) || [];
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
      <p className="product-highlights-label">What you get</p>
      <ul className="product-highlights-list">
        <li>⚡ Instant digital download after purchase</li>
        <li>🎨 {customizable ? 'Customizable colors & fonts' : 'Ready to use out of the box'}</li>
        <li>🛠️ Works with OBS Studio via browser source</li>
        <li>💬 Setup help included if you get stuck</li>
      </ul>
    </div>
  );
}
