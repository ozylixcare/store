'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const source=fs.readFileSync(require.resolve('../scripts/auth-core.js'),'utf8');
const slice=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const values=new Map(),calls=[],feedback=[];let configFails=false,oneTap=0,requested=0,popup;
const context=vm.createContext({console,Date,JSON,Number,String,Uint8Array,TextEncoder,Array,GOOGLE_CLIENT_ID:null,
  window:{crypto:webcrypto,location:{origin:'https://www.ozylix.com'}},
  sessionStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},
  API_BASE:'https://api.example.invalid',
  fetchWithTimeout:async(url)=>{calls.push(url);return {ok:!configFails,json:async()=>configFails?{}:{client_id:'backend-client',redirect_uri:'https://www.ozylix.com',state:'signed-state'}};},
  _initGoogleOneTap(){},_showAuthFeedback:(kind,text)=>feedback.push(text),clearAuthMessages(){},showToast(){},
  _isMobileBrowser:()=>false,_isSafariBrowser:()=>false,
  google:{accounts:{id:{prompt(){oneTap++;}},oauth2:{initCodeClient(config){popup=config;return{requestCode(){requested++;}};}}}},
  handleGoogleCredential:async(response)=>{calls.push(context._googleCodeBody(response));},
});
vm.runInContext(fs.readFileSync(require.resolve('../scripts/google-flow.js'),'utf8'),context);
vm.runInContext(slice('function _tryOAuth2Popup()', '// ══════════════════════════════════════════════════════════'),context);
(async()=>{
  await context._prepareGoogleFlow();
  assert.equal(context.GOOGLE_CLIENT_ID,'backend-client');
  assert.ok(!calls[0].includes(context._googleFlow.verifier),'secret verifier cannot enter URLs');
  context.socialLogin('google');assert.equal(requested,1);assert.equal(oneTap,0,'One Tap suppression cannot swallow explicit sign-in');
  await popup.callback({code:'code',state:'signed-state'});
  const body=calls.at(-1);assert.equal(body.flow,'popup');assert.equal(body.auth_state,'signed-state');assert.match(body.verifier,/^[a-f0-9]{64}$/);
  assert.throws(()=>context._consumeGoogleFlow('signed-state'),'same context cannot be reused');
  await context._prepareGoogleFlow();assert.throws(()=>context._consumeGoogleFlow('wrong-state'));
  const flow=context._readGoogleFlow();flow.at=Date.now()-10*60*1000;values.set('ozylix.google_flow',JSON.stringify(flow));assert.equal(context._readGoogleFlow(),null);
  context._clearGoogleFlow();configFails=true;await assert.rejects(()=>context._prepareGoogleFlow());
  context.socialLogin('google');assert.equal(requested,1);assert.ok(feedback.some(x=>x.includes('loading')));
  console.log('PASS explicit Google click, authoritative client, secret isolation, state consumption/mismatch/expiry and readiness failure');
})().catch(e=>{console.error(e);process.exitCode=1;});
