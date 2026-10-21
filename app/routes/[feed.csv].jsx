/*
 * The SAME catalogue as /feed.xml, in X Shopping's own spec.
 *
 * WHY TWO FEEDS. /feed.xml is Google Merchant RSS 2.0 and Google ingests it at
 * 122 items. X accepted that identical file and failed all 122, reporting
 * every item as missing a title, a description, a link and a valid
 * availability. That was not X rejecting XML, it was X having a DIFFERENT
 * SPEC: plain field names instead of Google's g: namespace, "in stock" with a
 * space instead of "in_stock", one comma-separated image field instead of
 * repeated elements. See app/lib/productFeedCsv.js for the full diff.
 *
 * X documents its spec entirely as CSV columns
 * (https://business.x.com/en/help/shopping-specs.html). Their XML option
 * exists but its schema is published nowhere, and guessing at it is exactly
 * what produced 400 errors. CSV is the shape they actually describe.
 *
 * Both feeds share productFeed.js for the query, the IP exclusion and the id,
 * so the two can disagree about formatting but never about WHICH products
 * exist or what they are called. A second independent product list would drift
 * silently, and the failure mode is a channel advertising something the
 * storefront no longer sells.
 */

import {FEED_QUERY, PAGE_SIZE} from '~/lib/productFeed';
import {buildFeedCsv} from '~/lib/productFeedCsv';

export async function loader({context, request}) {
  const origin = new URL(request.url).origin;

  const nodes = [];
  let after = null;
  // Paginate, same as the XML feed: ~124 today, must not silently truncate
  // the day it passes 250.
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

  const {csv, items, skippedIp} = buildFeedCsv(nodes, origin);

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
