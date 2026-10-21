// node --test app/lib/nowPlayingBeta.test.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeNowPlayingBody,
  sanitizeNowPlayingPage,
  BETA_MARKER,
} from './nowPlayingBeta.js';

const BODY =
  '<p class="intro">Hi</p><p style="display:flex;gap:.75rem"><a class="sws-btn" href="https://cdn.shopify.com/s/files/1/0000/0000/files/SWS-Now-Playing-BETA.zip?v=1">Download the free beta</a><a href="https://discord.gg/x">Discord</a></p><h4>Beta</h4><p>Free while we test. Rest.</p>';

test('strips every zip link and url', () => {
  const out = sanitizeNowPlayingBody(
    BODY +
      '<span data-x="https://cdn.shopify.com/s/files/SWS-Now-Playing-BETA.zip?v=1"></span>',
  );
  assert.ok(!/SWS-Now-Playing-BETA/i.test(out));
  assert.ok(!/Download the free beta/.test(out));
  assert.ok(out.includes('discord.gg/x'));
});

test('puts the gate marker where the download button was, once', () => {
  const out = sanitizeNowPlayingBody(BODY);
  assert.equal(out.split(BETA_MARKER).length - 1, 1);
  assert.ok(out.indexOf(BETA_MARKER) < out.indexOf('discord.gg'));
  const again = sanitizeNowPlayingBody(out);
  assert.equal(again.split(BETA_MARKER).length - 1, 1);
});

test('strips the renamed early access zip too, url and bare filename', () => {
  const out = sanitizeNowPlayingBody(
    BODY +
      '<a href="https://cdn.shopify.com/s/files/SWS-Now-Playing-Early-Access.zip?v=1">Get it</a>' +
      '<p>File: SWS-Now-Playing-Early-Access.zip</p>',
  );
  assert.ok(!/SWS-Now-Playing-(BETA|Early-Access)/i.test(out));
});

test('maps beta and free framing to Early access in body, title and seo', () => {
  const out = sanitizeNowPlayingPage({
    handle: 'now-playing',
    title: 'Now Playing Widgets: Free Beta',
    body: BODY,
    seo: {
      title: 'Now Playing Widgets: Beta',
      description: 'Now Playing Widgets: Free Beta: x',
    },
  });
  assert.equal(out.title, 'Now Playing Widgets: Early Access');
  assert.equal(out.seo.title, 'Now Playing Widgets: Early Access');
  assert.equal(out.seo.description, 'Now Playing Widgets: Early Access: x');
  assert.ok(!/free/i.test(out.title + out.body + out.seo.description));
  assert.ok(!/beta/i.test(out.title + out.seo.title + out.seo.description));
  assert.match(out.body, /Early access \u00b7 10 spots\./);
  assert.match(out.body, /<h4>Early access<\/h4>/);
});

test('body drift: any beta wording in text becomes early access, tags and hrefs untouched', () => {
  const out = sanitizeNowPlayingBody(
    '<h4>Beta</h4><p>Limited beta: 10 spots. Join the beta today. Free Beta rocks.</p><a href="/b/now-playing/beta">x</a>',
  );
  const visible = out.replace(/<[^>]*>/g, ' ');
  assert.ok(!/beta/i.test(visible), visible);
  assert.ok(!/free/i.test(visible), visible);
  assert.ok(out.includes('href="/b/now-playing/beta"'));
  assert.ok(out.includes(BETA_MARKER));
});

test('leaves other pages alone', () => {
  const page = {handle: 'faq', title: 'Free Beta', body: BODY};
  assert.deepEqual(sanitizeNowPlayingPage(page), page);
});
