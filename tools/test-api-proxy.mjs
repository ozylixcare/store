import assert from 'node:assert/strict';
import {handleApiRequest,publicMedia} from '../worker/api-proxy.js';
import storefront from '../worker/index.js';
const original=globalThis.fetch;let calls=[];
globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json({image:'https://syayxfxyqnnvmvrjoxyw.supabase.co/storage/v1/object/public/ozylix%20store/example.webp'},{headers:{'Cache-Control':'public,max-age=100'}})};
try {
 const assets={fetch(){throw Error('API request reached static assets')}};
 const routed=await storefront.fetch(new Request('https://www.ozylix.com/api/public-reviews?limit=3'),{ASSETS:assets},{});
 assert.equal(routed.status,200);assert.equal(calls.at(-1).url,'https://backend-s7ih.onrender.com/api/public-reviews?limit=3');
 await storefront.fetch(new Request('https://www.ozylix.com/telemetry/api/track',{method:'POST',body:'{}'}),{ASSETS:assets},{});
 assert.equal(calls.at(-1).url,'https://marketing-automation-rmcb.onrender.com/api/track');
 assert.equal((await storefront.fetch(new Request('https://www.ozylix.com/api/admin/orders'),{ASSETS:assets},{})).status,404);
 calls=[];
 const req=new Request('https://www.ozylix.com/api/checkout?provider=cashfree',{method:'POST',headers:{Origin:'https://www.ozylix.com',Authorization:'Bearer customer-token','X-Payment-Session':'payment-proof','X-Forwarded-For':'spoof','CF-Connecting-IP':'192.0.2.4','Content-Type':'application/json'},body:'{"quantity":2}'});
 const res=await handleApiRequest(req);assert.equal(res.status,200);assert.equal(res.headers.get('Cache-Control'),'no-store');assert.equal((await res.json()).image,'/cdn-storage/ozylix%20store/example.webp');
 assert.equal(calls[0].url,'https://backend-s7ih.onrender.com/api/checkout?provider=cashfree');assert.equal(calls[0].options.headers.get('Authorization'),'Bearer customer-token');assert.equal(calls[0].options.headers.get('X-Payment-Session'),'payment-proof');assert.equal(calls[0].options.headers.get('X-Forwarded-For'),'192.0.2.4');assert.equal(await new Response(calls[0].options.body).text(),'{"quantity":2}');
 await handleApiRequest(new Request('https://www.ozylix.com/api/visitors/ping',{method:'POST',headers:{'User-Agent':'Mozilla/5.0 (iPhone) Safari/604.1','Content-Type':'application/json'},body:'{}'}));
 assert.equal(calls.at(-1).options.headers.get('User-Agent'),'Mozilla/5.0 (iPhone) Safari/604.1','visitor identity must survive the proxy for bot filtering');
 const before=calls.length;assert.equal((await handleApiRequest(new Request('https://www.ozylix.com/api/reviews',{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'}))).status,403);assert.equal(calls.length,before);
 for(const path of ['/api/owner/ai/snapshot','/api/upload/library','/api/health/cache','/api/analytics/realtime','/api/docs','/api/settings','/api/gemini','/api/visitors/active','/api/%61dmin/orders']){
  assert.equal((await handleApiRequest(new Request('https://www.ozylix.com'+path))).status,404,path);
 }
 assert.equal(calls.length,before,'privileged public-host requests must never reach backend');
 await handleApiRequest(new Request('https://back.ozylix.com/api/upload/library',{headers:{Authorization:'Bearer admin'}}));
 assert.equal(calls.at(-1).options.headers.get('Authorization'),'Bearer admin');
 assert.equal((await handleApiRequest(new Request('https://www.ozylix.com/api/admin/orders'))).status,404);
 assert.equal((await handleApiRequest(new Request('https://www.ozylix.com/telemetry/api/orders',{method:'POST'}))).status,404);
 assert.equal((await handleApiRequest(new Request('https://www.ozylix.com/api/%2Fsecret'))).status,400);
 await handleApiRequest(new Request('https://www.ozylix.com/api/auth/google-code',{method:'POST',headers:{Origin:'https://www.ozylix.com','Content-Type':'application/json','X-Requested-With':'XMLHttpRequest'},body:JSON.stringify({code:'test-only',flow:'redirect',auth_state:'state',verifier:'verifier',redirect_uri:'https://www.ozylix.com'})}));
 assert.equal(calls.at(-1).options.headers.get('X-Requested-With'),'XMLHttpRequest','Google CSRF header must reach the backend');
 assert.equal(calls.at(-1).options.headers.get('Origin'),'https://www.ozylix.com');
 assert.equal(JSON.parse(await new Response(calls.at(-1).options.body).text()).auth_state,'state');
 await handleApiRequest(new Request('https://www.ozylix.com/telemetry/api/track',{method:'POST',body:'{}'}));assert.equal(calls.at(-1).url,'https://marketing-automation-rmcb.onrender.com/api/track');
 globalThis.fetch=async()=>{throw Error('private upstream host detail')};const failed=await handleApiRequest(new Request('https://www.ozylix.com/api/products'));assert.equal(failed.status,502);assert.ok(!(await failed.text()).includes('upstream'));
 assert.equal(publicMedia({list:['https://example.com/image.png']}).list[0],'https://example.com/image.png');
 console.log('PASS same-origin API: auth/payment proof/body preservation, origin gate, private admin, fixed telemetry, path validation, media masking, uncached error recovery');
}finally{globalThis.fetch=original}
