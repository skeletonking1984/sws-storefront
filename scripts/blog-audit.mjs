#!/usr/bin/env node
/*
 * Pull every blog article and report what is costing the blog organic traffic.
 *
 * Todd, 2026-09-15: "QA the blogs, we are going for traffic, organic as much as
 * possible."
 *
 * The checks are ordered by what actually suppresses rankings, not by what is
 * easiest to count. Cannibalisation is first because it is the blog's real
 * problem: several near duplicate posts target the same query, so Google has to
 * pick one and the others split the signal. Adding a 44th article does nothing
 * while that is true.
 */
import {readFileSync, writeFileSync} from 'node:fs';

const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n')
  .filter((l) => l.includes('=')).map((l) => {const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];}));

const QUERY = `{
  blog(handle:"news"){
    articles(first:60){ nodes {
      id handle title tags publishedAt
      seo { title description }
      image { url width height altText }
      contentHtml
      author { name }
    } }
  }
}`;

const res = await fetch(`https://${env.PUBLIC_STORE_DOMAIN}/api/2025-01/graphql.json`, {
  method: 'POST',
  headers: {'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': env.PUBLIC_STOREFRONT_API_TOKEN},
  body: JSON.stringify({query: QUERY}),
});
const json = await res.json();
if (json.errors) { console.error(JSON.stringify(json.errors, null, 2)); process.exit(1); }
const arts = json.data.blog.articles.nodes;

const text = (html) => String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const words = (html) => text(html).split(' ').filter(Boolean).length;

/* Stop words are stripped before comparing titles, otherwise every pair scores
 * high on "for", "the", "and" and nothing stands out. */
const STOP = new Set(['for','the','and','to','in','of','a','an','your','you','with','on','is','are','best','how','what','why','2025','2026','guide','top']);
const keyset = (t) => new Set(String(t).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)));
const jaccard = (a, b) => {
  const inter = [...a].filter((x) => b.has(x)).length;
  const uni = new Set([...a, ...b]).size;
  return uni ? inter / uni : 0;
};

const findings = [];
const add = (sev, kind, detail, handles) => findings.push({sev, kind, detail, handles});

// 1. Cannibalisation: near duplicate titles competing for one query.
const ks = arts.map((a) => ({a, k: keyset(a.title)}));
const seenPair = new Set();
for (let i = 0; i < ks.length; i++) {
  for (let j = i + 1; j < ks.length; j++) {
    const score = jaccard(ks[i].k, ks[j].k);
    if (score >= 0.5) {
      const key = [ks[i].a.handle, ks[j].a.handle].sort().join('|');
      if (seenPair.has(key)) continue;
      seenPair.add(key);
      add('HIGH', 'cannibalisation', `${(score * 100).toFixed(0)}% title overlap`, [ks[i].a.handle, ks[j].a.handle]);
    }
  }
}

// 2. Reused hero images: the same file on more than one article.
const byImg = new Map();
for (const a of arts) {
  if (!a.image?.url) continue;
  // Shopify appends a hash suffix per upload; compare the stem before it.
  const stem = a.image.url.split('/').pop().split('?')[0].replace(/_[0-9a-f]{8}-[0-9a-f-]+(\.\w+)$/, '$1');
  if (!byImg.has(stem)) byImg.set(stem, []);
  byImg.get(stem).push(a.handle);
}
for (const [stem, hs] of byImg) if (hs.length > 1) add('MED', 'reused-hero', stem, hs);

// 3. IP risk in titles. Named marks are a takedown and a brand risk (BAT-153).
const IP = /\b(star\s?wars|mandalorian|grogu|yoda|baby yoda|pokemon|pok[eé]mon|charizard|eevee|valorant|brimstone|fortnite|minecraft|zelda|mario|genshin)\b/i;
for (const a of arts) {
  const hit = (a.title + ' ' + text(a.contentHtml).slice(0, 4000)).match(IP);
  if (hit) add('HIGH', 'ip-risk', `names "${hit[0]}"`, [a.handle]);
}

