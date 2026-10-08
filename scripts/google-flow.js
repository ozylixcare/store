// Sign-in context stays in this tab. Only the verifier hash goes in the URL.
var _googleFlow = null;
var _googleFlowPreparing = null;
var _googleCodePending = false;
function _readGoogleFlow() {
  try {
    var flow=JSON.parse(sessionStorage.getItem('ozylix.google_flow') || 'null');
    return flow && typeof flow.state==='string' && /^[a-f0-9]{64}$/.test(flow.verifier || '') && Date.now()-flow.at<8*60*1000 ? flow : null;
  } catch (_) { return null; }
}
function _clearGoogleFlow() {
  _googleFlow=null; _googleCodePending=false;
  try {sessionStorage.removeItem('ozylix.google_flow');}catch(_){}
}
function _consumeGoogleFlow(state) {
  var flow=_readGoogleFlow();
  if(!flow || flow.state!==state) throw new Error('Google sign-in did not start in this tab or has expired.');
  _clearGoogleFlow(); return flow;
}
function _googleCodeBody(response) {
  var flow=response.authFlow;
  if(!flow) throw new Error('Google sign-in context is missing. Please try again.');
  return {code:response.code,redirect_uri:flow.redirect_uri,auth_state:flow.state,verifier:flow.verifier,flow:response.flow || 'popup'};
}
async function _prepareGoogleFlow() {
  if(_googleFlow && Date.now()-_googleFlow.at<8*60*1000) return _googleFlow;
  if(_googleFlowPreparing) return _googleFlowPreparing;
  _googleFlowPreparing=(async function(){
    var bytes=new Uint8Array(32); window.crypto.getRandomValues(bytes);
    var verifier=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
    var hash=new Uint8Array(await window.crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
    var binding=Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('');
    var r=await fetchWithTimeout(API_BASE+'/api/auth/google-config?binding='+binding,{headers:{Accept:'application/json'},credentials:'omit',cache:'no-store'},15000);
    var config=await r.json();
    if(!r.ok || !config.client_id || !config.state || config.redirect_uri!==window.location.origin) throw new Error('Google sign-in could not be prepared.');
    var flow={client_id:config.client_id,redirect_uri:config.redirect_uri,state:config.state,verifier,at:Date.now()};
    sessionStorage.setItem('ozylix.google_flow',JSON.stringify(flow));
    _googleFlow=flow; GOOGLE_CLIENT_ID=config.client_id;
    if(typeof _initGoogleOneTap==='function') _initGoogleOneTap();
    return flow;
  })();
  try{return await _googleFlowPreparing;}finally{_googleFlowPreparing=null;}
}
