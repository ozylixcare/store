const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;let f=path.join(root,p);if(!fs.existsSync(f))f=path.join(root,p.replace('.min.','.'));if(!path.extname(p)||p==='/')f=path.join(root,'index.html');if(!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[path.extname(f)]||'text/plain');res.end(fs.readFileSync(f));});
await new Promise(r=>server.listen(8782,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox']});
try {
const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),requests=[],errors=[];
let sdkAttempts=0;
await context.route('**/*',route=>{
 const u=new URL(route.request().url());requests.push(u.pathname);
 if(u.hostname==='sdk.cashfree.com') {sdkAttempts++;return sdkAttempts===1?route.abort():route.fulfill({contentType:'text/javascript',body:'window.Cashfree=function(){return {checkout:function(){}}}'});}
 if(u.pathname.startsWith('/api/')||u.pathname.startsWith('/telemetry/')) return route.fulfill({contentType:'application/json',body:JSON.stringify({data:[],products:[],theme:null,reviews:[],total:0,average:null,histogram:{},product_totals:[],ok:true})});
 return u.origin==='http://127.0.0.1:8782'?route.continue():route.abort();
});
const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
await page.goto('http://127.0.0.1:8782');await page.waitForTimeout(500);
assert.equal(requests.some(p=>p.includes('payment-flow')||p.includes('blog-page')||p.includes('account-page')||p.includes('cashfree.js')),false,'home does not download optional feature code');
await page.evaluate(async()=>{showPage('blog');await renderFullBlog();});
assert.ok(await page.locator('#fullBlogGrid .blog-card').count()>0,'blog renders after lazy load');
assert.equal(requests.filter(p=>p.includes('blog-page')).length,1);
await page.evaluate(async()=>{showPage('checkout');const modules=await ensureOzylixModules();await modules.load('checkout');});
assert.equal(requests.filter(p=>p.includes('payment-flow')).length,1);
assert.equal(sdkAttempts,0,'checkout entry does not fetch a provider SDK');
await page.evaluate(async()=>{
 const user={id:101,email:'test@example.invalid',name:'Test User'};
 localStorage.setItem('asc_user',JSON.stringify(user));
 localStorage.setItem('asc_jwt','e30.'+btoa(JSON.stringify({...user,exp:Math.floor(Date.now()/1000)+600}))+'.fixture');
 showPage('account');await loadAccountPage();
});
await page.waitForTimeout(100);
assert.equal(requests.filter(p=>p.includes('account-page')).length,1);
assert.ok(await page.locator('#ordersList').textContent(),'default orders panel renders');
const beforeInvoices=requests.filter(p=>p==='/api/orders/my').length;
await page.evaluate(async()=>{await switchAccountPanel('invoices');});
await page.waitForTimeout(100);
assert.ok(await page.locator('#invoicesList').textContent(),'invoices render when selected');
assert.equal(requests.filter(p=>p==='/api/orders/my').length,beforeInvoices+1,'invoice and summary share one request');
await page.evaluate(()=>{showPage('home');doLogout();});
const failure=await page.evaluate(async()=>{try{await OzylixModules.load('cashfree');return false;}catch(error){return true;}});
assert.equal(failure,true);
await page.evaluate(async()=>{await Promise.all([OzylixModules.load('cashfree'),OzylixModules.load('cashfree')]);await OzylixModules.load('cashfree');});
assert.equal(sdkAttempts,2,'failed SDK retries once; simultaneous and subsequent loads reuse it');
assert.deepEqual(errors,[]);
console.log('PASS browser: optional features absent on home, blog/checkout initialize once, payment SDK loads on demand and retries safely');
} finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1});