// 4. SEO fields. A missing description lets Google invent the snippet.
for (const a of arts) {
  if (!a.seo?.description) add('MED', 'no-meta-description', '', [a.handle]);
  else if (a.seo.description.length > 165) add('LOW', 'meta-description-too-long', `${a.seo.description.length} chars`, [a.handle]);
  if (!a.seo?.title) add('LOW', 'no-seo-title', '', [a.handle]);
  if (a.title.length > 60) add('LOW', 'title-too-long', `${a.title.length} chars`, [a.handle]);
}

// 5. Duplicate meta descriptions across articles.
const byDesc = new Map();
for (const a of arts) {
  const d = (a.seo?.description || '').trim();
  if (!d) continue;
  if (!byDesc.has(d)) byDesc.set(d, []);
  byDesc.get(d).push(a.handle);
}
for (const [, hs] of byDesc) if (hs.length > 1) add('MED', 'duplicate-meta-description', '', hs);

// 6. Thin content. Under 600 words rarely ranks for anything contested.
for (const a of arts) {
  const w = words(a.contentHtml);
  if (w < 400) add('HIGH', 'thin-content', `${w} words`, [a.handle]);
  else if (w < 600) add('MED', 'thin-content', `${w} words`, [a.handle]);
}

/*
 * 7. No IN-BODY product links.
 *
 * Deliberately named for what it measures. The rendered page is NOT link dead:
 * every article ships the cross-sell row from app/lib/blogCrossSell.js, and a
 * live fetch of one of these articles on 2026-09-15 returned 10 distinct
 * /products/ links. Calling this "no product links" overstated it fourfold.
 *
 * It still matters. A contextual link inside the prose, anchored on words the
 * reader is already reading, carries more relevance than a generic row bolted
 * to the bottom of every post, and it is the link a buyer actually follows.
 */
for (const a of arts) {
  const links = (a.contentHtml || '').match(/\/products\/[a-z0-9-]+/g) || [];
  if (!links.length) add('MED', 'no-inbody-product-links', 'cross-sell row still renders', [a.handle]);
}

// 8. Hero alt text. Free relevance signal, and an accessibility one.
for (const a of arts) {
  if (a.image && !a.image.altText) add('LOW', 'no-image-alt', '', [a.handle]);
}

// 9. No tags: the blog's own category UI is driven by these.
for (const a of arts) if (!a.tags?.length) add('LOW', 'no-tags', '', [a.handle]);

// 10. Headings. A post with no h2 is a wall of text to a reader and to a crawler.
for (const a of arts) {
  const h2 = ((a.contentHtml || '').match(/<h2[\s>]/gi) || []).length;
  if (h2 === 0) add('MED', 'no-h2-headings', '', [a.handle]);
}

const order = {HIGH: 0, MED: 1, LOW: 2};
findings.sort((x, y) => order[x.sev] - order[y.sev] || x.kind.localeCompare(y.kind));

const counts = findings.reduce((m, f) => (m[f.sev] = (m[f.sev] || 0) + 1, m), {});
console.log(`${arts.length} articles, ${findings.length} findings  HIGH=${counts.HIGH || 0} MED=${counts.MED || 0} LOW=${counts.LOW || 0}\n`);
for (const f of findings) {
  console.log(`${f.sev.padEnd(4)} ${f.kind.padEnd(26)} ${f.detail.padEnd(22)} ${f.handles.join('  +  ')}`);
}

writeFileSync('blog-hero/audit.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  articles: arts.map((a) => ({
    handle: a.handle, title: a.title, tags: a.tags, words: words(a.contentHtml),
    seo: a.seo, image: a.image, publishedAt: a.publishedAt,
    productLinks: [...new Set((a.contentHtml || '').match(/\/products\/[a-z0-9-]+/g) || [])],
  })),
  findings,
}, null, 2));
console.log('\nwrote blog-hero/audit.json');
