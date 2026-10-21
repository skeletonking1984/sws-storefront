/**
 * Asserts the first-party GA4 session behaves the way GA4's own does.
 *
 * WHY THIS IS WORTH TESTING HARD. The bug it fixes was silent for days: four
 * of seven live orders carried a client id and no session id, GA4 quietly
 * attached each purchase to whatever session was open, and the Landing page
 * report showed $0 against `/` with 92 sessions while the revenue sat on a
 * checkout URL. Nothing errored. Nothing was missing from any dashboard. The
 * numbers were just attached to the wrong page.
 *
 * A session is also exactly the kind of thing that looks right and is wrong:
 * off-by-one on the timeout, a number that resets instead of incrementing, a
 * cookie that expires with the session and silently makes every returning
 * visitor "session 1" forever. Each is invisible in production.
 *
 *   node scripts/verify-first-party-session.mjs
 */
const R = new URL('..', import.meta.url).pathname;
const {
  ensureFirstPartySession,
  readFirstPartySession,
  SESSION_TIMEOUT_SECONDS,
  FIRST_PARTY_SESSION_COOKIE,
} = await import(`${R}/app/lib/firstPartySession.server.js`);

const pass = [], fail = [];
function check(name, ok, detail) {
  (ok ? pass : fail).push(name);
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `  [${detail}]` : ''}`);
}
const req = (cookie, url = 'https://streamwidgetshop.com/') =>
  new Request(url, {headers: cookie ? {Cookie: cookie} : {}});
const NOW = 1789600000;

console.log('\na visitor with no cookie starts session 1');
{
  const r = ensureFirstPartySession(req(null), NOW);
  check('session id is unix seconds at start', r.sessionId === String(NOW), r.sessionId);
  check('session number is 1', r.sessionNumber === '1', r.sessionNumber);
  check('a cookie is set', Boolean(r.setCookie));
}

console.log('\ncookie flags');
{
  const {setCookie} = ensureFirstPartySession(req(null), NOW);
  check('HttpOnly, so a blocker has nothing to strip', setCookie.includes('HttpOnly'));
  check('Secure on an https request', setCookie.includes('Secure'));
  check('SameSite=Lax', setCookie.includes('SameSite=Lax'));
  // THE TRAP: expiring the cookie with the session would reset session_number
  // to 1 on every return visit, making new-vs-returning permanently wrong.
  const maxAge = Number((setCookie.match(/Max-Age=(\d+)/) || [])[1]);
  check('cookie OUTLIVES the session window', maxAge > SESSION_TIMEOUT_SECONDS * 100, `${maxAge}s`);
  const http = ensureFirstPartySession(req(null, 'http://localhost:3000/'), NOW);
  check('no Secure on plain http (local dev)', !http.setCookie.includes('Secure'));
}

console.log('\nan active visitor keeps the SAME session');
{
  const first = ensureFirstPartySession(req(null), NOW);
  const cookie = `${FIRST_PARTY_SESSION_COOKIE}=${first.setCookie.split(';')[0].split('=')[1]}`;
  for (const gap of [1, 60, SESSION_TIMEOUT_SECONDS - 1, SESSION_TIMEOUT_SECONDS]) {
    const r = ensureFirstPartySession(req(cookie), NOW + gap);
    check(`+${gap}s still session 1, same id`,
      r.sessionId === String(NOW) && r.sessionNumber === '1',
      `${r.sessionId}/${r.sessionNumber}`);
  }
}

console.log('\ngoing quiet past the window starts a NEW session, same visitor');
{
  const first = ensureFirstPartySession(req(null), NOW);
  const cookie = `${FIRST_PARTY_SESSION_COOKIE}=${first.setCookie.split(';')[0].split('=')[1]}`;
  const later = NOW + SESSION_TIMEOUT_SECONDS + 1;
  const r = ensureFirstPartySession(req(cookie), later);
  check('new session id', r.sessionId === String(later), r.sessionId);
  // INCREMENTS, never resets. A reset would report every returning buyer as new.
  check('session number increments to 2', r.sessionNumber === '2', r.sessionNumber);
}

console.log('\nthe window slides off the LAST REQUEST, not off session start');
{
  // A visitor browsing steadily for 45 minutes is ONE session in GA4. Measuring
  // from session start instead of last activity would cut them in half.
  let cookie = null, r;
  for (let t = 0; t <= 45 * 60; t += 10 * 60) {
    r = ensureFirstPartySession(req(cookie), NOW + t);
    if (r.setCookie) cookie = r.setCookie.split(';')[0];
  }
  check('45 minutes of steady browsing stays ONE session',
    r.sessionId === String(NOW) && r.sessionNumber === '1',
    `${r.sessionId}/${r.sessionNumber}`);
}

console.log('\nmalformed cookies are rejected, not half parsed');
for (const bad of ['', 'garbage', '123.456', 'a.b.c', '123.1.notanumber', '123.1.2.3']) {
  check(`rejects "${bad}"`, readFirstPartySession(`${FIRST_PARTY_SESSION_COOKIE}=${bad}`) === undefined);
}

console.log('\nprecedence: GA4\'s own cookie always wins');
{
  const {readClickIds} = await import(`${R}/app/lib/clickIds.server.js`);
  const env = {PUBLIC_GA4_MEASUREMENT_ID: 'G-X0978HDVTK'};
  const gaReal = '_ga_X0978HDVTK=GS2.1.s1789350851$o7$g1$t1789351798$j60$l0$h0';
  const ours = `${FIRST_PARTY_SESSION_COOKIE}=1789600000.3.1789600000`;

  const both = readClickIds(req(`${gaReal}; ${ours}`), env);
  check('gtag session wins when present', both._ga_session_id === '1789350851', both._ga_session_id);
  check('gtag session NUMBER wins too', both._ga_session_number === '7', both._ga_session_number);

  const onlyOurs = readClickIds(req(ours), env);
  check('ours is used when gtag is absent', onlyOurs._ga_session_id === '1789600000', onlyOurs._ga_session_id);
  check('ours supplies the number too', onlyOurs._ga_session_number === '3', onlyOurs._ga_session_number);

  const neither = readClickIds(req('sws_cid=1.2'), env);
  check('no session at all when neither exists', neither._ga_session_id === undefined);
}

console.log(`\n${pass.length} passed, ${fail.length} failed`);
if (fail.length) { for (const f of fail) console.error('  FAIL ' + f); process.exit(1); }
console.log('PASS: a purchase can always carry a session, and gtag still owns the truth.');
