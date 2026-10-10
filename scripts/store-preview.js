(function () {
  'use strict';
  var device=document.getElementById('previewDevice'),page=document.getElementById('previewPage'),design=document.getElementById('previewDesign'),frame=document.getElementById('devicePreview');
  var heights={360:780,390:844,768:1024,820:1180,1024:768,1280:900};
  function refresh() {
    var url=new URL(page.value,location.origin);
    if(design.value!=='published') url.searchParams.set('preview','1');
    if(design.value==='classic'||design.value==='sage-olive') url.searchParams.set('templatePreview',design.value);
    frame.width=device.value; frame.height=heights[device.value]; frame.src=url.pathname+url.search;
    document.getElementById('openStore').href=url.pathname+url.search;
    document.getElementById('previewStatus').textContent='Preview: '+device.selectedOptions[0].textContent+'. Changing the design here does not publish it.';
  }
  [device,page,design].forEach(function(el){el.addEventListener('change',refresh);});
  frame.addEventListener('load',function(){
    // Keep the existing content editor in sync when the inner frame finishes.
    try { if(parent!==window && typeof parent.storeEdPatchContentPreview==='function') parent.storeEdPatchContentPreview(); } catch(_) {}
  });
  refresh();
})();
