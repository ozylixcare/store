import assert from 'node:assert/strict';
import {handleApiRequest} from '../worker/api-proxy.js';
const original=globalThis.fetch;
const claims={id:42,email:'fixture@example.invalid',name:'Fixture',exp:Math.floor(Date.now()/1000)+3600};
const jwt='header.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.real-server-signature';
let received;
globalThis.fetch=async(url,options)=>{received={url,options};return Response.json({token:jwt,user:{id:42,email:claims.email,name:'Fixture'}});};
try{
const login=await handleApiRequest(new Request('https://www.ozylix.com/api/auth/email-login',{method:'POST',body:'{}'}));
for(const variant of ['/api/auth/session/','/api/AUTH/SESSION','/api/%61uth/session']){const res=await handleApiRequest(new Request('https://www.ozylix.com'+variant,{method:'POST',body:'{}'}));assert.ok(!(JSON.stringify(await res.json())).includes('real-server-signature'),'alternate auth URL must not expose bearer: '+variant);}
const cookie=login.headers.get('Set-Cookie');assert.match(cookie,/__Host-ozylix_session=/);assert.match(cookie,/Secure; HttpOnly; SameSite=Lax/);assert.match(cookie,/Path=\//);assert.ok(!cookie.includes('Domain='));
const data=await login.json();assert.ok(data.token.startsWith('cookie.'));assert.ok(!JSON.stringify(data).includes('real-server-signature'));
assert.equal((await handleApiRequest(new Request('https://www.ozylix.com/api/orders/my',{headers:{Authorization:'Bearer '+data.token}}))).status,401,'marker alone is not authorization');
await handleApiRequest(new Request('https://www.ozylix.com/api/orders/my',{headers:{Authorization:'Bearer '+data.token,Cookie:cookie.split(';')[0]}}));assert.equal(received.options.headers.get('Authorization'),'Bearer '+jwt);assert.equal(received.options.headers.get('Cookie'),null,'only selected credential reaches backend');
const other='cookie.'+Buffer.from(JSON.stringify({...claims,id:99})).toString('base64url')+'.fake';
assert.equal((await handleApiRequest(new Request('https://www.ozylix.com/api/orders/my',{headers:{Authorization:'Bearer '+other,Cookie:cookie.split(';')[0]}}))).status,401,'another tab/account marker cannot access active cookie identity');
assert.equal((await handleApiRequest(new Request('https://www.ozylix.com/api/auth/logout',{method:'POST',headers:{Origin:'https://evil.invalid'}}))).status,403);
const out=await handleApiRequest(new Request('https://www.ozylix.com/api/auth/logout',{method:'POST'}));assert.equal(out.status,204);assert.match(out.headers.get('Set-Cookie'),/Max-Age=0/);
globalThis.fetch=async()=>Response.json({status:'pending'},{status:202});const erased=await handleApiRequest(new Request('https://www.ozylix.com/api/account/delete',{method:'POST',body:'{}'}));assert.match(erased.headers.get('Set-Cookie'),/Max-Age=0/);
console.log('PASS HttpOnly sessions: no bearer in client JSON, cookie flags, marker replay denial, account identity isolation, CSRF origin gate, logout and deletion');
}finally{globalThis.fetch=original;}
