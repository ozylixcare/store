import assert from 'node:assert/strict';
import {handleApiRequest} from '../worker/api-proxy.js';
const fetchOriginal=globalThis.fetch,timerOriginal=globalThis.setTimeout;
const budgets=[];let received;
globalThis.setTimeout=(fn,ms)=>{budgets.push(ms);return timerOriginal(fn,ms);};
globalThis.fetch=async(url,options)=>{received={url,options};return Response.json({success:true,url:'/cdn-storage/ozylix%20store/test.mp4'});};
try {
 const body=new FormData();body.append('image',new Blob(['fixture'],{type:'video/mp4'}),'test.mp4');
 const result=await handleApiRequest(new Request('https://back.ozylix.com/api/upload/image',{method:'POST',headers:{Authorization:'Bearer test','X-Password-Proof':'single-use-proof'},body}));
 assert.equal(result.status,200);assert.equal(received.options.headers.get('X-Password-Proof'),'single-use-proof');assert.equal(received.options.headers.get('Authorization'),'Bearer test');assert.equal(budgets.at(-1),90000);
 await handleApiRequest(new Request('https://back.ozylix.com/api/admin/site-media'));assert.equal(budgets.at(-1),25000);
 const blocked=await handleApiRequest(new Request('https://www.ozylix.com/api/upload/image',{method:'POST',body:'x'}));assert.equal(blocked.status,404);
 console.log('PASS protected multipart proof forwarding, bounded upload budget and public-host rejection');
}finally{globalThis.fetch=fetchOriginal;globalThis.setTimeout=timerOriginal;}
