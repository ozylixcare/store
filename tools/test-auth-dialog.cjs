'use strict';
// Run with Node, Playwright and @axe-core/playwright installed. All APIs are mocked;
// this test never creates a production account or sends a recovery email.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');
const { default: AxeBuilder } = require('@axe-core/playwright');
const root = path.resolve(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/cutout-products.json')));
const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json'};
const server = http.createServer((req,res) => {
  let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file,'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
const user = {id: 123, email:'shopper@example.test', name:'Test Shopper'};
const token = 'header.' + Buffer.from(JSON.stringify({...user,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url') + '.signature';
async function main() {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {channel:'chrome'});
  const report = [];
  const shots = process.env.AUTH_SCREENSHOTS;
  if (shots) fs.mkdirSync(shots,{recursive:true});
  try {
    const sizes = JSON.parse(process.env.AUTH_VIEWPORTS || '[[1440,1000],[1024,768],[768,1024],[390,844],[360,640],[320,568],[844,390]]');
    for (const [width,height] of sizes) {
      console.log('Checking '+width+'×'+height);
      const context = await browser.newContext({viewport:{width,height}, isMobile:width<760 || height<500, hasTouch:width<760 || height<500, serviceWorkers:'block', reducedMotion:'reduce'});
      let mode = 'reject';
      const requests = [];
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.pathname.includes('/api/')) {
          let data = {data:[], products:[], banners:[]}, status = 200;
          if (url.pathname.endsWith('/products')) data = fixture;
          if (/\/api\/auth\/(email-login|register|google|google-code)$/.test(url.pathname)) {
            requests.push({path:url.pathname,body:req.postDataJSON()});
            if (mode === 'offline') { await route.abort('failed'); return; }
            status = mode === 'success' ? 200 : 401;
            data = mode === 'success' ? {user,token} : {error:'Please check your sign-in details.'};
          }
          await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)}); return;
        }
        if (url.origin === origin) await route.continue();
        else await route.fulfill({status:200,contentType:'text/plain',body:''});
      });
      const page = await context.newPage();
      await page.goto(origin, {waitUntil:'load'});
      await page.waitForFunction(() => typeof openAuth === 'function');
      const trigger = width > 768 ? '#accountNavBtn' : '#appNav-account';
      await page.locator(trigger).focus();
      await page.evaluate(() => openAuth());
      const dialog = page.locator('#authOverlay .auth-box');
      await dialog.waitFor({state:'visible'});
      // Delayed prompts must not steal interaction or focus from sign-in.
      await page.evaluate(()=>showOzylixConsentBar());
      const consent = page.locator('#ozylxConsentBar');
      if (await consent.count()) {
        await page.waitForFunction(()=>document.getElementById('ozylxConsentBar').inert);
        assert.ok(await page.evaluate(()=>Number(getComputedStyle(document.getElementById('authOverlay')).zIndex) > Number(getComputedStyle(document.getElementById('ozylxConsentBar')).zIndex)));
      }
      assert.equal(await dialog.getAttribute('aria-modal'),'true');
      assert.ok(await page.evaluate(() => document.activeElement.classList.contains('auth-box')));
      const bounds = await dialog.boundingBox();
      const viewport = await page.evaluate(()=>({width:innerWidth,height:innerHeight,visualWidth:visualViewport.width,visualHeight:visualViewport.height}));
      assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x+bounds.width <= width+1 && bounds.y+bounds.height <= height+1, 'dialog inside viewport: '+JSON.stringify({bounds,viewport}));
      assert.ok(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth+1), 'no horizontal scroll');
      const closeBounds = await page.locator('.auth-close').boundingBox();
      assert.ok(closeBounds.x > bounds.x + bounds.width - 70 && closeBounds.y < bounds.y + 30, 'close in top right');
      const inputBounds = await page.locator('#loginPassword').boundingBox();
      const toggleBounds = await page.locator('#loginForm .auth-pw-toggle').boundingBox();
      assert.ok(toggleBounds.x > inputBounds.x + inputBounds.width - 52 && Math.abs(toggleBounds.y - inputBounds.y) < 4, 'password toggle inside field');
      assert.ok(await page.locator('.auth-brand').evaluate(el => el.complete && el.naturalWidth>0));
      if (width >= 760) {
        const storyBounds = await page.locator('.auth-story').boundingBox();
        const contentBounds = await page.locator('.auth-content').boundingBox();
        assert.ok(storyBounds.x < contentBounds.x && Math.abs(storyBounds.y-contentBounds.y)<2, 'desktop columns aligned');
        if (height >= 768) assert.ok(await page.locator('#loginSubmitBtn').evaluate(el=>el.getBoundingClientRect().bottom<innerHeight), 'desktop submit visible without scrolling');
        for (const img of await page.locator('.auth-products img').all()) assert.ok(await img.evaluate(el => el.complete && el.naturalWidth>0));
      }
      const loginAxe = await new AxeBuilder({page}).include('#authOverlay').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      assert.deepEqual(loginAxe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[], 'accessible login ' + width);
      if (shots && [1440,390,320].includes(width)) await page.screenshot({path:path.join(shots,'login-'+width+'.png')});
      await page.keyboard.press('Shift+Tab');
      assert.ok(await page.evaluate(() => document.activeElement.closest('.auth-link')), 'backward focus wraps');
      await page.keyboard.press('Tab');
      assert.ok(await page.evaluate(() => document.activeElement.classList.contains('auth-close')), 'forward focus wraps');
      await page.locator('#loginTab').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#registerTab').getAttribute('aria-selected'),'true');
      await page.locator('#regName').fill('Test Shopper');
      await page.locator('#regEmail').fill(user.email);
      await page.locator('#regPassword').fill('StrongTest42!');
      const regToggle = page.locator('#registerForm .auth-pw-toggle');
      await regToggle.click();
      assert.equal(await page.locator('#regPassword').getAttribute('type'),'text');
      assert.equal(await regToggle.getAttribute('aria-label'),'Hide password');
      await regToggle.click();
      assert.equal(await page.locator('#regPassword').getAttribute('type'),'password');
      await page.locator('#registerSubmitBtn').click();
      await page.getByRole('alert').filter({hasText:'Please check'}).waitFor();
      assert.equal(requests.at(-1).path,'/api/auth/register');
      const signupAxe = await new AxeBuilder({page}).include('#authOverlay').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      assert.deepEqual(signupAxe.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[], 'accessible signup ' + width);
      if (shots && width === 390) await page.screenshot({path:path.join(shots,'signup-390.png')});
      await page.locator('#loginTab').click();
      await page.getByRole('button',{name:'Forgot password?'}).click();
      await page.getByRole('alert').filter({hasText:'not available yet'}).waitFor();
      assert.ok(!requests.some(r=>/reset|forgot/.test(r.path)), 'no invented reset request');
      await page.locator('#loginEmail').fill(user.email);
      await page.locator('#loginEmail').press('Enter');
      assert.equal(await page.evaluate(()=>document.activeElement.id),'loginPassword');
      await page.locator('#loginPassword').fill('Password42!');
      await page.locator('#loginPassword').press('Enter');
      await page.getByRole('alert').filter({hasText:'Please check'}).waitFor();
      assert.equal(requests.at(-1).path,'/api/auth/email-login');
      mode = 'offline';
      await page.locator('#loginSubmitBtn').click();
      await page.getByRole('alert').filter({hasText:'temporarily unavailable'}).waitFor();
      assert.equal(await page.evaluate(()=>localStorage.getItem('asc_jwt')),null);
      // Stub the account dashboard, not authentication: verify submitted credentials,
      // server session persistence and modal close without loading unrelated account APIs.
      await page.evaluate(() => { window.postLoginRedirect=()=>{}; });
      mode = 'success';
      await page.locator('#loginSubmitBtn').click();
      await dialog.waitFor({state:'hidden'});
      assert.equal(await page.evaluate(()=>localStorage.getItem('asc_jwt')),token);
      assert.equal(await page.locator('#accountNavBtn').getAttribute('aria-label'),'Open my account');
      await page.evaluate(()=>{ localStorage.removeItem('asc_jwt'); localStorage.removeItem('asc_user'); openAuth('register'); });
      await page.locator('#registerSubmitBtn').click();
      await dialog.waitFor({state:'hidden'});
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('asc_user')).email),user.email);
      // Trigger the same Google button with a provider popup double.
      await page.evaluate(()=>{
        localStorage.removeItem('asc_jwt'); localStorage.removeItem('asc_user');
        window._isMobileBrowser=()=>false; window._isSafariBrowser=()=>false; window._tryOneTap=()=>false;
        window.google = { accounts: {
          id: { initialize(){}, disableAutoSelect(){} },
          oauth2: { initCodeClient(options) { return { requestCode() { options.callback({code:'test-provider-code'}); } }; } }
        } };
        openAuth();
      });
      await page.locator('#googleSignInBtn').click();
      await dialog.waitFor({state:'hidden'});
      assert.equal(requests.at(-1).path,'/api/auth/google-code');
      assert.equal(requests.at(-1).body.code,'test-provider-code');
      await page.evaluate(()=>openAuth());
      await page.keyboard.press('Escape');
      await dialog.waitFor({state:'hidden'});
      assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
      assert.equal(await page.locator('body > [inert]').count(),0,'background restored');
      await page.locator(trigger).focus();
      await page.evaluate(()=>openAuth());
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(()=>document.activeElement.id),trigger.slice(1),'focus returned to caller');
      await page.evaluate(()=>openAuth());
      await page.evaluate(()=>closeAllOverlays());
      await page.waitForFunction(()=>document.querySelectorAll('body > [inert]').length === 0);
      report.push({width,height,login:'pass',signup:'pass',google:'pass',keyboard:'pass',accessibility:'pass'});
      console.log('Passed '+width+'×'+height);
      await context.close();
    }
    // Smoke the independent static entry pages using the same served code.
    const context = await browser.newContext({serviceWorkers:'block'});
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.fulfill({body:''}));
    const page = await context.newPage();
    for (const entry of ['/about/','/shop/','/product/glutathione-effervescent-tablet/','/privacy/']) {
      await page.goto(origin+entry,{waitUntil:'load'});
      await page.evaluate(()=>openAuth());
      assert.equal(await page.locator('.auth-story').count(),1);
      assert.equal(await page.locator('.oz-vita-panel').count(),0);
      await page.locator('#authOverlay .auth-box').waitFor({state:'visible'});
    }
    await context.close();
    console.log(JSON.stringify(report,null,2));
    console.log('Authentication dialog: responsive, mocked auth, keyboard, axe and route smoke checks passed.');
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>server.close());
