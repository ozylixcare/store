'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../scripts/auth-core.js'), 'utf8');
const slice = (a, b) => source.slice(source.indexOf(a), source.indexOf(b, source.indexOf(a)));
const token = (email, exp = Math.floor(Date.now() / 1000) + 3600) =>
  'header.' + Buffer.from(JSON.stringify({ email, exp })).toString('base64url') + '.signature';
function harness(reply) {
  const values = new Map();
  const events = [];
  const requests = [];
  const context = vm.createContext({
    console: { error() {}, warn() {} }, Date, Number, String, JSON, Boolean,
    atob: s => Buffer.from(s, 'base64').toString(),
    window: { location: { origin: 'https://www.ozylix.com' } },
    document: { getElementById: () => null },
    localStorage: { getItem: k => values.get(k), setItem: (k, v) => values.set(k, v) },
    API_BASE: 'https://api.example.test',
    fetchWithTimeout: async (url, options) => { requests.push({ url, body: JSON.parse(options.body) }); return reply(); },
    _showAuthFeedback: (kind, message) => events.push({ kind, message }),
    closeAuth: () => events.push('close'), updateAccountNavBtn: () => events.push('account'),
    autofillCheckoutFromGoogle() {}, showToast: () => events.push('welcome'),
    resumeCheckoutIfWaiting: () => events.push('resume'), postLoginRedirect() {},
    setTimeout: callback => callback(),
  });
  vm.runInContext(slice('function parseGoogleJWT(', '// ── Core: called after') +
    slice('async function handleGoogleCredential(', '// ── Show inline feedback'), context);
  return { context, values, events, requests };
}
async function main() {
  const user = { email: 'shopper@example.test', name: 'Shopper' };
  const jwt = token(user.email);
  for (const input of [{ credential: 'google-id-token' }, { code: 'google-code' }]) {
    const h = harness(() => ({ ok: true, json: async () => ({ token: jwt, user }) }));
    await h.context.handleGoogleCredential(input);
    assert.equal(h.values.get('asc_jwt'), jwt);
    assert.deepEqual(JSON.parse(h.values.get('asc_user')), user);
    assert.ok(h.events.includes('account'));
    assert.ok(h.events.includes('welcome'));
    const request = h.requests[0];
    assert.equal(request.url, 'https://api.example.test/api/auth/' + (input.code ? 'google-code' : 'google'));
    if (input.code) assert.equal(request.body.redirect_uri, 'https://www.ozylix.com');
  }
  const badSessions = [ {}, { user }, { token: jwt }, { token: 'invalid', user },
    { token: token(user.email, 1), user }, { token: token('other@example.test'), user } ];
  for (const session of badSessions) {
    const h = harness(() => ({ ok: true, json: async () => session }));
    await h.context.handleGoogleCredential({ code: 'code' });
    assert.equal(h.values.size, 0);
    assert.ok(!h.events.includes('welcome'));
    assert.ok(!h.events.includes('resume'));
    assert.ok(h.events.some(e => e.kind === 'error'));
  }
  for (const status of [400, 401, 403, 429]) {
    const h = harness(() => ({ ok: false, status }));
    await h.context.handleGoogleCredential({ credential: 'rejected' });
    assert.equal(h.requests.length, 1, 'permanent rejection must not retry');
    assert.equal(h.values.size, 0);
    assert.ok(!h.events.includes('welcome'));
  }
  const timeout = harness(() => { throw Error('timeout'); });
  await timeout.context.handleGoogleCredential({ code: 'single-use' });
  assert.equal(timeout.requests.length, 1, 'never replay an authorization code');
  assert.equal(timeout.values.size, 0);
  const popup = {};
  const h = harness(() => ({ ok: true, json: async () => ({ token: jwt, user }) }));
  h.context.GOOGLE_CLIENT_ID = 'client';
  h.context._isMobileBrowser = () => false;
  h.context._isSafariBrowser = () => false;
  h.context.google = { accounts: { oauth2: { initCodeClient(options) {
    popup.options = options; return { requestCode() { popup.requested = true; } };
  } } } };
  vm.runInContext(slice('function _tryOAuth2Popup(', '// ── Public: triggered'), h.context);
  h.context._tryOAuth2Popup();
  assert.equal(popup.options.ux_mode, 'popup');
  assert.equal(popup.requested, true);
  await popup.options.callback({ code: 'provider-code' });
  assert.equal(h.requests[0].body.code, 'provider-code');
  assert.equal(h.values.get('asc_jwt'), jwt);
  assert.ok(!source.includes('_buildSyntheticCredential'), 'synthetic credentials must be absent');
  for (const path of ['../index.html', '../about/index.html']) {
    assert.ok(fs.readFileSync(require.resolve(path), 'utf8').includes('/scripts/auth-core.min.js?v=20261001-google-session'));
  }
  console.log('Google session: ID token/code success, invalid sessions, rejection, timeout, popup and page assets passed');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
