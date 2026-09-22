import {parseWorksWith, shipsChat, chatPlatforms, isMultistream} from '~/lib/platforms';
import {PlatformIcon} from '~/components/PlatformIcon';

/** Platforms a chat widget can read FROM, as opposed to where it runs. */
const CHAT_SOURCES = ['Twitch', 'YouTube', 'Kick', 'TikTok'];

/**
 * "Twitch, YouTube and Kick". Oxford comma omitted deliberately: this string
 * lands mid-sentence in a product page, not in a list. `conjunction` is "and"
 * for things that happen together and "or" for things that are alternatives,
 * which is the whole difference between a multistream chat widget and a goal
 * widget that works on any one platform at a time.
 * @param {string[]} items
 * @param {string} [conjunction]
 */
function listPlatforms(items, conjunction = 'and') {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items[items.length - 1]}`;
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

  // The multistream question, answered in words on every product rather than
  // left to a badge row. Multistream means the product WORKS on Twitch,
  // YouTube and Kick (Todd, 2026-09-22), and that is true of goal widgets and
  // chat widgets alike. What differs is WHY, and a badge row cannot say it:
  //
  //   a CHAT widget  reads all three chats at once into one overlay
  //   a GOAL widget  reads no chat at all. It counts tips and subs through
  //                  StreamElements, so it runs wherever you are live
  //
  // Both are multistream. Only one of them reads chat, and saying so is the
  // difference between a buyer who knows what arrives and a refund.
  const multistream = isMultistream({worksWith});
  const sources = chatPlatforms({worksWith, productType});
  const carriesChat = shipsChat({productType});
  // A chatless product still names streaming platforms in its badge row, and
  // that row is what looks like a chat claim. Measured 2026-09-22: 3 goal
  // widgets name more than one. The other 82 name Twitch alone, have nothing
  // to clear up, and "it works whether you stream on Twitch" is noise.
  const chatlessOn = platforms.filter((p) => CHAT_SOURCES.includes(p));

  const chatNote = carriesChat
    ? multistream && sources.length > 1
      ? `Multistream: reads ${listPlatforms(sources)} chat at once, in one overlay.`
      : sources.length === 1
        ? `Reads ${sources[0]} chat only. Not multistream.`
        : null
    : chatlessOn.length > 1
      ? `${multistream ? 'Multistream: works' : 'Works'} whether you stream on ${listPlatforms(chatlessOn, 'or')}. Not a chat widget, so it reads no chat.`
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
