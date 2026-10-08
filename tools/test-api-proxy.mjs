import assert from 'node:assert/strict';
import {handleApiRequest,publicMedia} from '../worker/api-proxy.js';
const original=globalThis.fetch;let calls=[];
globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json({image:'https://syayxfxyqnnvmvrjoxyw.supabase.co/storage/v1/object/public/ozylix%20store/example.webp'},{headers:{'Cache-Control':'public,max-age=100'}})};
try {
 const req=new Request('https://www.ozylix.com/api/checkout?provider=cashfree',{method:'POST',headers:{Origin:'https://www.ozylix.com',Authorization:'Bearer customer-token','X-Payment-Session':'payment-proof','X-Forwarded-For':'spoof','CF-Connecting-IP':'192.0.2.4','Content-Type':'application/json'},body:'{"quantity":2}'});
 const res=await handleApiRequest(req);assert.equal(res.status,200);assert.equal(res.headers.get('Cache-Control'),'no-store');assert.equal((await res.json()).image,'/cdn-storage/ozylix%20store/example.webp');
 assert.equal(calls[0].url,'https://backend-s7ih.onrender.com/api/checkout?provider=cashfree');assert.equal(calls[0].options.headers.get('Authorization'),'Bearer customer-token');assert.equal(calls[0].options.headers.get('X-Payment-Session'),'payment-proof');assert.equal(calls[0].options.headers.get('X-Forwarded-For'),'192.0.2.4');assert.equal(await new Response(calls[0].options.body).text(),'{"quantity":2}');
 const before=calls.length;assert.equal((await handleApiRequest(new Request('https://www.ozylix.com/api/reviews',{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'}))).status,403);assert.equal(calls.length,before);
 assert.equal((await handleApiRequest(new Request('https://www.ozylix.com/api/admin/orders'))).status,404);
 assert.equal((await handleApiRequest(new Request('https://www.ozylix.com/telemetry/api/orders',{method:'POST'}))).status,404);
 assert.equal((await handleApiRequest(new Request('https://www.ozylix.com/api/%2Fsecret'))).status,400);
 await handleApiRequest(new Request('https://www.ozylix.com/telemetry/api/track',{method:'POST',body:'{}'}));assert.equal(calls.at(-1).url,'https://marketing-automation-rmcb.onrender.com/api/track');
 globalThis.fetch=async()=>{throw Error('private upstream host detail')};const failed=await handleApiRequest(new Request('https://www.ozylix.com/api/products'));assert.equal(failed.status,502);assert.ok(!(await failed.text()).includes('upstream'));
 assert.equal(publicMedia({list:['https://example.com/image.png']}).list[0],'https://example.com/image.png');
 console.log('PASS same-origin API: auth/payment proof/body preservation, origin gate, private admin, fixed telemetry, path validation, media masking, uncached error recovery');
}finally{globalThis.fetch=original}
