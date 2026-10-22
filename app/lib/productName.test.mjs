import test from 'node:test';
import assert from 'node:assert/strict';
import {subjectFromTitle} from './productName.js';

// Run: node --test app/lib/productName.test.mjs
const cases = [
  [
    'Demon Samurai Stream Overlay Pack, Animated Katana Goal Bar, Multistream Chat, Alerts (Digital Download)',
    'Demon Samurai Stream Overlay Pack',
  ],
  [
    'Boba Drink Goal Widget for Twitch | Cute Progress Bar | StreamElements Streamlabs OBS',
    'Boba Drink Goal Widget',
  ],
  [
    'Rabbit Goal Widget, Liquid Fill Animation, StreamElements OBS',
    'Rabbit Goal Widget',
  ],
  [
    'Matcha Scrapbook Chat Widget: Cottagecore Twitch, YouTube, Kick Overlay',
    'Matcha Scrapbook Chat Widget',
  ],
  [
    'Cute Peach Glass Goal Widget-Cute Minimal Customizable Goal Widget for Twitch -Streamelements StreamLabs OBS',
    'Cute Peach Glass Goal Widget',
  ],
  // A comma INSIDE the name must survive.
  [
    'Water, Fire, Nature & Cloud Liquid Filling Goal Widget is fully customisable for Twitch Streamlabs and Streamelements',
    'Water, Fire, Nature & Cloud Liquid Filling Goal Widget',
  ],
  // A hyphen INSIDE the name must survive.
  [
    'Multi-Goal Slider Widget | Follow, Sub & Tip Goals for Twitch, YouTube, Kick',
    'Multi-Goal Slider Widget',
  ],
  ['Spooky Stream Kit | 8 Animated Halloween Chat & Goal Widgets', 'Spooky Stream Kit'],
];

for (const [title, want] of cases) {
  test(`subjectFromTitle: ${want}`, () => {
    assert.equal(subjectFromTitle(title), want);
  });
}

test('subjectFromTitle never returns an empty name for a real title', () => {
  for (const t of ['(Digital Download)', '|', 'Kit, Widget']) {
    assert.ok(subjectFromTitle(t).length > 0, t);
  }
});
