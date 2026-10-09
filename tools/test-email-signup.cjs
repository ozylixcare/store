const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../scripts/auth-core.js','utf8');
const start=source.indexOf('// Email signup stays pending');
const end=source.indexOf('// GOOGLE SIGN-IN',start);
const block=source.slice(start,source.lastIndexOf('// ═',end));
function setup(){
 const elements={},storage=new Map(),messages=[];
 for(const id of ['regName','regEmail','regPhone','regPassword','signupOtp','signupOtpForm','registerDetails','signupOtpEmail','registerSubmitBtn','signupOtpSubmit','loginSubmitBtn','loginEmail','loginPassword'])elements[id]={value:'',textContent:'',hidden:false,focus(){}};
 elements.regName.value='Customer';elements.regEmail.value='customer@example.test';elements.regPassword.value='Password123';
 const claims={id:42,email:'customer@example.test',exp:Math.floor(Date.now()/1000)+3600};
 const good={token:'server-token',user:{id:42,email:claims.email,name:'Customer'}};
 const c=vm.createContext({console,Date,Number,String,JSON,API_BASE:'https://api.example',
  document:{getElementById:id=>elements[id]},localStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)||null},
  clearAuthMessages(){},showAuthError:m=>messages.push(m),showAuthSuccess:m=>messages.push(m),showToast:m=>messages.push(m),
  parseGoogleJWT:t=>t==='server-token'?claims:null,closeAuth(){},updateAccountNavBtn(){},resumeCheckoutIfWaiting(){},postLoginRedirect(){},
  fetchWithTimeout:async()=>({ok:true,json:async()=>({pending_otp:true,nonce:'challenge'})})});
 vm.runInContext(block,c);
 return {c,elements,storage,messages,good};
}
(async()=>{
 let x=setup();await x.c.doRegister();assert.equal(x.storage.size,0);assert.equal(x.elements.regPassword.value,'');assert.equal(x.elements.signupOtpForm.hidden,false);
 x.elements.signupOtp.value='123';await x.c.verifySignupOtp();assert.equal(x.storage.size,0);assert.match(x.messages.at(-1),/six-digit/);
 x.elements.signupOtp.value='123456';x.c.fetchWithTimeout=async()=>({ok:false,json:async()=>({error:'Wrong code'})});await x.c.verifySignupOtp();assert.equal(x.storage.size,0);
 x.c.fetchWithTimeout=async()=>({ok:true,json:async()=>x.good});await x.c.verifySignupOtp();assert.equal(x.storage.get('asc_jwt'),'server-token');
 x=setup();x.c.fetchWithTimeout=async()=>({ok:true,json:async()=>x.good});await x.c.doRegister();assert.equal(x.storage.size,0);assert.match(x.messages.at(-1),/verification is not available/);
 x=setup();let finish,calls=0;x.c.fetchWithTimeout=()=>{calls++;return new Promise(resolve=>finish=resolve)};
 const saving=x.c.doRegister();await x.c.doRegister();assert.equal(calls,1);
 vm.runInContext('emailAuthVersion++',x.c);finish({ok:true,json:async()=>({pending_otp:true,nonce:'challenge'})});await saving;
 assert.equal(x.storage.size,0);assert.equal(x.elements.registerDetails.hidden,false,'closed/tab-switched requests must not change the signup screen');
 const nav=source.slice(source.indexOf('function updateAccountNavBtn()'),source.indexOf('// ── Retry init'));
 const button={style:{},setAttribute(){},textContent:''};
 const nc={document:{getElementById:()=>button},syncAccountSession(){},getCurrentUser:()=>({name:'Customer'})};
 vm.runInNewContext(nav+'\nupdateAccountNavBtn();',nc);assert.equal(button.textContent,'C');
 nc.document.getElementById=()=>null;vm.runInNewContext(nav+'\nupdateAccountNavBtn();',nc);
 console.log('PASS: pending signup, strict OTP, wrong-code recovery, verified session, old-backend rejection, double-click/stale response and account icon.');
})().catch(e=>{console.error(e);process.exitCode=1});
