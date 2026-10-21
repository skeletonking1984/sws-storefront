// node --test app/lib/newsletterNotice.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildSignupNotice} from './newsletterNotice.js';

const base = {email: 'user@example.com', shortName: 'SWS'};
const ok = {ok: true, state: 'created'};

test('popup source keeps the exact newsletter wording', () => {
  const n = buildSignupNotice({
    ...base,
    source: 'launch popup',
    subscribed: ok,
  });
  assert.equal(n.subject, 'SWS newsletter signup: user@example.com');
  assert.equal(
    n.text,
    [
      'New newsletter signup (launch popup).',
      '',
      'user@example.com',
      '',
      'Shopify marketing list: created',
    ].join('\n'),
  );
});

test('homepage source is also unchanged newsletter wording', () => {
  const n = buildSignupNotice({...base, source: 'homepage', subscribed: ok});
  assert.equal(n.subject, 'SWS newsletter signup: user@example.com');
  assert.ok(n.text.startsWith('New newsletter signup (homepage).'));
});

test('newsletter source NOT ON LIST keeps the state in the subject', () => {
  const n = buildSignupNotice({
    ...base,
    source: 'launch popup',
    subscribed: {ok: false, state: 'skipped', reason: 'no token'},
  });
  assert.equal(
    n.subject,
    'SWS newsletter signup (NOT ON LIST: skipped): user@example.com',
  );
  assert.ok(n.text.includes('Shopify marketing list: skipped (no token)'));
});

test('early access granted', () => {
  const n = buildSignupNotice({
    ...base,
    source: 'now-playing-beta',
    subscribed: ok,
    betaTag: 'GRANTED 1/10',
  });
  assert.equal(
    n.subject,
    '[GRANTED 1/10] Now Playing early access signup: user@example.com',
  );
  assert.ok(
    n.text.startsWith(
      'New Now Playing early access signup (now-playing-beta).',
    ),
  );
  assert.ok(n.text.includes('Shopify marketing list: created'));
  assert.ok(n.text.includes('Now Playing early access: GRANTED 1/10'));
  assert.ok(!/newsletter/i.test(n.subject + n.text));
});

test('early access waitlist', () => {
  const n = buildSignupNotice({
    ...base,
    source: 'now-playing-beta',
    subscribed: ok,
    betaTag: 'WAITLIST',
  });
  assert.equal(
    n.subject,
    '[WAITLIST] Now Playing early access signup: user@example.com',
  );
});

test('early access claim error', () => {
  const n = buildSignupNotice({
    ...base,
    source: 'now-playing-beta',
    subscribed: ok,
    betaTag: 'CLAIM ERROR: worker 500',
  });
  assert.equal(
    n.subject,
    '[CLAIM ERROR: worker 500] Now Playing early access signup: user@example.com',
  );
});

test('early access NOT ON LIST keeps the tag prefix and the state', () => {
  const n = buildSignupNotice({
    ...base,
    source: 'now-playing-beta',
    subscribed: {ok: false, state: 'skipped'},
    betaTag: 'GRANTED 3/10',
  });
  assert.equal(
    n.subject,
    '[GRANTED 3/10] Now Playing early access signup (NOT ON LIST: skipped): user@example.com',
  );
});

test('a non-beta source never gets an early access tag line unless one is passed', () => {
  const n = buildSignupNotice({
    ...base,
    source: 'launch popup',
    subscribed: ok,
  });
  assert.ok(!n.text.includes('Now Playing beta:'));
  assert.ok(!n.subject.startsWith('['));
});
