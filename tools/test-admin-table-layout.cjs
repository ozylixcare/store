/* Full admin layout regression checks with isolated data and blocked writes. */
const {chromium} = require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES]}));
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..'), base = 'http://127.0.0.1:8770';
const date = offset => { const day = new Date(); day.setDate(day.getDate()-offset); day.setHours(11,0,0,0); return day.toISOString(); };
const order = (id,offset,total,payment,status,email) => ({id:String(id),created_at:date(offset),total,payment_status:payment,fulfillment:status,customer_email:email,customer_name:'QA Buyer',city:'Test City',items:[{name:'QA Product',category:'Vitamins',price:total,qty:1}]});
const orders = [order(1,0,1200,'Paid','Delivered','first@example.test'),order(2,1,500,'COD','Pending','second@example.test'),order(3,2,900,'Unpaid','Pending','third@example.test'),order(4,45,3000,'SUCCESS','Shipped','first@example.test'),order(5,1000,700,'Paid','Delivered','history@example.test'),order(6,7,100,'Paid','Delivered','history@example.test')];
const products = [{id:'1',name:"Women's Multivitamin Effervescent Tablet",category:'Effervescent',price:249,stock:65},{id:'2',name:'QA Low',stock:5},{id:'3',name:'QA Empty',stock:0}];
(async () => {
  const server = require('node:http').createServer((req,res) => {
    const requestUrl=new URL(req.url,base);
    if(requestUrl.searchParams.get('storePreview')==='1') {res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>Store preview fixture</title><body><h1>Store preview fixture</h1></body>');return;}
    const pathname=requestUrl.pathname==='/store-preview' ? '/admin-device-preview.html' : requestUrl.pathname;
    const file = path.resolve(root,'.'+pathname);
    if (!file.startsWith(root+path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end(); }
    res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'})[path.extname(file)] || 'application/octet-stream'); fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(8770,'127.0.0.1',resolve));
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
    page.on('pageerror',error => { if (/admin-(card-studio|(panel-)?workspace)/.test(error.stack) || /ResizeObserver loop/.test(error.message)) errors.push(error.message); });
    await page.goto(base+'/admin.html'); await page.locator('#app').waitFor({state:'visible'});
    await page.waitForTimeout(1100);
    await page.emulateMedia({reducedMotion:'reduce'});
    const pages=['orders','inventory','products','customers'];
    const output='/tmp/ozylix-table-layout-qa';fs.mkdirSync(output,{recursive:true});
    for(const width of [1918,1545,1440,1024,820,390,320]) {
      await page.setViewportSize({width,height:1024});
      for(const name of pages) {
        await page.evaluate(name=>showPage(name),name);await page.waitForTimeout(450);
        if(name==='products') {await page.locator('#viewBtnTable').click();await page.waitForTimeout(100);}
        const tables=await page.locator('.page.active .table-wrap > table').evaluateAll(nodes=>nodes.filter(table=>table.getClientRects().length).map(table=>{
          const rect=table.getBoundingClientRect(),parent=table.parentElement,head=table.tHead?.rows[0],body=[...table.tBodies].flatMap(section=>[...section.rows]).find(row=>row.cells.length===head?.cells.length);
          return {tableWidth:rect.width,parentWidth:parent.clientWidth,tableRight:rect.right,lastHeaderRight:head?.cells[head.cells.length-1].getBoundingClientRect().right,columnAlignment:body?[...head.cells].map((cell,i)=>Math.abs(cell.getBoundingClientRect().left-body.cells[i].getBoundingClientRect().left)):[]};
        }));
        assert.ok(tables.length,name+' table is visible at '+width);
        tables.forEach(table=>{
          assert.ok(table.tableWidth>=table.parentWidth-2,'table fills '+name+' container at '+width+': '+JSON.stringify(table));
          assert.ok(Math.abs(table.lastHeaderRight-table.tableRight)<2,'header fills the table width');
          table.columnAlignment.forEach(delta=>assert.ok(delta<2,'header and data columns align on '+name+' at '+width));
        });
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no outer horizontal overflow');
        if(width<=820) {
          const table=page.locator('.page.active .table-wrap').first();
          await table.evaluate(node=>node.scrollLeft=node.scrollWidth);
          assert.ok(await table.evaluate(node=>node.scrollWidth<=node.clientWidth+1 || node.scrollLeft>0),'table actions remain reachable by horizontal scrolling');
        }
        if([1918,820,390].includes(width) && ['orders','inventory'].includes(name)) {
          await page.evaluate(()=>{const table=document.querySelector('.page.active .table-wrap');table.scrollLeft=0;table.scrollIntoView({block:'start'});});await page.screenshot({path:path.join(output,name+'-'+width+'.png')});
        }
      }
    }
    assert.deepEqual(errors,[]);assert.equal(writes,0,'table sizing does not write business data');
    console.log('PASS: Orders, Inventory, Products and Customers tables fill their containers at seven widths (320–1918px); headers align with data, mobile actions remain reachable, no outer overflow and zero business-data writes');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
