/*
 * The same catalogue again, in Pinterest's own column set.
 *
 * Third feed, third spec, one source of truth. /feed.xml is Google Merchant
 * RSS, /feed.csv is X Shopping, this is Pinterest. They exist separately
 * because assuming one file satisfies every channel is what put 122 items into
 * X and got 400 errors back. All three import productFeed.js for the query,
 * the IP exclusion and the id, so they can differ in formatting and never in
 * which products exist.
 */

import {FEED_QUERY, PAGE_SIZE} from '~/lib/productFeed';
import {buildPinterestCsv} from '~/lib/productFeedCsv';

export async function loader({context, request}) {
  /*
   * PINTEREST LINKS DO NOT USE THIS SITE'S OWN ORIGIN, and that is not a bug.
   *
   * Pinterest rejects any item whose link is on a domain the account has not
   * claimed (Error 139, which failed all 122 items on 2026-09-16). The apex,
   * streamwidgetshop.com, cannot be claimed: a different Pinterest account was
   * deactivated for spam in April 2024 and still holds the claim, and its
   * appeal window closed in 2024.
   *
   * Of the domains this account HAS claimed, only one serves product pages a
   * buyer can use:
   *
   *   shop.streamwidgetshop.com    claimed, crawlable, redirects to the real
   *                                Hydrogen product page with the path intact
   *                                (verified in a real browser: lands on the
   *                                correct PDP with add to cart and prices)
   *   sws-storefront-....o2...dev  claimed, but Oxygen serves
   *                                "Disallow: /" and "x-robots-tag: none" on
   *                                preview domains, above the app, so nothing
   *                                can crawl it
   *   streamwidgetshop.myshopify   admin domain, not a storefront
   *
   * KNOWN RISK, not yet settled: the redirect page carries
   * <meta name="robots" content="noindex">. If Pinterest honours it, these
   * items are refused for a second reason and this whole approach is dead. If
   * it only checks the domain claim, it works. There is no way to find out
   * short of an ingest.
   *
   * REVERT THIS the day streamwidgetshop.com is claimed on the Pinterest
   * account: change PINTEREST_LINK_ORIGIN back to the request origin. The apex
   * is the real storefront, it is indexable, and it needs no redirect hop.
   */
  const PINTEREST_LINK_ORIGIN = 'https://shop.streamwidgetshop.com';
  const origin = PINTEREST_LINK_ORIGIN;

  const nodes = [];
  let after = null;
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

  const {csv, items, skippedIp} = buildPinterestCsv(nodes, origin);

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Cache-Control': `max-age=${60 * 60}`,
      'X-Feed-Items': String(items),
      'X-Feed-Excluded-Ip': String(skippedIp),
    },
  });
}
