/**
 * Audit: every storefront-visible product must be complete enough to sell.
 *
 * Checks the five fields the checklist item "Every active product: title,
 * image, price, product type, Chat/Goal tag correct" names, plus the two
 * things that silently break the site if they are missing:
 *
 *   title        non-empty, not a placeholder, no em/en dash (house rule)
 *   image        featuredImage present, or the card renders an empty box
 *   price        > 0, or the buy panel reads "Free"
 *   productType  set and one of the known types. The mega menu counts, the
 *                smart collections (widgets/overlays/bundles/Chat/Goal) and
 *                the product card badge all key off productType, so an unset
 *                type means the product exists but is unreachable by browsing.
 *   tag          Chat_widget / Goal_Widget must agree with productType.
 *   description  non-empty, or the PDP has no copy at all.
 *
 * Products created through the Admin API arrive with no productType and no
 * tags, so this regresses every time the catalog is written to from a script.
 * Run it alongside scripts/audit-shipping.mjs after any catalog write.
 *
 * Usage:
 *   node scripts/audit-catalog.mjs           human report, exit 1 if any issue
 *   node scripts/audit-catalog.mjs --json    machine readable, always exit 0
 */
import fs from 'node:fs';

const env = Object.fromEntries(
  fs
    .readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1).replace(/^["']|["']$/g, '')];
    }),
);

const domain = env.PUBLIC_STORE_DOMAIN;
const token = env.PUBLIC_STOREFRONT_API_TOKEN;

if (!domain || !token) {
  console.error(
    'Missing PUBLIC_STORE_DOMAIN or PUBLIC_STOREFRONT_API_TOKEN in .env',
  );
  process.exit(1);
}

const asJson = process.argv.includes('--json');

/** productType values this catalog is allowed to use. */
const KNOWN_TYPES = new Set([
  'Chat Widget',
  'Goal Widget',
  'Overlay Pack',
  'Bundle',
  'Emotes',
]);

/**
 * productType -> the tag that must be present.
 *
 * Shopify's productType is a single string, but a large part of this catalog
 * is sold as one purchase containing BOTH a chat widget and a goal widget
 * ("... Chat & Goal Widgets"). Typing those as Chat Widget alone hid 25 of
 * them, the top seller included, from the Goal Widget collection even though
 * the buyer receives a goal widget in the box.
 *
 * So since 2026-09-10 the two widget collections are disjunctive on
 * "TYPE EQUALS x OR TAG EQUALS x_tag", and the tag is what carries the second
 * membership. The invariant this audit enforces is therefore:
 *
 *   - a widget-typed product always carries the tag matching its own type
 *   - it may ALSO carry the other widget tag, but only if it really is a
 *     combo, which the title or the handle has to say
 *   - a product of any other type carries neither widget tag, or it leaks
 *     into a widget collection through the tag rule
 */
const TYPE_TAG = {
  'Chat Widget': 'Chat_widget',
  'Goal Widget': 'Goal_Widget',
};

const ALL_TYPE_TAGS = Object.values(TYPE_TAG);

/**
 * Does this product say it is a chat widget, or a goal widget, or both?
 *
 * Reads the handle as well as the title. Shopify titles get shortened for the
 * storefront and lose the signal: "Neon Moon Glow Chat Widget" reads chat-only
 * but its handle is `moon-glow-...-chat-and-goal-stream-widgets` and its Etsy
 * listing ships ChatCode.zip AND GoalCode.zip. Title alone would have stripped
 * a correct tag off the number 4 seller.
 * @param {{title: string; handle: string}} p
 */
function saysKind(p) {
  const hay = `${p.title} ${p.handle.replace(/-/g, ' ')}`.toLowerCase();
  return {
    chat: /\bchat\b/.test(hay),
    goal: /\bgoal\b|\btip jar\b|\bdonation\b/.test(hay),
  };
}

const QUERY = `query CatalogAudit($after: String) {
  products(first: 250, after: $after) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id
      handle
      title
      productType
      tags
      description
      featuredImage { url }
      priceRange { minVariantPrice { amount currencyCode } }
    }
  }
}`;

