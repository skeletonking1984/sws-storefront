/**
 * Real SWS customers, carried over from the old Energy theme's "Happy
 * Clients" gallery before the Hydrogen cutover took that theme off the
 * domain.
 *
 * Every row here was read out of the live theme's own markup on 2026-09-10,
 * pairing each avatar to its link by DOM structure (the image and the
 * overlay anchor inside the same gallery slide) rather than by matching
 * names by eye. Putting one streamer's face on another streamer's channel
 * is the same class of mistake as putting one widget's reviews on another
 * widget's page, so the pairing was never guessed.
 *
 * Avatars are re-hosted from this repo, not hotlinked, so they survive the
 * old theme going away. Seven were upgraded from the theme's 70x70 copies to
 * the 300x300 originals on Twitch's CDN using the user-picture id embedded
 * in the filename. gaming_girl160's id no longer resolves at 300x300, so
 * that one is still the 70x70 the theme had.
 *
 * `clip: true` means the link goes to a Twitch clip rather than a channel.
 */
import celestialaurelia from '~/assets/clients/celestialaurelia.png';
import chow1617 from '~/assets/clients/chow1617.jpg';
import chubzz24 from '~/assets/clients/chubzz24.jpg';
import gamingGirl160 from '~/assets/clients/gaming_girl160.jpg';
import kykaku from '~/assets/clients/kykaku.png';
import shiorifps from '~/assets/clients/shiorifps.png';
import strawberrynekomajo from '~/assets/clients/strawberrynekomajo.png';
import themakcident from '~/assets/clients/themakcident.jpg';
import thiccctoasttt from '~/assets/clients/thiccctoasttt.jpg';
import tonia2dawn from '~/assets/clients/tonia2dawn.jpg';

export const HAPPY_CLIENTS = [
  {handle: 'chubzz24', image: chubzz24, href: 'https://www.twitch.tv/chubzz24'},
  {
    handle: 'tonia2dawn',
    image: tonia2dawn,
    href: 'https://www.twitch.tv/tonia2dawn',
  },
  {
    handle: 'themakcident',
    image: themakcident,
    clip: true,
    href: 'https://www.twitch.tv/themakcident/clip/ApatheticUninterestedGiraffePartyTime-LQ6yzPzTV90ibOED',
  },
  {
    handle: 'strawberrynekomajo',
    image: strawberrynekomajo,
    href: 'https://www.twitch.tv/strawberrynekomajo',
  },
  {
    handle: 'celestialaurelia',
    image: celestialaurelia,
    href: 'https://www.twitch.tv/celestialaurelia',
  },
  {handle: 'kykaku', image: kykaku, href: 'https://www.twitch.tv/kykaku'},
  {
    handle: 'shiorifps',
    image: shiorifps,
    href: 'https://www.twitch.tv/shiorifps',
  },
  {
    handle: 'gaming_girl160',
    image: gamingGirl160,
    href: 'https://www.twitch.tv/gaming_girl160',
  },
  {handle: 'chow1617', image: chow1617, href: 'https://www.twitch.tv/chow1617'},
  {
    handle: 'thiccctoasttt',
    image: thiccctoasttt,
    clip: true,
    href: 'https://www.twitch.tv/thiccctoasttt/clip/ShySmoggyElephantBabyRage-hyd3Ng6qTx_KMXhp',
  },
];
