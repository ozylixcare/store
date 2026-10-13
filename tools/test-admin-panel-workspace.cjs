/* Dashboard browser verification with isolated synthetic data and blocked writes. */
const {chromium} = require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}));
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..'), base = 'http://127.0.0.1:8767';
const date = offset => { const day = new Date(); day.setDate(day.getDate()-offset); day.setHours(11,0,0,0); return day.toISOString(); };
const order = (id,offset,total,payment,status,email) => ({id:String(id),created_at:date(offset),total,payment_status:payment,fulfillment:status,customer_email:email,customer_name:'QA Buyer',city:'Test City',items:[{name:'QA Product',category:'Vitamins',price:total,qty:1}]});
const orders = [order(1,0,1200,'Paid','Delivered','first@example.test'),order(2,1,500,'COD','Pending','second@example.test'),order(3,2,900,'Unpaid','Pending','third@example.test'),order(4,45,3000,'SUCCESS','Shipped','first@example.test'),order(5,1000,700,'Paid','Delivered','history@example.test'),order(6,7,100,'Paid','Delivered','history@example.test')];
const products = [{id:'1',name:'QA Product',category:'Vitamins',stock:30},{id:'2',name:'QA Low',stock:5},{id:'3',name:'QA Empty',stock:0}];
(async () => {
  const server = require('node:http').createServer((req,res) => {
    const file = path.resolve(root,'.'+new URL(req.url,base).pathname);
    if (!file.startsWith(root+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'})[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(8767,'127.0.0.1',resolve));
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
    page.on('pageerror',error => { if (/admin-(panel-)?workspace/.test(error.stack)) errors.push(error.message); });
    await page.goto(base+'/admin.html'); await page.locator('#app').waitFor({state:'visible'});
    await page.waitForTimeout(1100);
    await page.evaluate(() => { window.__qaNodes = [...document.querySelectorAll('.page [id]')]; });
    await page.evaluate(() => { showPage('orders'); filterOrders(); });
    await page.locator('#page-orders .aw-toolbar').waitFor();
    assert.equal(await page.locator('#aw-orders-1').count(),1);
    assert.equal(await page.locator('#page-orders .dw-chart-data').count(),2);
    assert.equal(await page.locator('#page-orders .dw-chart-data').last().locator('tbody td').evaluateAll(nodes => nodes.reduce((sum,node) => sum+Number(node.textContent),0)),6);
    await page.locator('#orderStatusFilter').selectOption('Delivered');
    await page.waitForTimeout(150);
    assert.equal(await page.locator('#page-orders .dw-chart-data').first().locator('tbody tr').count(),1);
    assert.ok((await page.locator('#page-orders .dw-chart-data').first().textContent()).includes('Delivered3'));
    const orderPage = page.locator('#page-orders');
    await orderPage.getByRole('button',{name:'Arrange page',exact:true}).click();
    const first = orderPage.locator('.aw-card').first();
    const initialId = await first.getAttribute('data-aw-id');
    await first.locator('.aw-handle').press('ArrowDown');
    assert.notEqual(await orderPage.locator('.aw-card').first().getAttribute('data-aw-id'),initialId);
    const card = orderPage.locator('.aw-card').filter({has:page.locator('#aw-orders-0')});
    await card.locator('[data-aw-width]').selectOption('full');
    await card.locator('[data-aw-height]').selectOption('tall');
    assert.equal(await card.getAttribute('data-aw-height'),'tall');
    await orderPage.getByRole('button',{name:'3D depth',exact:true}).click();
    await orderPage.getByRole('combobox',{name:'Page spacing',exact:true}).selectOption('compact');
    await page.reload(); await page.locator('#app').waitFor({state:'visible'});
    await page.evaluate(() => showPage('orders')); await page.locator('#page-orders .aw-toolbar').waitFor();
    assert.equal(await card.getAttribute('data-aw-width'),'full');
    assert.equal(await card.getAttribute('data-aw-height'),'tall');
    assert.equal(await orderPage.getByRole('button',{name:'3D depth',exact:true}).getAttribute('aria-pressed'),'false');
    assert.equal(await orderPage.getByRole('combobox',{name:'Page spacing',exact:true}).inputValue(),'compact');
    assert.notEqual(await orderPage.locator('.aw-card').first().getAttribute('data-aw-id'),initialId);
    await orderPage.getByRole('button',{name:'Reset page layout',exact:true}).click();
    assert.equal(await orderPage.locator('.aw-card').first().getAttribute('data-aw-id'),initialId,'reset restores original order after reload');
    await orderPage.getByRole('button',{name:'Arrange page',exact:true}).click();
    await card.locator('.aw-resize').press('ArrowDown');
    assert.equal(await card.getAttribute('data-aw-height'),'short','keyboard corner resize changes height');
    await card.locator('.aw-resize').scrollIntoViewIfNeeded();
    const corner = await card.locator('.aw-resize').boundingBox();
    await page.mouse.move(corner.x+15,corner.y+15); await page.mouse.down();
    await page.mouse.move(corner.x+220,corner.y+150,{steps:10}); await page.mouse.up();
    assert.ok(['wide','full'].includes(await card.getAttribute('data-aw-width')),'pointer corner resize snaps width');
    assert.equal(await card.getAttribute('data-aw-height'),'tall','pointer resize changes chart height');
    await card.locator('[data-aw-width]').selectOption('medium');
    await page.evaluate(() => {document.querySelector('.main').scrollTop=0;window.scrollTo(0,0);}); await page.waitForTimeout(700);
    const grip = await card.locator('.aw-handle').boundingBox(), target = await orderPage.locator('.aw-card').last().boundingBox();
    await page.mouse.move(grip.x+15,grip.y+15); await page.mouse.down();
    await page.mouse.move(target.x+target.width*.8,target.y+target.height*.65,{steps:12}); await page.mouse.up();
    assert.notEqual(await orderPage.locator('.aw-card').first().getAttribute('data-aw-id'),initialId,'pointer moves cards inside a page section');
    await orderPage.getByRole('button',{name:'Done arranging',exact:true}).click();
    await page.locator('#aw-orders-1').focus(); await page.locator('#aw-orders-1').press('Home');
    assert.ok(await page.locator('#aw-orders-1').locator('..').locator('.dw-chart-tip').isVisible(),'keyboard inspects new chart');
    await page.evaluate(() => { showPage('inventory'); filterInventory(); }); await page.locator('#aw-inventory-0').waitFor();
    await page.locator('#invSearch').fill('QA Low');
    assert.ok((await page.locator('#page-inventory .dw-chart-data').first().textContent()).includes('Low · 1–191'));
    await page.locator('#invSearch').fill('not found');
    assert.ok((await page.locator('#page-inventory .dw-chart-data').last().textContent()).includes('No data'));
    await page.evaluate(() => showPage('payments')); await page.locator('#payTrendCanvas').waitFor();
    await page.waitForTimeout(250);
    assert.ok(await page.locator('#payTrendCanvas').evaluate(el => !!el.closest('.dw-chart-wrap')),'existing payments chart becomes interactive');
    assert.equal(await page.locator('#payKpis .kpi-val').first().textContent(),'₹5,000','payment KPI and paid chart include successful historical payments');
    await page.evaluate(() => showPage('analytics'));
    await page.locator('#analyticsFilter').selectOption('365');
    assert.equal(await page.locator('#analyticsKpis .kpi-val').first().textContent(),'₹5,000','analytics separates unpaid and COD from paid value');
    assert.equal(await page.locator('#analyticsKpis .kpi-val').nth(1).textContent(),'6','all-time includes old loaded records');
    assert.equal(await page.locator('#page-analytics .dw-chart-data').count(),5,'all five analytics charts are interactive');
    await page.locator('#analyticsFilter').selectOption('0');
    assert.equal(await page.locator('#analyticsKpis .kpi-val').first().textContent(),'₹1,200','analytics range changes repaint charts');
    const pages = await page.locator('#app .page').evaluateAll(nodes => nodes.map(node => node.id.slice(5)));
    const out = '/tmp/ozylix-panel-qa'; fs.mkdirSync(out,{recursive:true});
    await page.emulateMedia({reducedMotion:'reduce'});
    for (const width of [1920,1440,1024,768,600,390,360]) {
      await page.setViewportSize({width,height:1000});
      for (const name of pages) {
        await page.evaluate(name => showPage(name),name); await page.waitForTimeout(110);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1),'document fits '+name+' at '+width);
        const failures = await page.locator('.page.active .aw-card').evaluateAll(cards => cards.filter(card => card.getClientRects().length && (card.getBoundingClientRect().right>innerWidth+1 || card.clientWidth<90)).map(card => card.dataset.awId));
        if (failures.length) { await page.waitForTimeout(700); await page.screenshot({path:path.join(out,'failure-'+name+'-'+width+'.png')}); console.log(await page.locator('.page.active .aw-card').evaluateAll(cards => cards.map(card => ({id:card.dataset.awId,width:card.clientWidth,left:card.getBoundingClientRect().left,right:card.getBoundingClientRect().right,parent:card.parentElement.outerHTML.slice(0,160)})))); }
        assert.deepEqual(failures,[],'cards fit '+name+' at '+width);
        if (width===1440 && ['orders','inventory','payments','settings'].includes(name) || width===390 && ['orders','inventory','settings'].includes(name)) {
          await page.evaluate(() => { document.querySelector('.main').scrollTop=0; window.scrollTo(0,0); });
          await page.screenshot({path:path.join(out,name+'-'+width+'.png')});
        }
      }
    }
    await page.evaluate(() => showPage('orders')); await page.waitForTimeout(150);
    await orderPage.getByRole('button',{name:'Arrange page',exact:true}).click();
    await orderPage.locator('.aw-card').first().getByRole('button',{name:'Move later',exact:true}).click();
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.deepEqual(errors,[]); assert.equal(writes,0,'layout changes never write to the backend');
    console.log('PASS: '+pages.length+' admin pages at 7 widths (360–1920px), filtered chart values, chart keyboard inspection, per-page order/width/height/depth/density persistence, reset, resize controls, payment chart upgrade, mobile controls and zero server writes');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => {console.error(error);process.exitCode=1;});
