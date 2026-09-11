import {worksWithPlatforms} from '~/lib/platforms';
import {PlatformIcon} from '~/components/PlatformIcon';

/**
 * Etsy-style "Highlights" block: platform badges + scannable digital-good
 * facts, shown between the buy box and the long description.
 *
 * Deliberately takes no `title`. The title used to feed platform detection
 * too, which is how a product called "... for Twitch" earned a Twitch badge
 * whether or not the widget reads Twitch chat.
 * @param {{description: string}}
 */
export function ProductHighlights({description}) {
  // Only ever from the "Works With" section, never from free text. See
  // worksWithPlatforms() for why scanning the whole description badged the
  // top seller with the two platforms its own FAQ says it does not support.
  const platforms = worksWithPlatforms(description) || [];
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
