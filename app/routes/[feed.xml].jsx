/*
 * ONE product feed, in Google Merchant spec, for every shopping channel.
 *
 * Todd, 2026-09-15: "a standardized product feed might be good here."
 *
 * Why it matters more than tidiness. Today each channel syncs independently
 * from Shopify through its own app, and they have already drifted: X Shopping
 * reported 125 products against 124 storefront-visible on Shopify, and nothing
 * noticed. Every channel pulling ONE feed makes that class of drift impossible
 * rather than merely detectable, and it puts the rules in one reviewable file.
 *
 * Google's RSS 2.0 spec is the lingua franca here: Google Merchant Center, X
 * Shopping, Meta and Pinterest all accept it, so this single URL can serve all
 * of them.
 *
 * Three things this fixes that are live problems right now:
 *
 *   SHIPPING. Merchant Center had 124 products Limited and 0 Approved with
 *   "missing shipping information" blocking US traffic entirely. The feed
 *   carries an explicit g:shipping of 0 USD, which is both true (every product
 *   is an instant download) and exactly what that requirement wants.
 *
 *   IP LEAKAGE. The catalogue still holds draft and archived products named
 *   after other people's franchises. Draft products should never sync, but the
 *   feed refuses them by NAME regardless of status, so a mis-click in Admin
 *   cannot put Pokemon on an ad network. See BAT-153.
 *
 *   IDENTIFIERS. Digital downloads have no GTIN or MPN. Without an explicit
 *   g:identifier_exists of no, Google treats them as missing required fields.
 */

import {FEED_QUERY, PAGE_SIZE, buildFeedXml} from '~/lib/productFeed';

export async function loader({context, request}) {
  const origin = new URL(request.url).origin;

  const nodes = [];
  let after = null;
  // Paginate: the catalogue is ~124 today but the feed must not silently
  // truncate the day it passes 250.
  for (let page = 0; page < 10; page++) {
    const data = await context.storefront.query(FEED_QUERY, {
      variables: {first: PAGE_SIZE, after},
    });
    const conn = data?.products;
    if (!conn) break;
    nodes.push(...conn.nodes);
    if (!conn.pageInfo?.hasNextPage) break;
    after = conn.pageInfo.endCursor;
  }

  const {xml, items, skippedIp} = buildFeedXml(nodes, origin);

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      // Channels poll this daily at most. An hour of cache keeps a crawler
      // from hammering the Storefront API without making edits slow to land.
      'Cache-Control': `max-age=${60 * 60}`,
      'X-Feed-Items': String(items),
      'X-Feed-Excluded-Ip': String(skippedIp),
    },
  });
}
