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
  const origin = new URL(request.url).origin;

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
