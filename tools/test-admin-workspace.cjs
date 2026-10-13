/* Dashboard browser verification with isolated synthetic data and blocked writes. */
const {chromium} = require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}));
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..'), base = 'http://127.0.0.1:8766';
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
  await new Promise(resolve => server.listen(8766,'127.0.0.1',resolve));
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
    page.on('pageerror',error => { if (/admin-workspace/.test(error.stack)) errors.push(error.message); });
    await page.goto(base+'/admin.html'); await page.locator('#app').waitFor({state:'visible'});
    await page.waitForTimeout(1100);
    assert.equal(await page.locator('.dw-widget').count(),26);
    assert.equal(await page.locator('#dashRevTotal').textContent(),'₹1,200','paid revenue excludes unpaid and COD');
    assert.equal(await page.locator('#custGrowthTotalDash').textContent(),'2 buyers','prior purchases prevent a repeat buyer being counted as new');
    assert.equal(await page.locator('#statusTotal').textContent(),'3');
    const initial = await page.locator('.dw-grid > .dw-widget').evaluateAll(cards => cards.map(c => c.dataset.widget));
    await page.getByRole('button',{name:'Arrange widgets',exact:true}).click();
    const grip = page.getByRole('button',{name:'Move Paid revenue trend',exact:true});
    await grip.press('ArrowDown');
    const moved = await page.locator('.dw-grid > .dw-widget').evaluateAll(cards => cards.map(c => c.dataset.widget));
    assert.equal(moved[1],'revenue'); assert.notDeepEqual(moved,initial);
    await page.getByRole('combobox',{name:'Paid revenue trend width',exact:true}).selectOption('full');
    assert.equal(await page.locator('[data-widget="revenue"]').evaluate(el => el.dataset.size),'full');
    await page.getByRole('button',{name:'3D depth',exact:true}).click();
    await page.getByRole('combobox',{name:'Dashboard spacing',exact:true}).selectOption('compact');
    await page.reload(); await page.locator('#app').waitFor({state:'visible'}); await page.waitForTimeout(600);
    assert.equal(await page.locator('[data-widget="revenue"]').evaluate(el => el.dataset.size),'full');
    assert.equal(await page.getByRole('button',{name:'3D depth',exact:true}).getAttribute('aria-pressed'),'false');
    assert.equal(await page.locator('#dwDensity').inputValue(),'compact');
    assert.equal((await page.locator('.dw-grid > .dw-widget').evaluateAll(cards => cards.map(c => c.dataset.widget)))[1],'revenue');
    await page.getByRole('button',{name:'Reset layout',exact:true}).click();
    await page.getByRole('button',{name:'Arrange widgets',exact:true}).click();
    await page.locator('.dw-grid').evaluate(el => el.scrollIntoView({block:'start'}));
    await page.waitForTimeout(500);
    const start = await grip.boundingBox(), target = await page.locator('[data-widget="today-revenue"]').boundingBox();
    await page.mouse.move(start.x+start.width/2,start.y+start.height/2); await page.mouse.down();
    await page.mouse.move(target.x+target.width*.75,target.y+target.height*.7,{steps:12}); await page.mouse.up();
    assert.notEqual((await page.locator('.dw-grid > .dw-widget').evaluateAll(cards => cards.map(c => c.dataset.widget)))[0],'revenue','pointer drag reorders');
    await page.getByRole('button',{name:'Done arranging',exact:true}).click();
    await page.locator('#revenueCanvas').focus(); await page.locator('#revenueCanvas').press('End');
    assert.ok((await page.locator('[data-widget="revenue"] .dw-chart-tip').textContent()).includes('₹1,200'),'keyboard chart inspection exposes exact value');
    await page.locator('#revenueCanvas').press('Escape');
    assert.equal(await page.locator('[data-widget="revenue"] .dw-chart-tip').isVisible(),false);
    await page.locator('#dashGChipAll').click(); await page.waitForTimeout(550);
    assert.equal(await page.locator('#dashRevTotal').textContent(),'₹5,000','all-time plots include older history');
    await page.locator('#dashGChipToday').click(); await page.waitForTimeout(550);
    assert.equal(await page.locator('#statusTotal').textContent(),'1');
    await page.setViewportSize({width:1280,height:900}); await page.waitForTimeout(350);
    assert.equal(await page.locator('#statusTotal').textContent(),'1','resize preserves selected date range');
    await page.getByRole('button',{name:'Delivered',exact:false}).filter({hasText:'100.0%'}).click();
    assert.ok((await page.locator('.dw-flow-note').textContent()).includes('1 of 1'));
    await page.locator('#dashGChip7').click(); await page.waitForTimeout(500);
    const outDir = '/tmp/ozylix-dashboard-qa'; fs.mkdirSync(outDir,{recursive:true});
    for (const width of [1920,1440,1024,768,600,390,360]) {
      await page.setViewportSize({width,height:1000}); await page.waitForTimeout(450);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1),'document fits '+width);
    const failures = await page.locator('.dw-widget').evaluateAll(cards => cards.filter(card => !card.hidden && (card.getBoundingClientRect().right>innerWidth+1 || card.clientWidth<100)).map(card => card.dataset.widget));
      assert.deepEqual(failures,[],'cards fit '+width);
      const canvas = await page.locator('#revenueCanvas').evaluate(el => ({css:el.clientWidth,pixels:el.width,ratio:Math.min(devicePixelRatio || 1,2)}));
      assert.ok(Math.abs(canvas.pixels-canvas.css*canvas.ratio)<=1,'chart resizes sharply at '+width);
      if ([1440,768,390].includes(width)) { await page.evaluate(() => {window.scrollTo(0,0);document.querySelector('.main').scrollTop=0;}); await page.screenshot({path:path.join(outDir,width+'.png'),fullPage:width===390}); }
    }
    await page.getByRole('button',{name:'Arrange widgets',exact:true}).click();
    const mobileOrder = await page.locator('.dw-grid > .dw-widget').evaluateAll(cards => cards.map(c => c.dataset.widget));
    await page.locator('.dw-widget').first().getByRole('button',{name:'Move later',exact:true}).click();
    assert.notDeepEqual(await page.locator('.dw-grid > .dw-widget').evaluateAll(cards => cards.map(c => c.dataset.widget)),mobileOrder,'mobile move buttons work');
    await page.emulateMedia({reducedMotion:'reduce'}); await page.locator('body.admin-motion-reduced').waitFor(); assert.equal(await page.locator('body.admin-motion-reduced').count(),1);
    assert.deepEqual(errors,[]); assert.equal(writes,0,'dashboard customization makes no server writes');
    console.log('PASS: exact chart values, inclusive date ranges, all-time history, 26 widgets, pointer/keyboard/mobile moves, saved order/size/density/depth, 1920–360px, responsive canvas, reduced motion and zero server writes');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => {console.error(error);process.exitCode=1;});
