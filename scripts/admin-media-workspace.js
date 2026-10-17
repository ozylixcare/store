/* Media navigation uses existing authenticated upload and placement handlers. */
(function () {
  'use strict';
  const placements = [
    ['home','Home & Shop hero','Top rotating banner on Home and Shop','2.33:1 · 1600 × 686','/','siteimg-home-banners','homeBannerManager'],
    ['shop','Shop promotion strips','Below the Shop product grid','11:1 · 2200 × 200','/shop','siteimg-shop-banners','shopBannerManager'],
    ['products','Product fallback images','Only when a product has no SKU photo','Square · 1400 × 1400','/shop','siteimg-products','fallbackManager'],
    ['education','Product education','Know Your Product tabs on each product page','Four tabs · four creatives per tab','/shop','siteimg-education','siteImagesGroups'],
    ['cards','Home product promos','Product promotion carousel between sections','Square · 1400 × 1400','/','siteimg-promo-cards','promoMediaGrid'],
    ['strip','Home scrolling strip','Optional scrolling cards below the hero','Square image or short video','/','siteimg-promo-strip','promoStripGrid']
  ];
  let selected = 'home', usage = new Map(), usageReady = false;
  const escape = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function canonical(value) {
    try { let p=decodeURIComponent(new URL(value,location.origin).pathname); return p.replace(/^.*\/(?:cdn-storage|storage\/v1\/object\/public)\//,'').replace(/^\//,''); } catch (_) {return '';}
  }
  window.selectMediaPlacement = function (name) {
    selected = placements.some(p=>p[0]===name)||['brand','about'].includes(name) ? name : 'home';
    document.querySelectorAll('.media-placement-panel').forEach(panel=>panel.hidden=panel.id!=='media-placement-'+selected);
    const fixed=document.getElementById('media-fixed-slots');if(fixed)fixed.hidden=!['education','brand','about'].includes(selected);
    applyFixedFilter();
    document.querySelectorAll('[data-media-placement]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.mediaPlacement===selected));});
    updateLocationGuide();
    const page=document.getElementById('page-siteimages');if(page)page.querySelectorAll('video').forEach(v=>{if(v.closest('[hidden]'))v.pause();});
  };
  window.openMediaPlacement = function(name){showPage(['products','education','brand','about'].includes(name)?'siteimages':'banners');selectMediaPlacement(name);};
  window.renderMediaBannerOverview = function(){selectMediaPlacement(['home','shop','cards','strip'].includes(selected)?selected:'home');};
  loadBanners=async function(){await Promise.all([loadBannerManagers(),loadPromoMedia(),loadPromoStripMedia()]);};
  window.setMediaUsageFilter=function(){renderPhotoGrid();};
  function addUsage(url,label){const k=canonical(url);if(k){const values=usage.get(k)||[];if(!values.includes(label))values.push(label);usage.set(k,values);}}
  async function loadUsage(){
    usageReady=false;
    try {
      const responses=await Promise.all(['/api/admin/site-media','/api/admin/promo-media','/api/products'].map(p=>apiFetch(p)));
      if(responses.some(r=>!r.ok))throw Error('Placement lookup unavailable');
      const [slots,promos,products]=await Promise.all(responses.map(r=>r.json()));usage=new Map();
      (slots.data||[]).forEach(row=>addUsage(row.url,row.key));
      (promos.data||[]).forEach(row=>addUsage(row.src,'Home scrolling strip'+(row.active?'':' (hidden)')));
      const productRows=Array.isArray(products)?products:(products.data||products.products||[]);
      productRows.forEach(p=>{[p.image,p.image_url,...(Array.isArray(p.images)?p.images:[])].forEach(u=>{if(typeof u==='string')addUsage(u,'Product: '+(p.name||p.id));});});
      usageReady=true;
    }catch(_){usageReady=false;}
    renderPhotoGrid();
  }
  const oldFilter=_mediaFiltered;
  _mediaFiltered=function(){const rows=oldFilter();const filter=document.getElementById('mediaUsageFilter')?.value||'all';return rows.filter(img=>{const refs=usage.get(canonical(img.url))||[];return filter==='all'||!usageReady||(usageReady&&(filter==='assigned'?refs.length>0:filter==='unassigned'?refs.length===0:refs.some(r=>filter==='products'?r.startsWith('Product:'):!r.startsWith('Product:'))));});};
  const oldLibrary=loadPhotoLibrary;
  loadPhotoLibrary=async function(){await oldLibrary();await loadUsage();};
  const bannerNames=['home','shop','cards','strip'];
  const fixedNames=['brand','about','products','education'];
  const extra={brand:['Brand & logo','The logo used in the header and mobile menu','Transparent logo image','/'],about:['About page','About hero background and manufacturing photograph','Use the labelled image slot','/about']};
  let visibleFiles=40;
  function titleFor(key){return extra[key]?.[0]||placements.find(p=>p[0]===key)?.[1]||key;}
  function navigation(keys){return keys.map((key,i)=>'<button type="button" data-media-placement="'+key+'" onclick="selectMediaPlacement(\''+key+'\')" aria-pressed="false"><span class="media-category-number">'+String(i+1).padStart(2,'0')+'</span><span>'+escape(titleFor(key))+'</span><span aria-hidden="true">→</span></button>').join('');}
  function shell(page,title,description,active){
    const header=document.createElement('header');header.className='media-workspace-header';header.innerHTML='<div><span class="media-eyebrow">OZYLIX · MEDIA WORKSPACE</span><h1>'+title+'</h1><p>'+description+'</p></div><nav class="media-page-switch" aria-label="Media pages">'+[['banners','Banners'],['photolibrary','Photo Library'],['siteimages','Site Images']].map(([id,label])=>'<button class="'+(id===active?'active':'')+'" onclick="showPage(\''+id+'\')" type="button">'+label+'</button>').join('')+'</nav>';
    page.replaceChildren(header);page.classList.add('media-workspace');
    const layout=document.createElement('div');layout.className='media-workspace-layout';layout.innerHTML='<aside class="media-category-sidebar"><span class="media-eyebrow">CHOOSE A CATEGORY</span><div class="media-category-list"></div></aside><div class="media-workspace-content"></div>';page.appendChild(layout);return layout;
  }
  function updateLocationGuide(){
    const info=extra[selected]||(()=>{const p=placements.find(p=>p[0]===selected);return[p[1],p[2],p[3],p[4]];})();
    const host=bannerNames.includes(selected)?'banners':'siteimages',guide=document.getElementById('media-guide-'+host);
    if(!guide)return;
    guide.innerHTML='<div class="media-store-map" aria-label="Position on storefront"><span>Store header</span><div class="media-map-slot">'+escape(info[0])+'</div><span>Products & page content</span><span>Store footer</span></div><div class="media-guide-copy"><span class="media-eyebrow">WHERE THIS APPEARS</span><h2>'+escape(info[0])+'</h2><p>'+escape(info[1])+'</p><div class="media-guide-spec">'+escape(info[2])+'</div><div class="media-guide-actions"><a class="btn btn-secondary" href="https://www.ozylix.com'+info[3]+'" target="_blank" rel="noopener">View storefront ↗</a>'+(selected==='products'?'<button class="btn btn-primary" onclick="showPage(\'products\')">Manage product photos →</button>':'')+'</div></div>';
  }
  function applyFixedFilter(){
    const root=document.getElementById('siteImagesGroups');if(!root)return;
    root.querySelectorAll(':scope > [data-sec]').forEach(n=>{const group=n.dataset.sec; n.hidden=!((selected==='brand'&&group==='global')||(selected==='about'&&group==='about page'));});
    const edu=root.querySelector('#siteimgEdu');if(edu)edu.hidden=selected!=='education';
  }
  function fileDetails(index){
    const img=_mediaFiltered()[index];if(!img)return;
    const dialog=document.getElementById('mediaFileDetails'),refs=usage.get(canonical(img.url))||[];
    const url=mediaSource(img.url),video=isVideoFileUrl(img.url);
    dialog.innerHTML='<div class="media-detail-header"><h2>File details</h2><button class="btn btn-secondary" data-close-media type="button">Close</button></div><div class="media-detail-preview">'+(video?'<video controls playsinline preload="metadata" src="'+escape(url)+'"></video>':'<img src="'+escape(url)+'" alt="'+escape(img.original_name||img.filename)+'">')+'</div><h3>'+escape(img.original_name||img.filename)+'</h3><p>'+escape(fmtBytes(img.size))+' · '+(video?'Video':'Image')+'</p><h4>Matched storefront locations</h4><p>'+escape(usageReady?(refs.length?refs.join(' · '):'No placement found in the checked product, site-image and promotion records. This does not prove the file is safe to delete.'):'Placement lookup is unavailable. Do not treat this file as unused.')+'</p><p class="media-detail-note">Uploading stores the file. A file appears on the storefront only after it is assigned in Banners, Site Images or Products.</p>';
    dialog.querySelector('[data-close-media]').onclick=()=>dialog.close();dialog.showModal();
  }
  function mediaSource(value){try{const u=new URL(adminCdnImg(value),location.origin);return ['http:','https:'].includes(u.protocol)?u.href:'';}catch(_){return '';}}
  renderPhotoGrid=function(){
    const all=typeof _mediaLibraryImgs!=='undefined'?(_mediaLibraryImgs||[]):[],rows=_mediaFiltered(),alt=typeof _mediaAltMap==='function'?_mediaAltMap():{};
    const count=(id,n)=>{const el=document.getElementById(id);if(el)el.textContent=n;};
    count('tabCountAll',all.length);count('tabCountImage',all.filter(i=>!isVideoFileUrl(i.url)).length);count('tabCountVideo',all.filter(i=>isVideoFileUrl(i.url)).length);count('tabCountRecent',all.filter(i=>(Date.now()-new Date(i.created_at||0))/86400000<=7).length);
    count('mediaFileTotal',all.length);count('mediaImageTotal',all.filter(i=>!isVideoFileUrl(i.url)).length);count('mediaVideoTotal',all.filter(i=>isVideoFileUrl(i.url)).length);
    const summary=document.getElementById('mediaSummary');if(summary)summary.textContent=rows.length+' matching files · '+fmtBytes(all.reduce((n,i)=>n+(Number(i.size)||0),0));
    const grid=document.getElementById('photoGrid');if(!grid)return;
    grid.innerHTML=rows.slice(0,visibleFiles).map((img,i)=>{const video=isVideoFileUrl(img.url),refs=usage.get(canonical(img.url))||[],name=img.original_name||img.filename,checked=typeof _mediaSelected!=='undefined'&&_mediaSelected.has(img.filename);return '<article class="media-file-card photo-item'+(checked?' selected':'')+'"><div class="media-file-top"><label><input type="checkbox" data-media-action="select" data-media-index="'+i+'" '+(checked?'checked':'')+' aria-label="Select '+escape(name)+'"> Select</label><span>'+(video?'VIDEO':'IMAGE')+'</span></div><div class="media-file-preview">'+(video?'<video src="'+escape(mediaSource(img.url))+'" controls playsinline preload="none"></video>':'<img src="'+escape(mediaSource(img.url))+'" alt="'+escape(alt[img.filename]||name)+'" loading="lazy" decoding="async">')+'</div><div class="media-file-info"><h3 title="'+escape(name)+'">'+escape(name)+'</h3><small>'+escape(fmtBytes(img.size))+'</small><p class="media-usage-label">'+escape(usageReady?(refs.length?'Used in: '+refs.join(' · '):'No placement found in checked records'):'Placement status unavailable')+'</p></div><div class="media-file-actions">'+[['details','Details'],['copy','Copy link'],['product','Add to product'],['alt','Alt text'],['delete','Delete']].map(([action,label])=>'<button type="button" data-media-action="'+action+'" data-media-index="'+i+'" class="'+(action==='delete'?'media-file-delete':'')+'">'+label+'</button>').join('')+'</div></article>';}).join('')||'<div class="media-library-empty"><h3>No matching files</h3><p>Change the category or file filter, or upload a new image or video.</p></div>';
    const more=document.getElementById('mediaLoadMore');if(more){more.hidden=rows.length<=visibleFiles;more.textContent='Show next '+Math.min(40,Math.max(0,rows.length-visibleFiles))+' files';}
    if(typeof updateMediaSelectedCount==='function')updateMediaSelectedCount();
  };
  toggleSelectAllPhotos=function(checked){_mediaFiltered().slice(0,visibleFiles).forEach(img=>togglePhotoSelect(img.filename,checked));renderPhotoGrid();};
  window.selectMediaLibraryCategory=function(value){document.getElementById('mediaUsageFilter').value=value;document.querySelectorAll('[data-library-category]').forEach(n=>n.setAttribute('aria-pressed',String(n.dataset.libraryCategory===value)));visibleFiles=40;renderPhotoGrid();};
  function init(){
    const bannerPage=document.getElementById('page-banners'),sitePage=document.getElementById('page-siteimages'),libraryPage=document.getElementById('page-photolibrary');if(!bannerPage||!sitePage||!libraryPage)return;
    const parts=new Map(placements.map(p=>[p[0],{header:document.getElementById(p[5]),manager:document.getElementById(p[6])}]));
    const siteGroups=document.getElementById('siteImagesGroups');
    const libraryNodes={actions:libraryPage.querySelector('.page-hdr .page-actions'),drop:document.getElementById('mediaDropzone'),progress:document.getElementById('uploadProgress'),bulk:libraryPage.querySelector('.filter-bar'),toolbar:libraryPage.querySelector('.media-tabs'),grid:document.getElementById('photoGrid')};
    const banners=shell(bannerPage,'Banners & promotions','Choose a storefront location, review its format, then upload or replace the creative.','banners');
    banners.querySelector('.media-category-list').innerHTML=navigation(bannerNames);
    const bannerContent=banners.querySelector('.media-workspace-content'),bannerGuide=document.createElement('section');bannerGuide.id='media-guide-banners';bannerGuide.className='media-location-guide';bannerContent.appendChild(bannerGuide);
    bannerNames.forEach(key=>{const p=parts.get(key),panel=document.createElement('section');panel.id='media-placement-'+key;panel.className='media-placement-panel media-editor-panel';p.header.querySelector('.page-title').textContent='Creatives in this location';p.header.querySelector('.page-sub')?.remove();panel.append(p.header,p.manager);bannerContent.appendChild(panel);});
    const site=shell(sitePage,'Site images','Manage brand images, About-page visuals, product photos and education cards by their exact location.','siteimages');site.querySelector('.media-category-list').innerHTML=navigation(fixedNames);
    const siteContent=site.querySelector('.media-workspace-content'),siteGuide=document.createElement('section');siteGuide.id='media-guide-siteimages';siteGuide.className='media-location-guide';siteContent.appendChild(siteGuide);
    const productPanel=document.createElement('section');productPanel.className='media-placement-panel media-editor-panel';productPanel.id='media-placement-products';parts.get('products').header.querySelector('.page-title').textContent='Category fallback images';productPanel.append(parts.get('products').header,parts.get('products').manager);siteContent.appendChild(productPanel);
    const fixed=document.createElement('section');fixed.id='media-fixed-slots';fixed.className='media-editor-panel';fixed.appendChild(siteGroups);siteContent.appendChild(fixed);
    const library=shell(libraryPage,'Photo & video library','Browse stored files, check their placement, and reuse them. Uploading here does not publish a file automatically.','photolibrary');
    library.querySelector('.media-category-list').innerHTML=[['all','All stored files'],['assigned','Assigned media'],['products','Product photos'],['website','Website & banners'],['unassigned','No placement found']].map(([key,label])=>'<button type="button" data-library-category="'+key+'" onclick="selectMediaLibraryCategory(\''+key+'\')" aria-pressed="'+(key==='all')+'"><span>'+label+'</span><span aria-hidden="true">→</span></button>').join('');
    const libraryContent=library.querySelector('.media-workspace-content'),stats=document.createElement('div');stats.className='media-library-stats';stats.innerHTML='<div><span>All files</span><strong id="mediaFileTotal">—</strong></div><div><span>Images</span><strong id="mediaImageTotal">—</strong></div><div><span>Videos</span><strong id="mediaVideoTotal">—</strong></div>';libraryContent.appendChild(stats);
    const upload=document.createElement('section');upload.className='media-library-upload';const uploadText=document.createElement('div');uploadText.innerHTML='<span class="media-eyebrow">UPLOAD TO LIBRARY</span><h2>Add images or videos</h2><p>Files are stored in Ozylix media storage, not the GitHub code repository. Maximum 50 MB per file.</p>';upload.append(uploadText,libraryNodes.actions,libraryNodes.drop,libraryNodes.progress);libraryContent.appendChild(upload);
    const controls=document.createElement('section');controls.className='media-library-controls';controls.append(libraryNodes.toolbar,libraryNodes.bulk);libraryContent.append(controls,libraryNodes.grid);
    const usageFilter=document.createElement('select');usageFilter.id='mediaUsageFilter';usageFilter.hidden=true;usageFilter.innerHTML=['all','assigned','products','website','unassigned'].map(v=>'<option value="'+v+'">'+v+'</option>').join('');libraryContent.appendChild(usageFilter);
    const more=document.createElement('button');more.id='mediaLoadMore';more.className='btn btn-secondary media-load-more';more.hidden=true;more.onclick=()=>{visibleFiles+=40;renderPhotoGrid();};libraryContent.appendChild(more);
    const note=document.createElement('p');note.className='media-storage-note';note.textContent='Alt text is saved in this browser. “No placement found” checks known product, site and promo records; it is not permission to delete the file.';libraryContent.appendChild(note);
    const detail=document.createElement('dialog');detail.id='mediaFileDetails';detail.className='media-file-dialog';detail.addEventListener('close',()=>detail.querySelectorAll('video').forEach(v=>v.pause()));libraryPage.appendChild(detail);
    libraryNodes.grid.onclick=event=>{const action=event.target.closest('[data-media-action]');if(!action)return;const index=Number(action.dataset.mediaIndex),img=_mediaFiltered()[index];if(!img)return;switch(action.dataset.mediaAction){case 'select':togglePhotoSelect(img.filename,action.checked);action.closest('.media-file-card').classList.toggle('selected',action.checked);break;case 'details':fileDetails(index);break;case 'copy':navigator.clipboard.writeText(img.url).then(()=>toast('Media link copied')).catch(()=>toast('Could not copy the link','error'));break;case 'product':addLibraryImageToOpenProduct(img.url);break;case 'alt':promptPhotoAlt(img.filename);break;case 'delete':deletePhoto(encodeURIComponent(img.filename));break;}};
    document.getElementById('photoFileInput').hidden=true;
    libraryNodes.toolbar.querySelectorAll('.media-tab').forEach(tab=>{const button=document.createElement('button');button.type='button';['class','data-tab','onclick'].forEach(a=>button.setAttribute(a,tab.getAttribute(a)||''));button.innerHTML=tab.innerHTML;tab.replaceWith(button);});
    document.getElementById('mediaSearch').setAttribute('aria-label','Search media files');document.getElementById('mediaSort').setAttribute('aria-label','Sort media files');
    libraryNodes.drop.textContent='Drop files here, or use Upload Images / Videos above';
    const bulkLabel=document.getElementById('mediaSelectAll').parentElement;[...bulkLabel.childNodes].filter(n=>n.nodeType===3).forEach(n=>n.textContent=' Select displayed files');
    const originalShowPage=showPage;
    showPage=function(name){const result=originalShowPage.apply(this,arguments);if(name==='banners')selectMediaPlacement(bannerNames.includes(selected)?selected:'home');if(name==='siteimages')selectMediaPlacement(fixedNames.includes(selected)?selected:'brand');document.querySelectorAll('.media-workspace:not(.active) video').forEach(v=>v.pause());return result;};
    const fixedObserver=new MutationObserver(applyFixedFilter);fixedObserver.observe(siteGroups,{childList:true,subtree:true});
    const previewObserver=new MutationObserver(()=>document.querySelectorAll('.media-workspace video[autoplay]').forEach(v=>{v.removeAttribute('autoplay');v.pause();v.controls=true;}));[bannerPage,sitePage].forEach(page=>previewObserver.observe(page,{childList:true,subtree:true}));
    selectMediaPlacement('home');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
