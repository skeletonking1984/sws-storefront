// node --test app/lib/commissionInquiry.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInquiryEmail,
  cleanOppref,
  cleanUtmValue,
  parseInquiry,
  pickUtm,
} from './commissionInquiry.js';

const form = (entries) => {
  const map = new Map(Object.entries(entries));
  return {get: (k) => (map.has(k) ? map.get(k) : null)};
};

const good = {
  name: 'Ada',
  email: 'ada@example.com',
  platform: 'twitch',
  message: 'A chat box shaped like a lantern, with a matching goal bar.',
  budget: '300-500',
  deadline: 'before Nov 15',
};

test('a complete inquiry has no field errors and no honeypot', () => {
  const r = parseInquiry(form(good));
  assert.deepEqual(r.fieldErrors, {});
  assert.equal(r.honeypot, false);
  assert.equal(r.values.platform, 'twitch');
});

test('deadline is optional', () => {
  const r = parseInquiry(form({...good, deadline: ''}));
  assert.deepEqual(r.fieldErrors, {});
});

test('every required field is reported when empty', () => {
  const r = parseInquiry(form({}));
  assert.deepEqual(Object.keys(r.fieldErrors).sort(), [
    'budget',
    'email',
    'message',
    'name',
    'platform',
  ]);
});

test('bad email, unknown platform and unknown budget are rejected', () => {
  const r = parseInquiry(
    form({...good, email: 'nope', platform: 'tiktok', budget: '5'}),
  );
  assert.ok(r.fieldErrors.email);
  assert.ok(
    r.fieldErrors.platform,
    'tiktok is not a shipped platform for commissions',
  );
  assert.ok(r.fieldErrors.budget);
});

test('a filled honeypot is flagged', () => {
  assert.equal(parseInquiry(form({...good, company: 'Acme'})).honeypot, true);
});

test('long fields are clipped, not trusted', () => {
  const r = parseInquiry(
    form({...good, name: 'x'.repeat(500), message: 'y'.repeat(9000)}),
  );
  assert.equal(r.values.name.length, 100);
  assert.equal(r.values.message.length, 4000);
});

test('utm values keep marketing labels and drop markup and header text', () => {
  assert.equal(cleanUtmValue('chatgpt'), 'chatgpt');
  assert.equal(cleanUtmValue('commissions-test'), 'commissions-test');
  assert.equal(
    cleanUtmValue('<script>alert(1)</script>'),
    'scriptalert1script',
  );
  assert.ok(
    !/[\r\n@<>]/.test(cleanUtmValue('a\r\nBcc: x@y.z')),
    'no line breaks, no angle brackets',
  );
  assert.equal(cleanUtmValue('x'.repeat(300)).length, 100);
  assert.equal(cleanUtmValue(undefined), '');
});

test('pickUtm returns only the four known keys that are present', () => {
  const p = new URLSearchParams(
    'utm_source=chatgpt&utm_campaign=commissions-test&utm_content=a&gclid=zzz&utm_term=no',
  );
  assert.deepEqual(pickUtm(p), {
    utm_source: 'chatgpt',
    utm_campaign: 'commissions-test',
    utm_content: 'a',
  });
});

test('oppref is length capped and character restricted', () => {
  assert.equal(cleanOppref('abc_DEF-123.~'), 'abc_DEF-123.~');
  assert.equal(cleanOppref('a b<c>'), 'abc');
  assert.equal(cleanOppref('z'.repeat(999)).length, 200);
});

test('email carries the answers, the campaign tags and a single line subject', () => {
  const {values, utm} = parseInquiry(
    form({
      ...good,
      utm_source: 'chatgpt',
      utm_campaign: 'commissions-test',
      utm_content: 'b',
    }),
  );
  const mail = buildInquiryEmail({
    values,
    utm,
    pageUrl: 'https://streamwidgetshop.com/pages/custom-widgets',
  });
  assert.ok(!/[\r\n]/.test(mail.subject));
  assert.ok(mail.subject.includes('$300 to $500'));
  for (const needle of [
    'Ada',
    'ada@example.com',
    'Twitch',
    'before Nov 15',
    'lantern',
    'utm_source: chatgpt',
    'utm_content: b',
  ]) {
    assert.ok(mail.text.includes(needle), `missing ${needle}`);
  }
});

test('no dashes of the em or en kind in any copy this module can emit', () => {
  const {values, utm} = parseInquiry(form(good));
  const mail = buildInquiryEmail({values, utm});
  assert.ok(!/[–\u2014]/.test(mail.subject + mail.text));
});
