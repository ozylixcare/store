const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;let f=path.join(root,p.replace('.min.','.'));if(!path.extname(p)||p==='/')f=path.join(root,'index.html');if(!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[path.extname(f)]||'text/plain');res.end(fs.readFileSync(f));});
 await new Promise(r=>server.listen(8781,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
 try{for(const width of [320,390,768,820,1024,1180,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.pathname.startsWith('/api/')||u.pathname.startsWith('/telemetry/'))return route.fulfill({contentType:'application/json',body:JSON.stringify({data:[],products:[],theme:null,ok:true})});if(u.origin==='http://127.0.0.1:8781')return route.continue();return route.abort();});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8781');await page.waitForTimeout(500);await page.evaluate(()=>{const p=PRODUCTS.find(p=>p.id===38);p.stock=90;p.active=true;p._hidden=false;p.hasTiers=true;p._backendTiers=[{tabs:90,rate:2097,mrp:4194,discountPct:50},{tabs:60,rate:1398,mrp:2796,discountPct:50},{tabs:30,rate:1048,mrp:1398,discountPct:25}];openProduct(38)});await page.waitForTimeout(200);
  const result=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,items:[...document.querySelectorAll('#page-product *, .app-topbar *, #stickyCart *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&getComputedStyle(e).visibility!=='hidden'&&(r.left < -1||r.right>innerWidth+1)}).slice(0,25).map(e=>({tag:e.tagName,id:e.id,class:e.className,width:e.getBoundingClientRect().width})),header:document.querySelector('.app-topbar').getBoundingClientRect().toJSON(),sticky:document.querySelector('#stickyCart').getBoundingClientRect().toJSON()}));
  assert.equal(result.overflow,false,`${width}: horizontal page overflow`);assert.deepEqual(errors,[]);
  const gallery=await page.locator('#galleryMain').boundingBox();
  assert.ok(Math.abs(gallery.width-gallery.height)<=1,`${width}: gallery must be square`);
  const media=await page.locator('#galleryMain > img, #galleryMain > video').first().boundingBox();
  assert.ok(media && Math.abs(media.width-gallery.width)<=1 && Math.abs(media.height-gallery.height)<=1 && Math.abs(media.x-gallery.x)<=1 && Math.abs(media.y-gallery.y)<=1,`${width}: media must fill gallery edge to edge`);
  if(width>=700&&width<=1024){const title=await page.locator('.prod-title').boundingBox();assert.ok(title.x>gallery.x+gallery.width,'tablet details beside gallery');}
  for(let tier=0;tier<3;tier++){await page.evaluate(i=>selectTier(38,i),tier);const price=await page.locator('#scProdPrice').textContent();assert.equal(price,['₹2,097','₹1,398','₹1,048'][tier]);}
  await page.evaluate(()=>{scQtyChange(1);scAddToCart()});
  assert.deepEqual(await page.evaluate(()=>STORE.cart.map(p=>({qty:p.qty,tabs:p.tierTabs,rate:p.tierRate}))),[{qty:2,tabs:30,rate:1048}]);
  if(process.env.QA_SCREENSHOTS)await page.screenshot({path:`${process.env.QA_SCREENSHOTS}/review-product-${width}.png`});console.log(`PASS ${width}: page bounds, gallery geometry, pack selection, sticky/cart amount and quantity`);await context.close();
 }}finally{await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
