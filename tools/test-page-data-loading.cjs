const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const auth=read('scripts/auth-core.js');
const wrap={innerHTML:'',scrollIntoView(){}};
let requests=[],total=23;
const rows=Array.from({length:23},(_,i)=>({id:i+1,user_name:'Customer',rating:i%5+1,review_text:'Review',created_at:'2026-10-10',product_id:1}));
const context={window:{},Date,Map,AbortSignal,console,REVIEWS:{},REVIEWS_LOADED:{},REVIEW_META:{},PRODUCT_RATINGS:{},currentProduct:{id:1},API_BASE:'',esc:String,starCount:Number,
document:{getElementById:id=>id==='rvListWrap'?wrap:null},
fetch:async url=>{requests.push(url);const p=new URL(url,'https://example.invalid').searchParams,offset=Number(p.get('offset')),limit=Number(p.get('limit'));await new Promise(r=>setImmediate(r));return {ok:true,json:async()=>({reviews:rows.slice(offset,Math.min(offset+limit,total)),has_more:offset+limit<total})};}};
vm.createContext(context);
vm.runInContext(auth.slice(auth.indexOf('const RV_TOP_N'),auth.indexOf('// ── PRODUCT PAGE')),context);
const core=read('scripts/store-core.js');
vm.runInContext(core.slice(core.indexOf('const REVIEW_REQUEST_VERSION'),core.indexOf('\nconst STORE =',core.indexOf('const REVIEW_REQUEST_VERSION'))),context);
const cards=()=>wrap.innerHTML.split('class="rv-card"').length-1;
(async()=>{
await Promise.all([context.loadProductReviews(1),context.loadProductReviews(1)]);
assert.equal(requests.length,1);assert.match(requests[0],/limit=100&offset=0/);assert.equal(cards(),3);
assert.equal(context.PRODUCT_RATINGS[1].count,23);assert.equal(context.PRODUCT_RATINGS[1].avg,rows.reduce((sum,r)=>sum+r.rating,0)/rows.length);
await context.rvExpand(1);assert.equal(cards(),10);assert.equal(requests.length,1);
await context.rvGoPage(1,1);assert.equal(cards(),10);assert.equal(requests.length,1);
await context.rvGoPage(1,1);assert.equal(cards(),3);assert.match(wrap.innerHTML,/Showing 21–23 of 23/);
const before=requests.length;await context.rvGoPage(1,-1);assert.equal(requests.length,before,'previous page reuses the complete loaded review list');
await context.rvCollapse(1);assert.equal(cards(),3);assert.equal(requests.length,before);
await context.loadProductReviews(1,{force:true});assert.equal(requests.length,before+1);assert.match(requests.at(-1),/fresh=1/);
context.rvViewState(1).expanded=true;context.rvViewState(1).page=2;total=2;await context.loadProductReviews(1,{force:true});assert.equal(cards(),2);assert.match(wrap.innerHTML,/Showing 1–2 of 2/);
// The storefront's shared review feed retains server-wide totals even when
// only a preview of cards is displayed.
let homeCalls=0;
const home={AbortSignal,API_BASE:'',fetch:async url=>{homeCalls++;assert.match(url,/public-reviews\?limit=100$/);return {ok:true,json:async()=>({reviews:rows,total:78,average:4.4,product_totals:[]})};}};
vm.createContext(home);vm.runInContext(auth.slice(auth.indexOf('let FEATURED_REVIEWS_CACHE'),auth.indexOf('function reviewErrorHTML')),home);
const [homeRows]=await Promise.all([home.loadReviewsBatch(),home.loadReviewsBatch()]);assert.equal(homeCalls,1);assert.equal(homeRows.length,23);
assert.equal(vm.runInContext('REVIEWS_BATCH_TOTAL',home),78);assert.equal(vm.runInContext('REVIEWS_BATCH_AVG',home),4.4);
// Concurrent private reads share one request and discard a changed session.
let token='customer-a',calls=0,finish;
const account={localStorage:{getItem:()=>token},getCurrentUser:()=>({email:token+'@example.invalid'}),accountSessionMatches:t=>t===token,API_BASE:'',
fetchWithTimeout:()=>{calls++;return new Promise(r=>finish=()=>r({ok:true,json:async()=>({data:[{customer_email:'customer-a@example.invalid'},{customer_email:'customer-b@example.invalid'}]})}));}};
vm.createContext(account);vm.runInContext(auth.slice(auth.indexOf('let _accountOrdersPending'),auth.indexOf('function loadActiveAccountPanel')),account);
const first=account.readAccountOrders(),second=account.readAccountOrders();assert.equal(calls,1);finish();const [a,b]=await Promise.all([first,second]);assert.equal(a.length,1);assert.equal(b.length,1);
const outgoing=account.readAccountOrders();token='customer-b';finish();await assert.rejects(outgoing,/Session changed/);
assert.ok(!read('index.html').includes('src="https://sdk.cashfree.com/js/v3/cashfree.js"'));
console.log('PASS restored product review loading/paging, storefront totals, shared requests, refresh, concurrent account reads and session isolation');
})().catch(error=>{console.error(error);process.exitCode=1});
