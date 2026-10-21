// node --test app/lib/analytics/pixels/mukala.test.mjs   (Mukala pixel adapter; no DOM needed)
import test from 'node:test';
import assert from 'node:assert/strict';

const added = [];
globalThis.window = {
  sessionStorage: {setItem: (k, v) => (window._ss = [k, v])},
};
globalThis.document = {
  querySelector: () => null,
  createElement: () => ({dataset: {}}),
  head: {appendChild: (s) => added.push(s)},
};
const m = await import('./mukala.js');

test('inert until PUBLIC_MUKALA_PIXEL_ORG is set', () => {
  assert.equal(m.isConfigured({}), false);
  assert.equal(m.isConfigured({org: 'Bad Org'}), false);
  assert.equal(m.isConfigured({org: 'sws'}), true);
  m.send({name: 'add_to_cart'}, {});
  assert.equal(window.mk, undefined);
});

test('loads mk.js once with data-org, nonce, internal traffic marked test', () => {
  m.loadScript({org: 'sws'}, 'n1', true);
  assert.equal(added.length, 1);
  assert.equal(added[0].src, 'https://app.mukala.ai/static/mk.js');
  assert.equal(added[0].dataset.org, 'sws');
  assert.equal(added[0].nonce, 'n1');
  assert.deepEqual(window._ss, ['mk_t', '1']);
});

test('funnel: add_to_cart -> signup_started, begin_checkout -> signup_completed, first page_view skipped', () => {
  m.send({name: 'page_view'}, {org: 'sws'});
  m.send({name: 'add_to_cart'}, {org: 'sws'});
  m.send({name: 'begin_checkout'}, {org: 'sws'});
  m.send({name: 'page_view'}, {org: 'sws'});
  m.send({name: 'view_item'}, {org: 'sws'});
  assert.deepEqual(
    window.mk.q.map((a) => a[0]),
    ['signup_started', 'signup_completed', 'page_view'],
  );
});
