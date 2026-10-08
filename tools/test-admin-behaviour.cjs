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
    let realityError = null;
    // Old-server fixture reproduces the screenshot, including null age.
    let reality = {store_connected:true,store:{mode:'pg',readonly_enforced_by:'database role'},totals:{store_orders:0,beacon_orders:0,store_revenue:0,beacon_revenue:0,revenue_delta:0,beacon_coverage_pct:null},sync:{states:[],last_successful_sync:null,minutes_since_sync:null,sending_paused:true,consent_staleness:{minutes:null,limit:180}},engine:{recent:[]},series:[],recent_store_only_orders:[]};
    const reads = [];
    await context.route('**/*', route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin === base) return route.continue();
      if (url.hostname === 'backend-s7ih.onrender.com') {
        if (!['GET','HEAD','OPTIONS'].includes(request.method())) mutations++;
        reads.push(url.pathname);
        if (url.pathname.startsWith('/api/marketing/api/dash')) {
          let data = {};
          const path = url.pathname.replace('/api/marketing/api/dash', '');
          if (path === '/reconciliation') {
            if (realityError) return route.fulfill({status:500,contentType:'application/json',headers:{'access-control-allow-origin':base},body:JSON.stringify({error:realityError})});
            data = reality;
          }
          else if (path === '/overview') data = {live:{active_visitors:12,high_intent_visitors:3},traffic:{sessions:100,product_views:60},funnel:{sessions:100,carts_created:20,checkouts_started:10,orders:5,conversion_rate:.05},revenue:{total:2500,recovered:500},recovery:{abandoned_value:1000,recovered_value:500}};
          else if (path === '/health') data = {status:'healthy'};
          else if (path === '/live') data = {visitors:[]};
          else if (path === '/products') data = {products:[]};
          else if (path === '/segments') data = {segments:[]};
          else return route.fulfill({status:503,contentType:'application/json',headers:{'access-control-allow-origin':base},body:'{}'});
          return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':base},body:JSON.stringify(data)});
        }
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
    const behaviour = ['behaviour','segments','journeys','recovery','automations','attribution','reality'];
    const marketing = ['overview','strategy','liveads','winners','campaigns','reports','opportunities'];
    assert.deepEqual(await page.locator('#page-marketing .mkt-navbtn').evaluateAll(nodes=>nodes.map(n=>n.dataset.tab)),marketing);
    assert.deepEqual(await page.locator('#page-customerbehaviour .mkt-navbtn').evaluateAll(nodes=>nodes.map(n=>n.dataset.tab)),behaviour);
    for (const [workspace,tabs] of [['marketing',marketing],['customerbehaviour',behaviour]]) {
      await page.locator(workspace === 'marketing' ? '#navMarketing' : '#navCustomerBehaviour').click();
      for (const tab of tabs) {
        await page.locator('#page-'+workspace+' .mkt-navbtn[data-tab="'+tab+'"]').click();
        assert.equal(await page.locator('#page-'+workspace+'.active').count(),1);
        assert.equal(await page.locator('#app .page.active').count(),1);
        assert.equal(await page.locator('#page-'+workspace+' .mkt-tab:visible').getAttribute('id'),'mkt-tab-'+tab);
        assert.equal(await page.locator('#page-'+workspace+' .mkt-active').getAttribute('aria-pressed'),'true');
      }
    }
    await page.waitForFunction(()=>document.getElementById('rl-status').textContent.includes('not verified'));
    assert.doesNotMatch(await page.locator('#rl-status').textContent(),/null min/);
    assert.match(await page.locator('#rl-status').textContent(),/have not both synced successfully/);
    assert.match(await page.locator('#rl-totals').textContent(),/Not measured/);
    assert.equal(await page.locator('#rl-totals tbody tr:first-child .rl-n').first().textContent(),'—');
    assert.doesNotMatch(await page.locator('#rl-missed').textContent(),/saw every order/);
    reality = {...reality,data_status:{ready:true,measured_days:1,failed_days:0},store_check:{checked:true,readonly:true},totals:{store_orders:5,beacon_orders:3,store_revenue:2500,beacon_revenue:1500,revenue_delta:1000,matched_orders:3,store_only_orders:2,beacon_only_orders:0,beacon_coverage_pct:60},sync:{...reality.sync,last_successful_sync:new Date().toISOString(),minutes_since_sync:0,sending_paused:false},series:[{day:'2026-10-08',store_reachable:true}]};
    await page.evaluate(()=>mktLoadReality());
    await page.waitForFunction(()=>document.getElementById('rl-status').textContent.includes('connection verified'));
    assert.equal(await page.locator('#rl-totals tbody tr:first-child .rl-n').first().textContent(),'5');
    assert.match(await page.locator('#rl-totals').textContent(),/Measured days.*1/);
    realityError = 'mkt_sync_state: synthetic permission denied';
    await page.evaluate(()=>mktLoadReality());
    await page.waitForFunction(()=>document.getElementById('rl-status').textContent.includes('synthetic permission denied'));
    assert.match(await page.locator('#rl-totals').textContent(),/Unavailable/);
    realityError = null;
    await page.evaluate(()=>showPage('customerbehaviour'));
    await page.locator('#page-customerbehaviour [data-tab="behaviour"]').click();
    await page.waitForFunction(()=>document.getElementById('beh-kpi-sessions').textContent==='100');
    assert.equal(await page.locator('#beh-kpi-cvr').textContent(),'5.0%');
    // Legacy entry points navigate across workspaces and each selection survives.
    await page.evaluate(()=>mktShowTab('strategy'));
    await page.locator('#page-marketing.active').waitFor();
    await page.evaluate(()=>mktShowTab('segments'));
    await page.locator('#page-customerbehaviour.active').waitFor();
    await page.evaluate(()=>showPage('marketing'));
    assert.equal(await page.locator('#mkt-tab-strategy').isVisible(),true);
    await page.evaluate(()=>showPage('customerbehaviour'));
    assert.equal(await page.locator('#mkt-tab-segments').isVisible(),true);
    assert.equal(await page.locator('#page-marketing .mkt-active').getAttribute('data-tab'),'strategy');
    const before = reads.filter(path=>path.endsWith('/api/dash/overview')).length;
    await page.evaluate(()=>showPage('orders'));
    await page.evaluate(()=>mktShowTab('behaviour'));
    await page.waitForTimeout(250);
    assert.equal(reads.filter(path=>path.endsWith('/api/dash/overview')).length,before+1,'cross-page routing loads the destination once');
    for (const width of [390,768]) {
      await page.setViewportSize({width,height:844});
      await page.evaluate(()=>showPage('dashboard'));
      await page.locator('#abn-more').click();
      await page.locator('#moreCustomerBehaviour').click();
      await page.locator('#page-customerbehaviour.active').waitFor();
      assert.equal(await page.locator('#adminMoreOverlay').isVisible(),false);
      await page.locator('#page-customerbehaviour [data-tab="segments"]').click();
      assert.equal(await page.locator('#seg-customer-query').evaluate(el=>el.getBoundingClientRect().right <= innerWidth),true);
      await page.evaluate(()=>showPage('dashboard'));
      await page.locator('#abn-more').click();
      await page.locator('#moreMarketing').click();
      await page.locator('#page-marketing.active').waitFor();
    }
    await page.evaluate(()=>{AZPerms={loaded:true,role:'admin',list:[]};azApplyPermsToDOM();});
    for (const id of ['navMarketing','navCustomerBehaviour','moreMarketing','moreCustomerBehaviour']) assert.equal(await page.locator('#'+id).evaluate(el=>el.style.display),'none');
    await page.evaluate(()=>{AZPerms={loaded:true,role:'owner',list:[]};azApplyPermsToDOM();});
    for (const id of ['navMarketing','navCustomerBehaviour','moreMarketing','moreCustomerBehaviour']) assert.notEqual(await page.locator('#'+id).evaluate(el=>el.style.display),'none');
    await page.waitForTimeout(200);
    assert.equal(mutations,0,'tab navigation makes no backend writes');
    assert.deepEqual(newErrors,[]);
    console.log('PASS: separate workspaces, all 14 tabs, behaviour data rendering, unknown/verified/failed Reality states, cross-page links, independent selections, mobile navigation, permission visibility and no backend writes');
  } finally { await browser.close(); if(server) await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
