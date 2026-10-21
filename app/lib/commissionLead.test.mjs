// node --test app/lib/commissionLead.test.mjs
// The analytics half of the commission landing page: event mapping, the
// ChatGPT Ads server call and the browser adapter's no-op guarantees.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEvent} from './analytics/events.js';
import {
  isConfigured,
  sendLeadCreated,
  readOpprefCookie,
} from './conversions/openaiAds.server.js';
import * as openaiPixel from './analytics/pixels/openai.js';

test('custom_lead_submitted becomes generate_lead with utm and the dedup id, and no PII', () => {
  const e = normalizeEvent('custom_lead_submitted', {
    source: 'custom-widgets',
    eventId: 'lead_1',
    utm: {
      utm_source: 'chatgpt',
      utm_campaign: 'commissions-test',
      utm_content: 'a',
    },
    email: 'must-not-appear@example.com',
  });
  assert.deepEqual(e, {
    name: 'generate_lead',
    method: 'custom-widgets',
    eventId: 'lead_1',
    utm_source: 'chatgpt',
    utm_campaign: 'commissions-test',
    utm_content: 'a',
  });
});

test('a lead with no campaign tags carries none', () => {
  const e = normalizeEvent('custom_lead_submitted', {source: 'custom-widgets'});
  assert.deepEqual(e, {name: 'generate_lead', method: 'custom-widgets'});
});

test('the free chat signup lead is unchanged', () => {
  assert.deepEqual(
    normalizeEvent('custom_signup_confirmed', {source: 'free-chat'}),
    {
      name: 'generate_lead',
      method: 'free-chat',
    },
  );
});

test('OpenAI server call is a no-op unless both env vars are set', async () => {
  assert.equal(isConfigured({}), false);
  assert.equal(isConfigured({PUBLIC_OPENAI_PIXEL_ID: 'p'}), false);
  const r = await sendLeadCreated({
    env: {PUBLIC_OPENAI_PIXEL_ID: 'p'},
    eventId: 'x',
    sourceUrl: 'u',
  });
  assert.deepEqual(r, {ok: false, reason: 'not_configured'});
});

test('OpenAI server call posts the documented shape with the shared id and oppref', async () => {
  const real = globalThis.fetch;
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = {url, init};
    return {ok: true};
  };
  try {
    const r = await sendLeadCreated({
      env: {
        PUBLIC_OPENAI_PIXEL_ID: 'pix 1',
        PRIVATE_OPENAI_CONVERSIONS_API_KEY: 'k',
      },
      eventId: 'lead_9',
      sourceUrl: 'https://streamwidgetshop.com/pages/custom-widgets',
      oppref: 'ref1',
      now: 1700000000000,
    });
    assert.deepEqual(r, {ok: true});
    assert.equal(seen.url, 'https://bzr.openai.com/v1/events?pid=pix%201');
    assert.equal(seen.init.headers.Authorization, 'Bearer k');
    assert.deepEqual(JSON.parse(seen.init.body), {
      events: [
        {
          id: 'lead_9',
          type: 'lead_created',
          timestamp_ms: 1700000000000,
          action_source: 'web',
          source_url: 'https://streamwidgetshop.com/pages/custom-widgets',
          oppref: 'ref1',
          data: {type: 'customer_action'},
        },
      ],
    });
  } finally {
    globalThis.fetch = real;
  }
});

test('OpenAI server call reports failure instead of pretending', async () => {
  const real = globalThis.fetch;
  try {
    globalThis.fetch = async () => ({ok: false, status: 401});
    const env = {
      PUBLIC_OPENAI_PIXEL_ID: 'p',
      PRIVATE_OPENAI_CONVERSIONS_API_KEY: 'k',
    };
    assert.deepEqual(
      await sendLeadCreated({env, eventId: 'x', sourceUrl: 'u'}),
      {ok: false, reason: 'http_401'},
    );
    globalThis.fetch = async () => {
      throw new Error('boom');
    };
    assert.deepEqual(
      await sendLeadCreated({env, eventId: 'x', sourceUrl: 'u'}),
      {ok: false, reason: 'send_failed'},
    );
  } finally {
    globalThis.fetch = real;
  }
});

test('oppref cookie is read from the request', () => {
  const req = new Request('https://x.test/', {
    headers: {Cookie: 'a=1; __oppref=abc%2D123; b=2'},
  });
  assert.equal(readOpprefCookie(req), 'abc-123');
  assert.equal(readOpprefCookie(new Request('https://x.test/')), '');
});

test('browser pixel adapter is inert without an id', () => {
  assert.equal(openaiPixel.isConfigured({}), false);
  assert.equal(openaiPixel.isConfigured({pixelId: 'p'}), true);
  // No window in node: both must return quietly rather than throw.
  openaiPixel.loadScript({}, 'n');
  openaiPixel.send({name: 'generate_lead', method: 'custom-widgets'}, {});
});
