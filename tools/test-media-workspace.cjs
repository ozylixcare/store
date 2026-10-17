const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'admin.html'),'utf8');
 const a=html.indexOf('<div class="page" id="page-banners">'),b=html.indexOf('<!-- ═════════════ STORE EDITOR',a);
 const css=fs.readFileSync(path.join(root,'styles/admin-main.css'),'utf8')+fs.readFileSync(path.join(root,'styles/admin-pages.css'),'utf8')+fs.readFileSync(path.join(root,'styles/admin-media-workspace.css'),'utf8');
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,args:['--no-sandbox']});
 try{for(const width of [390,820,1440]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:48777/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<html></html>'}));await page.goto('http://127.0.0.1:48777/');
 await page.setContent('<html><head><style>'+css+' .page{display:none;padding:16px}.page.active{display:block}body{margin:0}</style></head><body>'+html.slice(a,b)+'</body></html>');
 await page.addScriptTag({content:`window.loadBanners=async()=>{};window.loadPhotoLibrary=async()=>{};window.renderPhotoGrid=()=>{document.getElementById('photoGrid').innerHTML=_mediaFiltered().map(()=>'<div class="photo-item"></div>').join('')};window._mediaFiltered=()=>[{url:'/cdn-storage/ozylix%20store/hero.webp'},{url:'/cdn-storage/ozylix%20store/other.webp'}];window.apiFetch=async(p)=>({ok:true,json:async()=>p.includes('site-media')?{data:[{key:'home.banner.1',url:'https://media.example/storage/v1/object/public/ozylix%20store/hero.webp'}]}:{data:[]}});window.showPage=n=>document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+n));`});
 await page.addScriptTag({path:path.join(root,'scripts/admin-media-workspace.js')});
 await page.evaluate(()=>showPage('banners'));assert.equal(await page.locator('.media-location-card').count(),4);
 await page.getByRole('button',{name:'Manage this location →'}).first().click();assert.equal(await page.locator('.media-placement-panel:not([hidden])').count(),1);
 await page.getByRole('button',{name:'Home scrolling strip',exact:true}).click();assert.equal(await page.locator('#media-placement-strip').isVisible(),true);
 const v=await page.locator('#promoStripGrid').evaluate(el=>{el.innerHTML='<video autoplay muted></video>';return true;});await page.waitForTimeout(50);assert.equal(await page.locator('#promoStripGrid video').getAttribute('controls'),'');
 await page.evaluate(async()=>{showPage('photolibrary');await loadPhotoLibrary();});assert.match(await page.locator('.media-usage-label').first().textContent(),/home.banner.1/);
 await page.locator('#mediaUsageFilter').selectOption('unassigned');assert.equal(await page.locator('#photoGrid .photo-item').count(),1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 console.log('PASS placement navigation, preview controls, assignment filtering and layout at '+width+'px');await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