async function storefront(variables) {
  const res = await fetch(`https://${domain}/api/2025-07/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': token,
    },
    body: JSON.stringify({query: QUERY, variables}),
  });
  const json = await res.json();
  if (json.errors) {
    console.error(JSON.stringify(json.errors, null, 2));
    process.exit(1);
  }
  return json.data.products;
}

async function fetchAll() {
  const out = [];
  let after = null;
  for (;;) {
    const page = await storefront({after});
    out.push(...page.nodes);
    if (!page.pageInfo.hasNextPage) break;
    after = page.pageInfo.endCursor;
  }
  return out;
}

/**
 * Guess a productType from the title, chat before goal.
 *
 * Order matters and is the trap this catalog has fallen into before: a great
 * many listings are named "... Chat and Goal Widget", so testing for "goal"
 * first badges every combo product as a Goal Widget. Chat wins a tie.
 * Returns null when the title says nothing either way, because a wrong type is
 * worse than an absent one.
 */
function guessType(title) {
  const t = title.toLowerCase();
  if (/\bbundle\b|\bkit\b|\bpack\b/.test(t) && !/\boverlay pack\b/.test(t)) {
    if (/\boverlay\b/.test(t)) return 'Overlay Pack';
    return 'Bundle';
  }
  if (/\boverlay\b/.test(t)) return 'Overlay Pack';
  if (/\bemote/.test(t)) return 'Emotes';
  if (/\bchat\b/.test(t)) return 'Chat Widget';
  if (/\bgoal\b|\btip jar\b|\bdonation\b/.test(t)) return 'Goal Widget';
  return null;
}

function auditOne(p) {
  const issues = [];
  const title = (p.title || '').trim();

  if (!title) {
    issues.push({field: 'title', problem: 'empty'});
  } else if (/^untitled/i.test(title)) {
    issues.push({field: 'title', problem: `placeholder: ${title}`});
  }
  if (/[—–]/.test(title)) {
    issues.push({field: 'title', problem: 'contains an em or en dash'});
  }

  if (!p.featuredImage?.url) {
    issues.push({field: 'image', problem: 'no featured image'});
  }

  const amount = Number(p.priceRange?.minVariantPrice?.amount ?? 0);
  if (!(amount > 0)) {
    issues.push({field: 'price', problem: `price is ${amount}`});
  }

  if (!(p.description || '').trim()) {
    issues.push({field: 'description', problem: 'empty description'});
  }

  const type = (p.productType || '').trim();
  if (!type) {
    issues.push({
      field: 'productType',
      problem: 'not set',
      suggested: guessType(title),
    });
  } else if (!KNOWN_TYPES.has(type)) {
    issues.push({
      field: 'productType',
      problem: `unknown type: ${type}`,
      suggested: guessType(title),
    });
  }

  // Tag correctness is only defined for the two widget types.
  //
  // Compare case-insensitively. Shopify matches and dedupes tags without
  // regard to case, so adding "Goal_Widget" to a product that already carries
  // "goal_widget" keeps the existing casing and this catalog holds all three
  // of Goal_Widget, goal_widget and Chat_Widget. A case-sensitive check here
  // reported 30 products as untagged when every one of them was tagged, and
  // the smart collection rules match them correctly. Same reason the rules
  // themselves work: TAG EQUALS is case-insensitive.
  const wantTag = TYPE_TAG[type];
  const tags = p.tags || [];
  const has = (t) => tags.some((x) => x.toLowerCase() === t.toLowerCase());
  if (wantTag) {
    const kind = saysKind(p);
    // The tag matching this product's own type, plus the other widget tag on
    // a genuine combo. A combo missing its second tag is invisible in one of
    // the two widget collections, the exact hole fixed on 2026-09-10.
    const wanted = new Set([wantTag]);
    if (kind.chat) wanted.add('Chat_widget');
    if (kind.goal) wanted.add('Goal_Widget');
    for (const w of wanted) {
      if (!has(w)) {
        issues.push({
          field: 'tag',
          problem: `missing ${w}, so it is hidden from that collection`,
          add: w,
        });
      }
    }
    for (const w of ALL_TYPE_TAGS) {
      if (!wanted.has(w) && has(w)) {
        issues.push({
          field: 'tag',
          problem: `has ${w}, but neither title nor handle says ${
            w === 'Chat_widget' ? 'chat' : 'goal'
          }`,
          remove: w,
        });
      }
    }
  } else if (type) {
    for (const s of ALL_TYPE_TAGS) {
      if (has(s)) {
        issues.push({
          field: 'tag',
          problem: `has widget tag ${s} but productType is ${type}`,
          remove: s,
        });
      }
    }
  }

  return issues;
}

const products = await fetchAll();
const report = [];
for (const p of products) {
  const issues = auditOne(p);
  if (issues.length) report.push({handle: p.handle, title: p.title, id: p.id, issues});
}

if (asJson) {
  console.log(JSON.stringify({total: products.length, report}, null, 2));
  process.exit(0);
}

const byField = {};
for (const row of report) {
  for (const i of row.issues) byField[i.field] = (byField[i.field] || 0) + 1;
}

console.log(`${products.length} storefront-visible products audited`);
console.log(`${report.length} with at least one issue`);
for (const [field, n] of Object.entries(byField).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${field}: ${n}`);
}
console.log('');
for (const row of report) {
  console.log(`${row.handle}`);
  console.log(`  ${row.title}`);
  for (const i of row.issues) {
    const extra = i.suggested ? ` (suggest: ${i.suggested})` : '';
    console.log(`  - ${i.field}: ${i.problem}${extra}`);
  }
}

process.exit(report.length ? 1 : 0);
