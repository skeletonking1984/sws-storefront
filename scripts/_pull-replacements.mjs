import {writeFileSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MCP_DIST = path.resolve(ROOT, '../sws-etsy-mcp/dist');
const {getListing, listListingFiles} = await import(pathToFileURL(path.join(MCP_DIST, 'api.js')));
const ids = [1902597989, 1763459664, 1881111390];
const out = {};
for (const id of ids) {
  const listing = await getListing(id);
  const filesRes = await listListingFiles([id]);
  out[id] = {listing_id: id, title: listing.title, description: listing.description, state: listing.state, files: filesRes.listings[0]?.files ?? []};
}
writeFileSync(path.join(ROOT, 'data/copy-replacements-source.json'), JSON.stringify(out, null, 2)+'\n');
console.log('done');
