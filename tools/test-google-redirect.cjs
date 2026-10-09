'use strict';
// Provider and backend doubles exercise a real page unload/return. No real
// Google code, customer credentials or production account writes are used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium, webkit, firefox, devices } = require('playwright');
const root = path.resolve(__dirname, '..');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/cutout-products.json')));
const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json'};
const server = http.createServer((req,res) => {
  let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file,'index.html');
  if (!fs.existsSync(file)) file = path.join(root,'index.html');
  res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
});
const user = {id:123,email:'shopper@example.test',name:'Test Shopper'};
const token = 'header.' + Buffer.from(JSON.stringify({...user,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url') + '.signature';
async function main() {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const engine = process.env.GOOGLE_BROWSER || 'chrome';
  const browserType = {chrome:chromium,edge:chromium,webkit,firefox}[engine];
  assert.ok(browserType,'supported test browser');
  const browser = await browserType.launch(engine === 'chrome' ? {channel:'chrome'} : engine === 'edge' ? {channel:'msedge'} : {});
  const profile = process.env.GOOGLE_PROFILE || 'android';
  try {
    for (const scenario of JSON.parse(process.env.GOOGLE_SCENARIOS || '["mobile","popup","unprepared","mismatch","missing","expired","cancelled","rejected","back"]')) {
      const mobile = scenario !== 'popup';
      const mobileOptions = profile === 'iphone' ? devices['iPhone 13'] :
        profile === 'ipad' ? devices['iPad (gen 7)'] :
        profile === 'ipad-desktop' ? {viewport:{width:810,height:1080},isMobile:true,hasTouch:true,
          userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15'} :
        {viewport:{width:390,height:844},isMobile:true,hasTouch:true,
          userAgent:'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36'};
      const contextOptions = mobile ? {...mobileOptions} : {viewport:{width:1440,height:1000}};
      if (engine === 'firefox') delete contextOptions.isMobile;
      const context = await browser.newContext({...contextOptions,serviceWorkers:'block'});
      if (mobile && profile === 'ipad-desktop') await context.addInitScript(() => {
        Object.defineProperty(navigator,'platform',{get:()=> 'MacIntel'});
        Object.defineProperty(navigator,'maxTouchPoints',{get:()=>5});
      });
      const states = new Map(), exchanges = [], used = new Set();
      await context.route('**/*',async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.pathname.startsWith('/api/')) {
          let data = {data:[],products:[],banners:[]}, status = 200;
          if (url.pathname.endsWith('/products')) data = fixture;
          if (url.pathname === '/api/auth/google-config') {
            assert.match(url.searchParams.get('binding'),/^[a-f0-9]{64}$/);
            const state = crypto.randomBytes(32).toString('hex');
            states.set(state,url.searchParams.get('binding'));
            data = {client_id:'test-client',redirect_uri:origin,state,expires_in:600};
          }
          if (url.pathname === '/api/auth/google-code') {
            const body = req.postDataJSON(); exchanges.push(body);
            assert.equal(req.headers()['x-requested-with'],'XMLHttpRequest');
            assert.equal(body.redirect_uri,origin);
            assert.ok(['popup','redirect'].includes(body.flow));
            assert.equal(crypto.createHash('sha256').update(body.verifier).digest('hex'),states.get(body.auth_state));
            assert.ok(!used.has(body.auth_state),'a nonce must be sent only once'); used.add(body.auth_state);
            status = scenario === 'rejected' ? 401 : 200;
            data = status === 200 ? {user,token} : {error:'Could not verify sign-in'};
          }
          await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)}); return;
        }
        if (url.origin === origin) await route.continue();
        else await route.fulfill({status:200,contentType:'text/plain',body:''});
      });
      await context.addInitScript(({scenario}) => {
        window.google = {accounts:{id:{initialize(){}},oauth2:{initCodeClient(options) {
          window.testProviderFlow = options.ux_mode;
          return {requestCode() {
            if (scenario === 'back' && !sessionStorage.getItem('test_back')) {sessionStorage.setItem('test_back','1'); return;}
            if (options.ux_mode === 'popup') { options.callback({code:'test-only-code',state:options.state}); return; }
            if (scenario === 'missing') sessionStorage.removeItem('ozylix.google_flow');
            if (scenario === 'expired') {
              const c = JSON.parse(sessionStorage.getItem('ozylix.google_flow')); c.expiresAt=1;
              sessionStorage.setItem('ozylix.google_flow',JSON.stringify(c));
            }
            const p = new URLSearchParams({state:scenario === 'mismatch'?'wrong-state':options.state,utm_source:'preserved'});
            p.set(scenario === 'cancelled'?'error':'code',scenario === 'cancelled'?'access_denied':'test-only-code');
            location.assign(location.origin + '/?' + p);
          }};
        }}}};
        localStorage.setItem('ozylix.notification.preference.v1','never');
      },{scenario});
      const page = await context.newPage();
      await page.goto(origin,{waitUntil:'load'});
      await page.waitForFunction(()=>typeof openAuth==='function');
      await page.evaluate(()=>{
        localStorage.setItem('ozylix-position',JSON.stringify({page:'home',scrollY:0,at:Date.now()}));
      });
      await page.locator('#appNav-account:visible, #accountNavBtn:visible').first().click();
      await page.waitForFunction(()=>!!_googleOAuthContext);
      if (scenario === 'unprepared') await page.evaluate(()=>{_googleOAuthContext=null;});
      await page.locator('#googleSignInBtn').click();
      if (scenario === 'back') {
        await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
        assert.equal(await page.evaluate(()=>_googleFlowStarting),false);
        await page.waitForFunction(()=>!!_googleOAuthContext);
        await page.locator('#googleSignInBtn').click();
      }
      const success = ['mobile','popup','unprepared','back'].includes(scenario);
      if (success) {
        await page.waitForFunction(()=>typeof getCurrentUser==='function' && !!getCurrentUser() && document.querySelector('#page-account.active'),null,{timeout:30000});
        await page.waitForTimeout(1400); // Saved position used to undo the account route.
        assert.equal(await page.evaluate(()=>currentPage),'account');
        assert.equal(await page.evaluate(()=>getCurrentUser().id),123);
        assert.equal(await page.locator('#authOverlay.open').count(),0);
        assert.equal(exchanges.length,1);
        assert.equal(exchanges[0].flow,scenario === 'popup'?'popup':'redirect');
        await page.reload({waitUntil:'domcontentloaded'});
        await page.waitForFunction(()=>typeof getCurrentUser==='function' && !!getCurrentUser(),null,{timeout:30000});
        assert.equal(exchanges.length,1,'refresh must not replay the authorization code');
      } else {
        await page.waitForURL(/utm_source=preserved/);
        await page.locator('#authOverlay.open').waitFor();
        assert.equal(await page.evaluate(()=>getCurrentUser()),null);
        assert.ok((await page.locator('#authError').innerText()).length > 0);
        assert.equal(exchanges.length,scenario === 'rejected'?1:0);
      }
      if (scenario !== 'popup') {
        const url = new URL(page.url());
        assert.equal(url.searchParams.has('code'),false);
        assert.equal(url.searchParams.has('state'),false);
        assert.equal(await page.evaluate(()=>sessionStorage.getItem('ozylix.google_flow')),null);
        assert.equal(await page.locator('#g-spinner').count(),0);
      }
      console.log('PASS Google full flow: '+engine+'/'+profile+'/'+scenario);
      await context.close();
    }
  } finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
}
main().catch(err=>{console.error(err);process.exitCode=1;server.close();});
