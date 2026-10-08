/* Browser verification with synthetic data; no production requests allowed. */
const {chromium} = require(require.resolve('playwright', {paths:[__dirname, process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES].filter(Boolean)}));
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const base = process.env.ADMIN_PREVIEW_URL || 'http://127.0.0.1:8765';
const root = path.resolve(__dirname, '..');
(async () => {
  const server = process.env.ADMIN_PREVIEW_URL ? null : require('node:http').createServer((req,res) => {
    const pathname = decodeURIComponent(new URL(req.url,base).pathname);
    const file = path.resolve(root, '.'+pathname);
    if (!file.startsWith(root+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    const mime = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
    res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  if (server) await new Promise(resolve=>server.listen(8765,'127.0.0.1',resolve));
  const browser = await chromium.launch({headless:true, ...(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE, args:['--no-sandbox','--disable-dev-shm-usage']} : {})});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1050}});
    let mutations = 0;
    await context.route('**/*', route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === base) return route.continue();
      if (url.hostname === 'backend-s7ih.onrender.com') {
        if (!['GET','HEAD','OPTIONS'].includes(request.method())) mutations++;
        let data = {success:true, data:[], orders:[], products:[], customers:[], stats:{}, logs:[]};
        if (url.pathname === '/api/admin/me') data = {username:'preview',role:'owner'};
        if (url.pathname === '/api/admin/settings') data = {};
        if (url.pathname === '/health' || url.pathname === '/') data = {status:'ok',version:'preview'};
        return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':base,'access-control-allow-headers':'*'},body:JSON.stringify(data)});
      }
      // Third-party SDKs, fonts, telemetry, DB and provider traffic are blocked.
      return route.abort();
    });
    await context.addInitScript(() => {
      sessionStorage.setItem('ozylix_session_schema','20261005-versioned');
      sessionStorage.setItem('ozylix_token','preview.'+btoa(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,role:'owner'}))+'.fixture');
      sessionStorage.setItem('ozylix_role','owner');
    });
    const page = await context.newPage();
    const newErrors = [];
    page.on('pageerror', error => { if (error.stack?.includes('admin-bento')) newErrors.push(error.message); });
    await page.goto(base+'/admin.html');
    await page.locator('#app').waitFor({state:'visible'});
    await page.locator('body.admin-bento.admin-motion-ready').waitFor();
    await page.waitForTimeout(650);
    // Baseline has existing range/chart widgets. Exercise real navigation for
    // every page without changing permissions or executing an admin action.
    const pages = await page.locator('#app .page[id]').evaluateAll(nodes=>nodes.map(n=>n.id.slice(5)));
    for (const name of pages) {
      await page.evaluate(name=>showPage(name),name);
      assert.equal(await page.locator('#page-'+name).evaluate(el=>el.classList.contains('active')),true,name);
      assert.equal(await page.locator('#app .page.active').count(),1);
    }
    await page.evaluate(()=>showPage('settings'));
    await page.getByRole('button',{name:'Reduced',exact:true}).click();
    assert.equal(await page.locator('body.admin-motion-reduced').count(),1);
    assert.equal(await page.evaluate(()=>{const el=document.getElementById('kv0');animateCount(el,0,123,v=>String(v));return el.textContent;}),'123','reduced counters immediately show their final value');
    assert.deepEqual(await page.locator('#app').evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.playState==='running' && a.effect.getTiming().duration>1).map(a=>({target:a.effect.target?.className,name:a.animationName,duration:a.effect.getTiming().duration}))),[]);
    await page.getByRole('button',{name:'Existing theme',exact:true}).click();
    assert.equal(await page.locator('body.admin-bento').count(),0);
    await page.reload();
    await page.locator('#app').waitFor({state:'visible'});
    assert.equal(await page.locator('body.admin-motion-reduced').count(),1);
    assert.equal(await page.locator('body.admin-bento').count(),0);
    await page.evaluate(()=>showPage('settings'));
    await page.getByRole('button',{name:'Bento',exact:true}).click();
    await page.getByRole('button',{name:'Smooth',exact:true}).click();
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('body.admin-motion-reduced').waitFor();
    assert.equal(await page.locator('body.admin-motion-reduced').count(),1,'OS reduced motion wins');
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.locator('body:not(.admin-motion-reduced)').waitFor();
    assert.equal(await page.locator('body.admin-motion-reduced').count(),0);
    await page.evaluate(()=>showPage('dashboard'));
    await page.waitForTimeout(600);
    assert.equal(await page.locator('.nav-item.active').getAttribute('aria-current'),'page');
    await page.locator('#sidebar .nav-item').filter({hasText:'Orders'}).press('Enter');
    await page.locator('#page-orders.active').waitFor();
    await page.evaluate(()=>showPage('dashboard'));
    await page.waitForTimeout(450);
    assert.equal(await page.locator('.prod-drawer:not(.open)').first().evaluate(el=>getComputedStyle(el).visibility),'hidden');
    fs.mkdirSync(path.join(root,'docs/admin-bento'),{recursive:true});
    await page.screenshot({path:path.join(root,'docs/admin-bento/desktop.png')});
    for (const width of [390,768]) {
      await page.setViewportSize({width,height:844});
      await page.evaluate(()=>showPage('dashboard'));
      await page.waitForTimeout(450);
      await page.getByRole('button',{name:'Navigation menu',exact:true}).click();
      await page.locator('#adminMoreMenu.open').waitFor({state:'visible'});
      await page.evaluate(()=>showPage('dashboard'));
      assert.equal(await page.locator('#adminMoreMenu.open').count(),0,'mobile route closes the menu');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),'no overflow at '+width);
      await page.evaluate(()=>showPage('settings'));
      await page.getByRole('button',{name:'Reduced',exact:true}).click();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth+1),'settings fit at '+width);
    }
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>showPage('dashboard'));
    await page.waitForTimeout(200);
    await page.screenshot({path:path.join(root,'docs/admin-bento/mobile.png')});
    assert.deepEqual(newErrors,[]);
    assert.equal(mutations,0,'appearance controls make no backend writes');
    console.log(`PASS: ${pages.length} admin pages, 1440/768/390px, saved preferences, OS reduced motion, no backend writes`);
    await context.close();
  } finally { await browser.close(); if(server) await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
