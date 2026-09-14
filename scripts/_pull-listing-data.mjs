import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MCP_DIST = path.resolve(ROOT, '../sws-etsy-mcp/dist');

const {getListing, listListingFiles} = await import(pathToFileURL(path.join(MCP_DIST, 'api.js')));

const candidates = JSON.parse(readFileSync(path.join(ROOT, 'data/copy-candidates-top35.json'), 'utf8'));
const ids = candidates.map(c => c.etsy_listing_id);

const out = {};
for (const id of ids) {
  process.stderr.write(`fetching ${id}...\n`);
  const listing = await getListing(id);
  const filesRes = await listListingFiles([id]);
  out[id] = {
    listing_id: id,
    title: listing.title,
    description: listing.description,
    url: listing.url,
    state: listing.state,
    files: filesRes.listings[0]?.files ?? [],
  };
}

writeFileSync(path.join(ROOT, 'data/copy-source-2026-09-13.json'), JSON.stringify(out, null, 2)+'\n');
console.log('done', Object.keys(out).length);
