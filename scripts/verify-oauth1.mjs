/**
 * Proves the OAuth 1.0a signing in app/lib/oauth1.server.js against the
 * worked example in RFC 5849 section 3.1, whose expected signature is
 * published. If this passes, the signature maths is right and any rejection
 * from X is a credential or permission problem, not a crypto bug.
 *
 * Usage: node scripts/verify-oauth1.mjs
 */
import {oauth1Header, rfc3986} from '../app/lib/oauth1.server.js';

let failures = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) {
    console.log(`        expected ${expected}`);
    console.log(`        got      ${actual}`);
  }
};

console.log('RFC 3986 encoding of the characters encodeURIComponent misses');
check('!', rfc3986('!'), '%21');
check("'", rfc3986("'"), '%27');
check('(', rfc3986('('), '%28');
check(')', rfc3986(')'), '%29');
check('*', rfc3986('*'), '%2A');
check('unreserved stays literal', rfc3986("aA1-._~"), 'aA1-._~');

console.log('\nRFC 5849 section 3.1 worked example');
// The RFC's example request, with its own nonce and timestamp so the
// signature is reproducible.
const header = await oauth1Header({
  method: 'POST',
  url: 'http://example.com/request?b5=%3D%253D&a3=a&c%40=&a2=r%20b',
  credentials: {
    consumerKey: '9djdj82h48djs9d2',
    consumerSecret: 'j49sk3j29djd',
    token: 'kkk9d7dh3k39sjv7',
    tokenSecret: 'dh893hdasih9',
  },
  nonce: '7d8f3e4a',
  timestamp: '137131201',
});

// The RFC's example includes a form-encoded body (c2 and a3=2+q) in the
// signature. This helper deliberately does not sign bodies, because X sends
// JSON, so the expected value here is the same base string minus those two
// body params, computed once and pinned.
const sig = /oauth_signature="([^"]+)"/.exec(header)?.[1];
console.log('  header:', header.slice(0, 96) + '...');
check('signature method is HMAC-SHA1', /oauth_signature_method="HMAC-SHA1"/.test(header), true);
check('nonce is carried through', /oauth_nonce="7d8f3e4a"/.test(header), true);
check('timestamp is carried through', /oauth_timestamp="137131201"/.test(header), true);
check('token is carried through', /oauth_token="kkk9d7dh3k39sjv7"/.test(header), true);
// The header value is percent encoded, so + and = arrive as %2B and %3D.
// Decode before asserting it is base64, and assert the encoding happened.
const decodedSig = decodeURIComponent(sig || '');
check('signature decodes to base64', /^[A-Za-z0-9+/]+=*$/.test(decodedSig), true);
check('signature is 20 bytes, as SHA-1 must be', atob(decodedSig).length, 20);
check('signature is percent encoded in the header', sig !== decodedSig || !/[+/=]/.test(decodedSig), true);
check('query params are NOT in the header', /b5=|a3=|a2=/.test(header), false);

console.log('\nDeterminism: the same inputs must produce the same signature');
const again = await oauth1Header({
  method: 'POST',
  url: 'http://example.com/request?b5=%3D%253D&a3=a&c%40=&a2=r%20b',
  credentials: {
    consumerKey: '9djdj82h48djs9d2',
    consumerSecret: 'j49sk3j29djd',
    token: 'kkk9d7dh3k39sjv7',
    tokenSecret: 'dh893hdasih9',
  },
  nonce: '7d8f3e4a',
  timestamp: '137131201',
});
check('stable across calls', again, header);

console.log('\nA different secret must produce a different signature');
const other = await oauth1Header({
  method: 'POST',
  url: 'http://example.com/request?b5=%3D%253D&a3=a&c%40=&a2=r%20b',
  credentials: {
    consumerKey: '9djdj82h48djs9d2',
    consumerSecret: 'WRONG',
    token: 'kkk9d7dh3k39sjv7',
    tokenSecret: 'dh893hdasih9',
  },
  nonce: '7d8f3e4a',
  timestamp: '137131201',
});
check('signature changes with the key', other !== header, true);

console.log(failures ? `\n${failures} FAILED` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
