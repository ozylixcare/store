/* Dashboard browser verification with isolated synthetic data and blocked writes. */
const {chromium} = require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}));
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..'), base = 'http://127.0.0.1:8768';
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
  await new Promise(resolve => server.listen(8768,'127.0.0.1',resolve));
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
    const dashboard=page.locator('#page-dashboard');
    await dashboard.getByRole('button',{name:'Manage cards',exact:true}).waitFor();
    const revenue=dashboard.locator('[data-widget="revenue"]');
    await dashboard.getByRole('button',{name:'Arrange widgets',exact:true}).click();
    await revenue.getByRole('button',{name:'Customize Paid revenue trend',exact:true}).click();
    let dialog=page.getByRole('dialog',{name:'Customize card'});
    await dialog.getByLabel('Card title',{exact:true}).fill('My paid revenue');
    await dialog.getByLabel('Width (px)',{exact:true}).fill('713');
    await dialog.getByLabel('Height (px)',{exact:true}).fill('617');
    await dialog.getByLabel('Card accent').selectOption('blue');
    await dialog.getByLabel('Chart style').selectOption('area');
    await dialog.getByRole('button',{name:'Save card',exact:true}).click(); await page.waitForTimeout(150);
    let rect=await revenue.boundingBox();
    assert.ok(Math.abs(rect.width-713)<2,'exact arbitrary width applied');
    assert.ok(Math.abs(rect.height-617)<2,'height exceeds old 380px cap');
    const grip=revenue.locator(':scope > .aw-resize'); await grip.scrollIntoViewIfNeeded();
    await grip.press('Shift+ArrowDown'); rect=await revenue.boundingBox();
    assert.ok(Math.abs(rect.height-618)<2,'one-pixel keyboard resize');
    let corner=await grip.boundingBox(); const before=await revenue.boundingBox();
    await page.mouse.move(corner.x+15,corner.y+15); await page.mouse.down();
    await page.mouse.move(corner.x+52,corner.y+88,{steps:10}); await page.mouse.up();
    rect=await revenue.boundingBox(); assert.ok(Math.abs(rect.width-(before.width+37))<3,'pointer width does not snap to a preset'); assert.ok(Math.abs(rect.height-(before.height+73))<3,'pointer height does not snap');
    corner=await grip.boundingBox(); const committed=await revenue.boundingBox();
    await page.mouse.move(corner.x+15,corner.y+15); await page.mouse.down(); await page.mouse.move(corner.x-72,corner.y-65,{steps:8}); await grip.press('Escape'); await page.mouse.up();
    rect=await revenue.boundingBox(); assert.ok(Math.abs(rect.width-committed.width)<2,'Escape restores committed size');
    await dashboard.getByRole('button',{name:'Done arranging',exact:true}).click();
    await dashboard.getByRole('button',{name:'Manage cards',exact:true}).click();
    await page.getByRole('dialog',{name:'Manage cards'}).getByRole('checkbox',{name:'My paid revenue',exact:true}).uncheck();
    await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
    assert.equal(await revenue.isVisible(),false,'built-in card hides');
    await page.reload(); await page.locator('#app').waitFor({state:'visible'}); await page.waitForTimeout(650);
    assert.equal(await revenue.isVisible(),false,'hidden state survives refresh');
    await dashboard.getByRole('button',{name:'Manage cards',exact:true}).click();
    await page.getByRole('dialog').getByRole('checkbox',{name:'My paid revenue',exact:true}).check();
    await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
    rect=await revenue.boundingBox(); assert.ok(Math.abs(rect.width-committed.width)<2,'custom dimensions survive refresh'); assert.equal(await revenue.locator('.card-title').textContent(),'My paid revenue');
    async function add(type,title,note) {
      await page.locator('.page.active').getByRole('button',{name:'Add card',exact:true}).click(); const dlg=page.getByRole('dialog',{name:'Add a card'});
      await dlg.getByLabel('Card type').selectOption(type); await dlg.getByLabel('Card title',{exact:true}).fill(title);
      if(note) await dlg.getByLabel('Note (for personal note cards)').fill(note);
      await dlg.getByRole('button',{name:'Add card',exact:true}).click(); await page.waitForTimeout(150);
    }
    await add('note','My tasks','<img src=x onerror=alert(1)>\nCheck fulfilment');
    assert.equal(await dashboard.locator('.cs-custom img').count(),0,'notes render as text, not HTML');
    await add('paid','Paid value');
    assert.equal(await dashboard.locator('.cs-custom').filter({hasText:'Paid value'}).locator('.cs-value').textContent(),'₹1,200','new KPI follows dashboard range');
    await add('revenue','Extra trend');
    assert.equal(await dashboard.locator('.cs-custom .dw-chart-data').count(),1,'new chart has inspectable data');
    await dashboard.getByRole('button',{name:'Arrange widgets',exact:true}).click();
    await dashboard.locator('.cs-custom').first().locator('.cs-handle').press('ArrowDown');
    assert.equal(await dashboard.locator('.cs-custom .card-title').first().textContent(),'Paid value','custom cards reorder');
    await dashboard.getByRole('button',{name:'Done arranging',exact:true}).click();
    await page.reload(); await page.locator('#app').waitFor({state:'visible'}); await page.waitForTimeout(650);
    assert.equal(await dashboard.locator('.cs-custom').count(),3,'added cards survive refresh');
    assert.equal(await dashboard.locator('.cs-custom .card-title').first().textContent(),'Paid value','custom order survives refresh');
    await dashboard.getByRole('button',{name:'Manage cards',exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Delete My tasks',exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click(); assert.equal(await dashboard.locator('.cs-custom').count(),2,'custom card deletes without business-data writes');
    await page.evaluate(() => {showPage('orders'); filterOrders();}); await page.locator('#page-orders [data-cs-manage]').waitFor();
    const orderPage=page.locator('#page-orders');
    await add('orders','Order KPI'); assert.equal(await orderPage.locator('.cs-value').textContent(),'6');
    await page.locator('#orderStatusFilter').selectOption('Delivered'); await page.waitForTimeout(150); assert.equal(await orderPage.locator('.cs-value').textContent(),'3','custom KPI follows order filters');
    await orderPage.getByRole('button',{name:'Manage cards',exact:true}).click();
    await page.getByRole('dialog').getByRole('button',{name:'Customize Fulfilment flow · filtered orders',exact:true}).click();
    dialog=page.getByRole('dialog',{name:'Customize card'}); await dialog.getByLabel('Width (px)').fill('421'); await dialog.getByLabel('Height (px)').fill('803'); await dialog.getByRole('button',{name:'Save card'}).click();
    const orderChart=orderPage.locator('.aw-card').filter({has:page.locator('#aw-orders-0')}); rect=await orderChart.boundingBox(); assert.ok(Math.abs(rect.width-421)<2); assert.ok(Math.abs(rect.height-803)<2);
    const pages=await page.locator('#app .page').evaluateAll(nodes => nodes.map(node => node.id.slice(5)));
    const out='/tmp/ozylix-card-studio-qa'; fs.mkdirSync(out,{recursive:true});
    for(const width of [1920,1440,1024,768,600,390,360]) {
      await page.setViewportSize({width,height:1000});
      for(const name of pages) {
        await page.evaluate(name => showPage(name),name); await page.waitForTimeout(140);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1),'page fits '+name+' at '+width);
        const overflow=await page.locator('.page.active .cs-card').evaluateAll(cards => cards.filter(c => c.getClientRects().length && c.getBoundingClientRect().right>innerWidth+1).map(c => c.dataset.csId)); assert.deepEqual(overflow,[],'cards fit '+name+' at '+width);
      }
      if([1440,390].includes(width)) { await page.evaluate(() => showPage('orders')); await page.waitForTimeout(250); await page.screenshot({path:path.join(out,'orders-'+width+'.png')}); }
    }
    await page.evaluate(() => showPage('orders')); await page.waitForTimeout(150);
    await orderPage.getByRole('button',{name:'Manage cards',exact:true}).click();
    assert.ok(await page.getByRole('dialog').isVisible(),'mobile card manager opens');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1),'mobile dialog fits');
    await page.getByRole('dialog').press('Escape');
    await page.evaluate(() => showPage('dashboard')); await dashboard.getByRole('button',{name:'Reset layout',exact:true}).click(); await page.waitForTimeout(150);
    assert.equal(await revenue.evaluate(el => el.style.getPropertyValue('--cs-free-width')),'','reset clears custom size');
    assert.deepEqual(errors,[]); assert.equal(writes,0,'card preferences cause no server writes');
    console.log('PASS: exact sizes beyond old limits, continuous pointer and one-pixel keyboard resizing, cancellation, hide/restore, saved customization, safe notes, adding/deleting/reordering personal cards, live filtered KPIs, all 30 pages at 360–1920px, mobile dialogs, reset and zero server writes');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => {console.error(error);process.exitCode=1;});
