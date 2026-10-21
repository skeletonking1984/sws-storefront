// The one place the Discord invite lives. The storefront, the order email and
// the product PDFs all link to <origin>/discord (brand.config.js `origin`),
// which redirects here, so an invite change is this one line plus a deploy.
// ZQSXsuAqGT is the shop owner's permanent (never-expiring) invite to the shop's
// server, checked 2026-09-25 via the Discord invites API.
//
// Gated by brand.config.js `features.discord`: a clone without a Discord
// wants this module to keep existing (never delete it) but produce no
// working invite. See app/routes/discord.jsx for the 404 that flag drives.
import {brand} from './brand.config.js';

export const DISCORD_INVITE = brand.features.discord
  ? 'https://discord.gg/ZQSXsuAqGT'
  : undefined;
