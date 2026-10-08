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
   await button.scrollIntoViewIfNeeded();const before=await button.boundingBox();await button.hover();await page.waitForTimeout(250);const hover=await button.boundingBox();
   assert.deepEqual(before,hover,'button target stays still on hover');
   await page.mouse.down();await page.waitForTimeout(100);assert.deepEqual(before,await button.boundingBox(),'button target stays still on press');await page.mouse.move(0,0);await page.mouse.up();
   assert.equal(await button.evaluate(b=>getComputedStyle(b).color),'rgb(255, 255, 255)');
   const glass=await page.locator('.oz-liquid').evaluateAll(nodes=>nodes.filter(n=>n.tagName!=='BUTTON' && n.tagName!=='A').length);assert.equal(glass,0,'glass confined to buttons');
   await page.screenshot({path:path.join(require('node:os').tmpdir(),'ozylix-store-'+width+'.png'),fullPage:false});
   const motionErrors=errors.filter(e=>/createOzylixAnalytics|store-motion|liquid/.test(e));assert.deepEqual(motionErrors,[]);
   console.log('Storefront',width,'stable targets, colorful button surfaces, glass only on controls; baseline script errors:',errors.slice(0,5));
   await context.close();
  }
  const context=await browser.newContext({viewport:{width:390,height:850},reducedMotion:'reduce'});await context.route('**/*',r=>new URL(r.request().url()).origin===base?r.continue():r.abort());const page=await context.newPage();await page.goto(base+'/index.html');await page.waitForTimeout(800);assert.equal(await page.locator('.oz-liquid').first().evaluate(b=>getComputedStyle(b).transitionDuration),'0s');await context.close();
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
