/**
 * Real SWS customers, each linked to their own Twitch channel.
 *
 * The list started as the old Energy theme's "Happy Clients" gallery, read
 * out of that theme's own markup on 2026-09-10, pairing each avatar to its
 * link by DOM structure rather than by matching names by eye. Putting one
 * streamer's face on another streamer's channel is the same class of mistake
 * as putting one widget's reviews on another widget's page, so the pairing
 * was never guessed.
 *
 * Re-verified 2026-09-12 against Twitch's own API, every handle and every
 * link. What that pass changed:
 *
 * - `chubzz24` was removed. The account no longer resolves on Twitch at all,
 *   so its face linked to a dead page.
 * - `thiccctoasttt` kept its face but lost its clip. The clip slug
 *   `ShySmoggyElephantBabyRage-hyd3Ng6qTx_KMXhp` no longer resolves, so the
 *   link now goes to the channel like everyone else's.
 * - Every avatar was refreshed from that account's current Twitch profile
 *   image. Several people had changed their picture since the old theme
 *   captured it, and `gaming_girl160` was still the theme's 70x70 thumbnail.
 *
 * Avatars are re-hosted in this repo, not hotlinked, so they survive the old
 * theme going away and cannot change under us. They are stored at 192x192,
 * which is 2x the 96px they render at.
 *
 * `clip: true` means the link goes to a Twitch clip rather than a channel.
 * Verify any clip slug before adding it: clips are deleted far more often
 * than channels are.
 */
import celestialaurelia from '~/assets/clients/celestialaurelia.png';
import chow1617 from '~/assets/clients/chow1617.png';
import gamingGirl160 from '~/assets/clients/gaming_girl160.png';
import kykaku from '~/assets/clients/kykaku.png';
import shiorifps from '~/assets/clients/shiorifps.png';
import strawberrynekomajo from '~/assets/clients/strawberrynekomajo.png';
import themakcident from '~/assets/clients/themakcident.png';
import thiccctoasttt from '~/assets/clients/thiccctoasttt.png';
import tonia2dawn from '~/assets/clients/tonia2dawn.png';

export const HAPPY_CLIENTS = [
  {
    handle: 'chow1617',
    image: chow1617,
    href: 'https://www.twitch.tv/chow1617',
  },
  {
    handle: 'gaming_girl160',
    image: gamingGirl160,
    href: 'https://www.twitch.tv/gaming_girl160',
  },
  {
    handle: 'celestialaurelia',
    image: celestialaurelia,
    href: 'https://www.twitch.tv/celestialaurelia',
  },
  {
    handle: 'tonia2dawn',
    image: tonia2dawn,
    href: 'https://www.twitch.tv/tonia2dawn',
  },
  {
    handle: 'strawberrynekomajo',
    image: strawberrynekomajo,
    href: 'https://www.twitch.tv/strawberrynekomajo',
  },
  {
    handle: 'kykaku',
    image: kykaku,
    href: 'https://www.twitch.tv/kykaku',
  },
  {
    handle: 'thiccctoasttt',
    image: thiccctoasttt,
    href: 'https://www.twitch.tv/thiccctoasttt',
  },
  {
    handle: 'shiorifps',
    image: shiorifps,
    href: 'https://www.twitch.tv/shiorifps',
  },
  {
    handle: 'themakcident',
    image: themakcident,
    clip: true,
    href: 'https://www.twitch.tv/themakcident/clip/ApatheticUninterestedGiraffePartyTime-LQ6yzPzTV90ibOED',
  },
];
