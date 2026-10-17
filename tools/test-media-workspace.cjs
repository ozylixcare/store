const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'admin.html'),'utf8');
 const a=html.indexOf('<div class="page" id="page-banners">'),b=html.indexOf('<!-- ═════════════ STORE EDITOR',a);
 const css=fs.readFileSync(path.join(root,'styles/admin-main.css'),'utf8')+fs.readFileSync(path.join(root,'styles/admin-pages.css'),'utf8')+fs.readFileSync(path.join(root,'styles/admin-media-workspace.css'),'utf8');
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,args:['--no-sandbox']});
 try{for(const width of [360,390,768,820,1024,1440]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://127.0.0.1:48777/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<html></html>'}));await page.goto('http://127.0.0.1:48777/');
 await page.setContent('<html><head><style>'+css+' .page{display:none;padding:16px}.page.active{display:block}body{margin:0}</style></head><body>'+html.slice(a,b)+'</body></html>');
 await page.addScriptTag({content:`window.calls=[];window.toggleSelectAllPhotos=()=>{};window.loadBanners=async()=>{};window.loadPhotoLibrary=async()=>{};window.renderPhotoGrid=()=>{};window._mediaSelected=new Set();window._mediaLibraryImgs=Array.from({length:48},(_,i)=>({filename:(i?'file-'+i:'hero')+'.webp',url:'/cdn-storage/ozylix%20store/'+(i?'file-'+i:'hero')+'.webp',size:2048,created_at:new Date().toISOString()}));window._mediaFiltered=()=>_mediaLibraryImgs;window._mediaAltMap=()=>({});window.fmtBytes=n=>(n||0)+' B';window.isVideoFileUrl=u=>/\\.mp4$/.test(u);window.adminCdnImg=u=>u;window.apiFetch=async(p)=>({ok:true,json:async()=>p.includes('site-media')?{data:[{key:'home.banner.1',url:'https://media.example/storage/v1/object/public/ozylix%20store/hero.webp'}]}:{data:[]}});window.showPage=n=>document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-'+n));window.loadBannerManagers=async()=>{};window.loadSiteImages=async()=>{};window.loadPromoMedia=async()=>{};window.loadPromoStripMedia=async()=>{};window.togglePhotoSelect=(name,value)=>{value?_mediaSelected.add(name):_mediaSelected.delete(name);calls.push(['select',name,value]);};window.updateMediaSelectedCount=()=>{};window.addLibraryImageToOpenProduct=u=>calls.push(['product',u]);window.deletePhoto=n=>calls.push(['delete',n]);window.promptPhotoAlt=n=>calls.push(['alt',n]);window.toast=()=>{};`});
 await page.evaluate(()=>{document.getElementById('siteImagesGroups').innerHTML='<section data-sec="global">Logo</section><section data-sec="about page">About</section><section id="siteimgEdu">Product education</section>';document.getElementById('homeBannerManager').innerHTML='<div class="card"><img class="banner-preview" src="/fixture.webp"><div>Home banner 1</div></div>';});
 await page.addScriptTag({path:path.join(root,'scripts',process.env.MEDIA_WORKSPACE_BUNDLE||'admin-media-workspace.js')});
 await page.evaluate(()=>showPage('banners'));assert.equal(await page.locator('#page-banners .media-category-list button').count(),4);
 await page.locator('#page-banners [data-media-placement="strip"]').click();assert.equal(await page.locator('#media-placement-strip').isVisible(),true);
 assert.equal(await page.locator('#media-placement-home').isVisible(),false);
 await page.locator('#page-banners .media-page-switch').getByRole('button',{name:'Site Images',exact:true}).click();assert.equal(await page.locator('#media-fixed-slots [data-sec="global"]').isVisible(),true);
 await page.locator('#page-siteimages [data-media-placement="education"]').click();assert.equal(await page.locator('#siteimgEdu').isVisible(),true);assert.equal(await page.locator('#media-fixed-slots [data-sec="global"]').isVisible(),false);
 await page.evaluate(()=>document.getElementById('siteImagesGroups').innerHTML='<section data-sec="global">Logo after reload</section><section id="siteimgEdu">Education after reload</section>');await page.waitForTimeout(20);assert.equal(await page.locator('#siteimgEdu').isVisible(),true);assert.equal(await page.locator('#media-fixed-slots [data-sec="global"]').isVisible(),false);
 await page.locator('#page-siteimages [data-media-placement="products"]').click();assert.equal(await page.locator('#media-placement-products').isVisible(),true);
 await page.evaluate(async()=>{showPage('photolibrary');await loadPhotoLibrary();});assert.equal(await page.locator('#photoGrid .media-file-card').count(),40);assert.match(await page.locator('.media-usage-label').first().textContent(),/home.banner.1/);
 await page.getByRole('button',{name:'Show next 8 files'}).click();assert.equal(await page.locator('#photoGrid .media-file-card').count(),48);
 await page.locator('[data-library-category="assigned"]').click();assert.equal(await page.locator('#photoGrid .media-file-card').count(),1);
 await page.locator('#photoGrid [data-media-action="details"]').click();assert.equal(await page.locator('#mediaFileDetails').isVisible(),true);assert.match(await page.locator('#mediaFileDetails').textContent(),/home.banner.1/);await page.locator('#mediaFileDetails').getByRole('button',{name:'Close',exact:true}).click();
 await page.locator('#photoGrid [data-media-action="select"]').check();assert.equal(await page.evaluate(()=>_mediaSelected.size),1);
 await page.locator('#photoGrid [data-media-action="product"]').click();assert.equal(await page.evaluate(()=>calls.at(-1)[0]),'product');
 await page.locator('[data-library-category="unassigned"]').click();assert.equal(await page.locator('#photoGrid .media-file-card').count(),40);await page.locator('#mediaSelectAll').check();assert.equal(await page.evaluate(()=>_mediaSelected.size),41,'only displayed files added to existing selection');
 for(const name of ['banners','siteimages','photolibrary']){await page.evaluate(n=>showPage(n),name);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow on '+name+' '+width);}
 const duplicateIds=await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);return ids.filter((id,i)=>ids.indexOf(id)!==i)});assert.deepEqual(duplicateIds,[]);assert.deepEqual(errors,[]);
 if(process.env.MEDIA_QA_SCREENSHOT&&[390,1440].includes(width)){await page.evaluate(()=>showPage('banners'));await page.screenshot({path:process.env.MEDIA_QA_SCREENSHOT+'-'+width+'.png',fullPage:true});}
 console.log('PASS rebuilt pages, category isolation/reload, details, selection, reuse, pagination and geometry at '+width+'px');await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
