(function () {
  'use strict';
  var nonce = null, busy = false;
  function status(message) { var el=document.getElementById('accountPrivacyStatus');if(el)el.textContent=message; }
  async function request(path, method, body) {
    var token=localStorage.getItem('asc_jwt') || '';
    if(!token || !getCurrentUser())throw new Error('Please sign in again.');
    var controller=new AbortController();var timeout=setTimeout(function(){controller.abort();},15000);
    var response;try{response=await fetch('/api/account/'+path,{method:method||'GET',credentials:'same-origin',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:controller.signal});}catch(e){throw new Error(e.name==='AbortError'?'Privacy settings took too long to respond. Please retry.':e.message);}finally{clearTimeout(timeout);}
    var data=await response.json();
    if(!accountSessionMatches(token))throw new Error('Your account session changed. Please reopen Privacy.');
    if(!response.ok)throw new Error(data.error || 'Please retry later.');
    return data;
  }
  window.loadAccountPrivacy=async function(){
    nonce=null;document.getElementById('privacySave').disabled=true;document.getElementById('privacySendCode').disabled=true;status('Loading privacy settings…');
    try{var data=await request('privacy');document.getElementById('privacySave').disabled=false;document.getElementById('privacyEmail').checked=data.email===true;document.getElementById('privacyWhatsapp').checked=data.whatsapp===true;document.getElementById('privacySendCode').disabled=!data.deletion_available;status(data.deletion_available?'Choose the updates you want.':'Preferences are available. For a verified deletion request, contact hi@ozylix.com.');}
    catch(e){status(e.message);}
  };
  async function action(button) {
    if(busy)return;busy=true;button.disabled=true;button.setAttribute('aria-busy','true');status('Saving your request…');
    try{
      if(button.id==='privacySave'){
        await request('privacy','PUT',{email:document.getElementById('privacyEmail').checked,whatsapp:document.getElementById('privacyWhatsapp').checked});status('Preferences saved. Essential order, security and delivery messages continue.');
      }else if(button.id==='privacySendCode'){
        var data=await request('deletion-code','POST',{});nonce=data.nonce;document.getElementById('privacyDeleteStep').hidden=false;status('Check your account email for the deletion code. It expires in five minutes.');
      }else if(button.id==='privacyConfirmDelete'){
        if(!nonce)throw new Error('Request a deletion code first.');
        if(document.getElementById('privacyDeleteWord').value!=='DELETE')throw new Error('Type DELETE to confirm.');
        var code=document.getElementById('privacyDeleteCode').value.trim();if(!/^\d{6}$/.test(code))throw new Error('Enter the six-digit code.');
        await request('delete','POST',{nonce:nonce,code:code,confirmation:'DELETE'});
        nonce=null;doLogout();
        try{await window.ozylixPrivacy.clearDevice();}catch(_){}
        if(typeof STORE!=='undefined'){STORE.cart=[];STORE.wishlist=[];STORE.updateCartUI();}
        showToast('Account disabled. Personal data cleanup is pending; required transaction records remain restricted.');
      }
    }catch(e){status(e.message);}finally{busy=false;button.disabled=false;button.removeAttribute('aria-busy');}
  }
  document.addEventListener('click',function(e){var button=e.target.closest('#privacySave,#privacySendCode,#privacyConfirmDelete');if(button)void action(button);});
})();

