/** A product counts as new for this many days after Shopify's createdAt. */
export const NEW_DAYS = 30;

/** True when createdAt is a real date inside the last NEW_DAYS days. */
export function isNewProduct(createdAt, now = Date.now()) {
  const t = Date.parse(createdAt || '');
  if (!Number.isFinite(t)) return false;
  return now - t >= 0 && now - t <= NEW_DAYS * 864e5;
}

/**
 * `base` in its own order with `extra` dropped in every other slot, skipping
 * repeats (by id), so newer products sit near the top instead of under the
 * whole list. Every product in either list is returned exactly once.
 */
export function mixInNewest(base, extra) {
  const seen = new Set();
  const out = [];
  const take = (p) => {
    if (!p || seen.has(p.id)) return;
    seen.add(p.id);
    out.push(p);
  };
  for (let i = 0; i < Math.max(base.length, extra.length); i++) {
    take(base[i]);
    take(extra[i]);
  }
  return out;
}

/**
 * Best sellers (in their existing order, picked out by `isTop`) alternated
 * with every item newest first by createdAt.
 */
export function interleaveNewest(items, isTop) {
  const newest = [...items].sort(
    (a, b) =>
      (Date.parse(b.createdAt || '') || 0) -
      (Date.parse(a.createdAt || '') || 0),
  );
  return mixInNewest(items.filter(isTop), newest);
}
