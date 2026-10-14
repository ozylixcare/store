/* Full admin layout regression checks with isolated data and blocked writes. */
const {chromium} = require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}));
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..'), base = 'http://127.0.0.1:8769';
const date = offset => { const day = new Date(); day.setDate(day.getDate()-offset); day.setHours(11,0,0,0); return day.toISOString(); };
const order = (id,offset,total,payment,status,email) => ({id:String(id),created_at:date(offset),total,payment_status:payment,fulfillment:status,customer_email:email,customer_name:'QA Buyer',city:'Test City',items:[{name:'QA Product',category:'Vitamins',price:total,qty:1}]});
const orders = [order(1,0,1200,'Paid','Delivered','first@example.test'),order(2,1,500,'COD','Pending','second@example.test'),order(3,2,900,'Unpaid','Pending','third@example.test'),order(4,45,3000,'SUCCESS','Shipped','first@example.test'),order(5,1000,700,'Paid','Delivered','history@example.test'),order(6,7,100,'Paid','Delivered','history@example.test')];
const products = [{id:'1',name:'QA Product',category:'Vitamins',stock:30},{id:'2',name:'QA Low',stock:5},{id:'3',name:'QA Empty',stock:0}];
(async () => {
  const server = require('node:http').createServer((req,res) => {
    const requestUrl=new URL(req.url,base);
    if(requestUrl.searchParams.get('storePreview')==='1') {res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Store preview fixture</title><body><h1>Store preview fixture</h1></body>');return;}
    const pathname=requestUrl.pathname==='/store-preview' ? '/tools/store-preview.html' : requestUrl.pathname;
    const file = path.resolve(root,'.'+pathname);
    if (!file.startsWith(root+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'})[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(8769,'127.0.0.1',resolve));
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    const context = await browser.newContext({viewport:{width:1440,height:1050}});
    let writes = 0;
    await context.route('**/*',route => {
      const req = route.request(), url = new URL(req.url());
      if (url.pathname.startsWith('/api/') || url.hostname === 'backend-s7ih.onrender.com') {
        if (!['GET','HEAD','OPTIONS'].includes(req.method())) { writes++; return route.abort(); }
        let data = {success:true,data:[],orders:[],products:[],customers:[],stats:{},logs:[]};
        if (url.pathname === '/api/admin/me') data = {username:'preview',role:'owner'};
        if (url.pathname === '/api/admin/orders') data = {data:orders};
        if (url.pathname === '/api/admin/products') data = {data:products};
        if (url.pathname === '/api/admin/settings') data = {};
        if (url.pathname === '/health' || url.pathname === '/') data = {status:'ok',version:'preview'};
        return route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':base,'access-control-allow-headers':'*'},body:JSON.stringify(data)});
      }
      if (url.origin === base) return route.continue();
      return route.abort();
    });
    await context.addInitScript(() => {
      sessionStorage.setItem('ozylix_session_schema','20261005-versioned');
      sessionStorage.setItem('ozylix_token','preview.'+btoa(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,role:'owner'}))+'.fixture');
      sessionStorage.setItem('ozylix_role','owner');
    });
    const page = await context.newPage(), errors = [];
    page.on('pageerror',error => { if (/admin-(card-studio|(panel-)?workspace)/.test(error.stack)) errors.push(error.message); });
    await page.goto(base+'/admin.html'); await page.locator('#app').waitFor({state:'visible'});
    await page.waitForTimeout(1100);
    await page.emulateMedia({reducedMotion:'reduce'});
    const dash=page.locator('#page-dashboard');
    await dash.getByRole('button',{name:'Auto fit',exact:true}).waitFor();
    assert.equal(await dash.getByRole('button',{name:'Auto fit',exact:true}).getAttribute('aria-pressed'),'true','automatic layout is the default');
    await page.setViewportSize({width:1896,height:1024}); await page.waitForTimeout(250);
    const desktopKPIs=await page.locator('#kpiCards > .kpi').evaluateAll(cards => cards.map(card => ({width:card.clientWidth,height:card.clientHeight,valueHeight:card.querySelector('.kpi-val').clientHeight,font:parseFloat(getComputedStyle(card.querySelector('.kpi-val')).fontSize),display:getComputedStyle(card.parentElement).display})));
    assert.equal(desktopKPIs.length,4);
    desktopKPIs.forEach(kpi => { assert.equal(kpi.display,'flex','KPI width math uses the correct layout'); assert.ok(kpi.width>250,'totals are not thin vertical strips'); assert.ok(kpi.height<240,'KPI text does not produce a giant blank row'); assert.ok(kpi.valueHeight<kpi.font*2.7,'numbers stay readable'); });
    const revenue=dash.locator('[data-widget="revenue"]');
    await dash.getByRole('button',{name:'Manage cards',exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Customize Paid revenue trend',exact:true}).click();
    await page.getByRole('dialog').getByLabel('Width (px)').fill('327'); await page.getByRole('dialog').getByLabel('Height (px)').fill('913'); await page.getByRole('dialog').getByRole('button',{name:'Save card'}).click();
    assert.equal(await dash.getByRole('button',{name:'Auto fit',exact:true}).getAttribute('aria-pressed'),'false','manual sizes switch to custom layout');
    assert.ok(Math.abs((await revenue.boundingBox()).width-327)<2);
    await dash.getByRole('button',{name:'Auto fit',exact:true}).click(); await page.waitForTimeout(120);
    assert.ok((await revenue.boundingBox()).width>327,'automatic fit recovers useful chart width');
    assert.ok((await revenue.boundingBox()).height<600,'automatic fit ignores old oversized heights');
    await dash.getByRole('button',{name:'Auto fit',exact:true}).click(); await page.waitForTimeout(120);
    assert.ok(Math.abs((await revenue.boundingBox()).width-327)<2,'custom sizes remain available');
    await dash.getByRole('button',{name:'Auto fit',exact:true}).click();
    await page.evaluate(()=>showPage('storeeditor')); await page.locator('#page-storeeditor [data-cs-layout]').waitFor();
    await page.evaluate(()=>{storeEdRefreshPreview();}); await page.waitForTimeout(500);
    const outer=page.frameLocator('#storeEdPreview');
    await outer.locator('#previewDevice').waitFor();
    const inner=outer.frameLocator('#devicePreview');
    await inner.getByRole('heading',{name:'Store preview fixture'}).waitFor();
    assert.ok((await outer.locator('#devicePreview').getAttribute('src')).includes('storePreview=1'),'preview uses the dedicated route flag');
    await outer.locator('#previewPage').selectOption('/shop'); await inner.getByRole('heading',{name:'Store preview fixture'}).waitFor();
    await page.evaluate(()=>storeEdSwitchTab('content')); await page.waitForTimeout(120);
    assert.equal(await page.locator('#storeEdPreview').evaluate(el=>el.parentElement.id),'storeEdContentPreviewSlot');
    await page.evaluate(()=>storeEdSwitchTab('style')); await page.waitForTimeout(120);
    assert.equal(await page.locator('#storeEdPreview').evaluate(el=>el.parentElement.id),'storeEdStylePreviewSlot','preview returns to the correct slot');
    const pages=await page.locator('#app .page').evaluateAll(nodes=>nodes.map(node=>node.id.slice(5)));
    const output='/tmp/ozylix-auto-layout-qa'; fs.mkdirSync(output,{recursive:true});
    const widths=process.env.ADMIN_LAYOUT_WIDTHS ? process.env.ADMIN_LAYOUT_WIDTHS.split(',').map(Number) : [1920,1896,1440,1280,1024,820,768,600,430,390,360,320];
    for(const width of widths) {
      await page.setViewportSize({width,height:1024});
      for(const name of pages) {
        await page.evaluate(name=>showPage(name),name); await page.waitForTimeout(120);
        const visibleCards=await page.locator('.page.active .cs-card').evaluateAll(cards=>cards.filter(card=>card.getClientRects().length && !card.hidden).map(card=>({id:card.dataset.csId,width:card.clientWidth,right:card.getBoundingClientRect().right,parentWidth:card.parentElement.clientWidth,metric:card.classList.contains('cs-metric'),parentDisplay:getComputedStyle(card.parentElement).display,group:card.parentElement.classList.contains('cs-flex')})));
        for (const card of visibleCards) {
          if (card.right>width+1) await page.screenshot({path:path.join(output,'overflow-'+name+'-'+width+'.png')});
          assert.ok(card.right<=width+1,name+' card fits at '+width+': '+JSON.stringify(card));
          if(card.group){assert.equal(card.parentDisplay,'flex','actual layout matches width rules'); assert.ok(card.width>=Math.min(card.parentWidth,card.metric ? 120 : 270)-2,'readable '+name+' card at '+width+': '+card.id+' width '+card.width);}
        }
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'document fits '+name+' at '+width);
        if(name==='dashboard') {
          const geometry=await page.locator('#kpiCards .kpi').evaluateAll(cards=>cards.map(card=>({height:card.clientHeight,width:card.clientWidth})));
          geometry.forEach(card=>assert.ok(card.height<300,'dashboard totals do not create enormous gaps at '+width));
        }
        if(name==='storeeditor') {
          const preview=await page.locator('#storeEdPreview').boundingBox();
          assert.ok(preview.width>=Math.min(width-100,500),'Store Editor preview has a readable width at '+width);
        }
        if([1896,820,390].includes(width) && ['dashboard','storeeditor','orders','integrations','settings'].includes(name)) {
          await page.evaluate(()=>{document.querySelector('.main').scrollTop=0;window.scrollTo(0,0);}); await page.screenshot({path:path.join(output,name+'-'+width+'.png')});
        }
      }
    }
    assert.deepEqual(errors,[]); assert.equal(writes,0,'layout and preview testing does not write business data');
    console.log('PASS: recording-width KPI collapse regression, readable card widths, compact KPI rows, automatic/custom layout preservation, working preview route and tabs, '+pages.length+' admin pages at '+widths.length+' widths ('+Math.min(...widths)+'–'+Math.max(...widths)+'px), screenshots and zero server writes');
  } finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;});
