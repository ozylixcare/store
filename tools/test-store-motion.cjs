const {chromium}=require(require.resolve('playwright',{paths:[__dirname,process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES].filter(Boolean)}));
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8775';
(async()=>{
 const server=http.createServer((req,res)=>{let file=path.join(root,new URL(req.url,base).pathname);if(file===root+'/')file+='/index.html';if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}res.setHeader('content-type',{'.js':'application/javascript','.html':'text/html','.css':'text/css'}[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(8775,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox']}:{} )});
 try {
  for(const width of [1440,768,390]) {
   const context=await browser.newContext({viewport:{width,height:1000}});const errors=[];
   await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===base)return route.continue();if(u.hostname==='backend-s7ih.onrender.com')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({products:[],data:[],settings:{},theme:{},success:true})});return route.abort();});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/index.html');await page.waitForTimeout(1500);
   const button=page.locator('.shader-btn-primary').first();await button.waitFor({state:'visible'});
   await button.scrollIntoViewIfNeeded();
   assert.equal(await button.locator(':scope > .oz-button-glass').count(),1,'action button gets one decorative glass reflection');
   const glass=await page.locator('.oz-button-glass').evaluateAll(nodes=>nodes.filter(n=>!['BUTTON','A'].includes(n.parentElement.tagName)).length);assert.equal(glass,0,'glass confined to controls');
   await page.screenshot({path:path.join(require('node:os').tmpdir(),'ozylix-store-'+width+'.png'),fullPage:false});
   const motionErrors=errors.filter(e=>/createOzylixAnalytics|store-motion|liquid/.test(e));assert.deepEqual(motionErrors,[]);
   console.log('Storefront',width,'existing theme retained, glass only on controls; baseline script errors:',errors.slice(0,5));
   await context.close();
  }
  const fixtureContext=await browser.newContext();const fixture=await fixtureContext.newPage();
  await fixture.setContent('<style>button{background:#3d755a;color:#fff;border:2px solid #b54f58;border-radius:19px;padding:12px 23px;font:600 15px sans-serif}.qty-tier{background:white;color:black}.app-menu-item-label{color:black}</style><button role="radio" class="qty-tier">90 tablets</button><button class="app-menu-item"><span class="app-menu-item-label">Orders</span></button>');
  const snapshot=()=>fixture.locator('button').evaluateAll(nodes=>nodes.map(b=>{const s=getComputedStyle(b),r=b.getBoundingClientRect();return {background:s.background,color:s.color,border:s.border,padding:s.padding,radius:s.borderRadius,font:s.font,width:r.width,height:r.height};}));
  const before=await snapshot();const labelBefore=await fixture.locator('.app-menu-item-label').evaluate(b=>getComputedStyle(b).color);
  await fixture.addStyleTag({content:fs.readFileSync(path.join(root,'styles/liquid-buttons.css'),'utf8')});
  await fixture.addScriptTag({content:fs.readFileSync(path.join(root,'scripts/store-motion.js'),'utf8')});
  assert.deepEqual(await snapshot(),before,'glass does not alter original colors, text, borders, size or shape');
  assert.equal(await fixture.locator('.app-menu-item-label').evaluate(b=>getComputedStyle(b).color),labelBefore,'nested labels keep original theme color');
  assert.equal(await fixture.locator('button > .oz-button-glass').count(),2,'all button types get a decorative reflection');
  await fixture.locator('.app-menu-item').evaluate(b=>b.textContent='Orders updated');
  await fixture.waitForTimeout(80);assert.equal(await fixture.locator('.app-menu-item > .oz-button-glass').count(),1,'reflection survives dynamic button labels');
  await fixtureContext.close();
  const context=await browser.newContext({viewport:{width:390,height:850},reducedMotion:'reduce'});await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());const page=await context.newPage();await page.goto(base+'/index.html');await page.waitForTimeout(800);assert.equal(await page.locator('.oz-button-glass').first().evaluate(b=>getComputedStyle(b).animationName),'none');await context.close();
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
