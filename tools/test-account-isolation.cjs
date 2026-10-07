const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('scripts/auth-core.js','utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const db=new Map(),elements={ordersList:{innerHTML:''},invoicesList:{innerHTML:''}};
const user={id:1,email:'a@example.com',name:'A'},token='a.'+Buffer.from(JSON.stringify({id:1,email:user.email,exp:Date.now()/1000+3600})).toString('base64url')+'.sig';
db.set('asc_user',JSON.stringify(user));db.set('asc_jwt',token);
const c=vm.createContext({console,Date,Number,String,Set,Map,JSON,atob,localStorage:{getItem:k=>db.get(k)||null},window:{},document:{getElementById:id=>elements[id]},API_BASE:'https://test',_renderOrderCards:(rows,el)=>el.innerHTML=JSON.stringify(rows)});
vm.runInContext(section('function getCurrentUser()', '// Shared post-login'),c);
vm.runInContext(section('function accountSessionMatches(', 'function resetAccountSession('),c);
vm.runInContext(section('async function loadOrdersList()', 'async function loadInvoicesList()'),c);
vm.runInContext(section('async function loadInvoicesList()', 'function openTracking('),c);
vm.runInContext(section('function _vitaKey(', 'function _vitaBlank('),c);
async function run(){
 assert.equal(c.getCurrentUser().id,1);
 db.set('asc_user',JSON.stringify({...user,email:'b@example.com'}));assert.equal(c.getCurrentUser(),null);db.set('asc_user',JSON.stringify(user));
 assert.notEqual(c._vitaKey('an@example.com'),c._vitaKey('c0@example.com'));
 db.set('asc_orders',JSON.stringify([{orderId:'FORGED',email:user.email}]));
 let finish;c.fetchWithTimeout=()=>new Promise(r=>finish=r);
 const pending=c.loadOrdersList();db.set('asc_jwt','different-account');finish({ok:true,json:async()=>({data:[{id:'A-ORDER',customer_email:user.email}]})});await pending;
 assert.doesNotMatch(String(elements.ordersList.innerHTML),/A-ORDER/);assert.equal(c.window.__INVOICE_ORDERS,undefined);
 db.set('asc_jwt',token);c.fetchWithTimeout=async()=>({ok:true,json:async()=>({data:[{id:'VERIFIED',customer_email:user.email},{id:'OTHER',customer_email:'b@example.com'}]})});
 await c.loadOrdersList();assert.match(elements.ordersList.innerHTML,/VERIFIED/);assert.doesNotMatch(elements.ordersList.innerHTML,/FORGED|OTHER/);
 c.fetchWithTimeout=async()=>{throw Error('offline')};await c.loadOrdersList();assert.match(elements.ordersList.innerHTML,/unavailable/);assert.doesNotMatch(elements.ordersList.innerHTML,/FORGED/);
 await c.loadInvoicesList();assert.match(elements.invoicesList.innerHTML,/unavailable/);
 console.log('Account isolation passed: JWT/profile mismatch, distinct keys, stale response, cross-account filtering, no browser merge, outage retry.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
