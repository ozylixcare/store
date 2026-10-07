const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'scripts/platform-copy.js'), 'utf8');
function setup({ ua = 'Android Chrome/131.0', standalone = false, readyState = 'complete' } = {}) {
  const events = {}, elements = {}, domEvents = {};
  for (const id of ['androidInstallButton', 'androidInstallHelp', 'appInstallStatus', 'androidInstallCard', 'androidInstallGuide']) {
    elements[id] = { textContent: '', disabled: false, classList: { add() {} }, setAttribute() {}, scrollIntoView() {}, focus() { this.focused = true; } };
  }
  const context = { document: { readyState, getElementById: id => elements[id], addEventListener: (name, fn) => { domEvents[name] = fn; } }, navigator: { userAgent: ua, platform: '', maxTouchPoints: 0 }, window: { location: { origin: 'https://ozylix.com' }, matchMedia: () => ({ matches: standalone, addEventListener() {} }), addEventListener: (name, fn) => { events[name] = fn; } } };
  vm.runInNewContext(source, context);
  return { elements, events, domEvents, window: context.window };
}
(async () => {
  let test = setup();
  assert.equal(test.elements.androidInstallButton.textContent, 'Show install steps');
  await test.window.installOzylixAndroid();
  assert(test.elements.androidInstallGuide.focused, 'Fallback must bring visible instructions into view');
  assert.match(test.elements.androidInstallHelp.textContent, /Add to Home screen/);

  test = setup({ readyState: 'loading' });
  let calls = 0, prevented = false, resolveChoice;
  test.events.beforeinstallprompt({ preventDefault() { prevented = true; }, prompt() { calls++; return Promise.resolve(); }, userChoice: new Promise(resolve => { resolveChoice = resolve; }) });
  test.domEvents.DOMContentLoaded();
  assert(prevented);
  assert.equal(test.elements.androidInstallButton.textContent, 'Install Ozylix app', 'Ready state must survive DOM initialization');
  const first = test.window.installOzylixAndroid();
  await test.window.installOzylixAndroid();
  assert.equal(calls, 1, 'A double tap must not reuse the install event');
  resolveChoice({ outcome: 'dismissed' });
  await first;
  assert.equal(test.elements.androidInstallButton.textContent, 'Show install steps');
  assert.match(test.elements.androidInstallHelp.textContent, /cancelled/);
  await test.window.installOzylixAndroid();
  assert.equal(calls, 1);

  test.events.beforeinstallprompt({ preventDefault() {}, prompt() { throw new Error('Browser refused prompt'); } });
  await test.window.installOzylixAndroid();
  assert.match(test.elements.androidInstallHelp.textContent, /could not open/);
  assert.equal(test.elements.androidInstallButton.disabled, false);

  test.events.beforeinstallprompt({ preventDefault() {}, prompt() { test.events.appinstalled(); return Promise.resolve(); }, userChoice: Promise.resolve({ outcome: 'accepted' }) });
  await test.window.installOzylixAndroid();
  assert.equal(test.elements.androidInstallButton.disabled, true);
  assert.equal(test.elements.androidInstallButton.textContent, 'Ozylix installed');
  assert.match(test.elements.androidInstallHelp.textContent, /is installed/);

  test = setup({ ua: 'Android; wv) Instagram' });
  assert.match(test.elements.androidInstallHelp.textContent, /Open this page in Chrome/);
  test = setup({ standalone: true });
  assert.equal(test.elements.androidInstallButton.disabled, true);
  test = setup({ ua: 'iPhone Safari' });
  await test.window.installOzylixAndroid();
  assert.match(test.elements.appInstallStatus.textContent, /Safari/);
  test = setup({ ua: 'Windows Chrome/131.0' });
  await test.window.installOzylixAndroid();
  assert.match(test.elements.appInstallStatus.textContent, /website on this device/);

  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal((html.match(/src="\/scripts\/platform-copy\.js/g) || []).length, 1);
  assert(html.indexOf('src="/scripts/platform-copy.js') < html.indexOf('</head>'), 'Capture install events early');
  assert(html.includes('id="androidInstallGuide"'));
  console.log('Install UX passed: early prompt, fallback focus, double tap, dismissal, prompt error, installed state, in-app browser, iOS and desktop.');
})().catch(error => { console.error(error); process.exitCode = 1; });
