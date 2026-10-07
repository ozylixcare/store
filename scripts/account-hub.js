(function(){
  function key(){var u=getCurrentUser();return u?'ozylix_hub_preferences_'+encodeURIComponent(String(u.id)):null;}
  function apply(){
    var k=key(),p={};try{p=JSON.parse(localStorage.getItem(k)||'{}');}catch(e){}
    var host=document.getElementById('page-account');if(!host)return;
    host.dataset.accent=p.accent==='forest'?'forest':'rose';host.dataset.density=p.density==='compact'?'compact':'comfortable';
    ['accent','density'].forEach(function(n){var el=document.getElementById('hub-'+n);if(el)el.value=host.dataset[n];});
  }
  window.saveHubPreferences=function(){var k=key();if(!k)return;var p={accent:document.getElementById('hub-accent').value,density:document.getElementById('hub-density').value};try{localStorage.setItem(k,JSON.stringify(p));apply();showToast('Account appearance saved on this device.');}catch(e){showToast('Could not save appearance. Please try again.');}};
  var load=window.loadAccountPage;window.loadAccountPage=function(){load();apply();};
  window.addEventListener('storage',apply);apply();
})();
