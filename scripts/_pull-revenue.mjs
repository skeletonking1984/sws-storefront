import {writeFileSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MCP_DIST = path.resolve(ROOT, '../sws-etsy-mcp/dist');

const {productRevenue} = await import(pathToFileURL(path.join(MCP_DIST, 'api.js')));

// 45 day window
const until = new Date();
const since = new Date(until.getTime() - 45*24*3600*1000);

const rev = await productRevenue({since: since.toISOString().slice(0,10), until: until.toISOString().slice(0,10)});
writeFileSync(path.join(ROOT, 'data/etsy-revenue-45d.json'), JSON.stringify(rev, null, 2)+'\n');
console.log('orders', rev.order_count, 'total_revenue', rev.total_revenue, 'products', rev.products.length);
