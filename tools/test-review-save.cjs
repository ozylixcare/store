const fs = require('fs');
const vm = require('vm');
const assert = require('assert/strict');
const auth = fs.readFileSync(__dirname + '/../scripts/auth-core.js', 'utf8');
const core = fs.readFileSync(__dirname + '/../scripts/store-core.js', 'utf8');
const submit = auth.slice(auth.indexOf('let reviewSubmissionPending'), auth.indexOf('// ── CART ──', auth.indexOf('let reviewSubmissionPending')));
const load = core.slice(core.indexOf('const REVIEW_REQUEST_VERSION'), core.indexOf('\nconst STORE =', core.indexOf('const REVIEW_REQUEST_VERSION')));
function setup() {
 const view={expanded:true,page:2};const input={value:'My actual review'};const btn={}; const messages=[];const calls=[];
 const c=vm.createContext({console,AbortSignal,Response, currentProduct:{id:1,name:'Product'},selectedRating:5,API_BASE:'https://api.example',REVIEWS:{1:[]},REVIEWS_LOADED:{},PRODUCT_RATINGS:{},_reviewsBatchDone:Promise.resolve([]),_loadProductRatingsDone:Promise.resolve(),FEATURED_REVIEWS_CACHE:[],
 getCurrentUser:()=>({name:'Customer'}),localStorage:{getItem:()=> 'session'},openAuth:()=>{},document:{getElementById:()=>input,querySelector:()=>btn},setRating:r=>c.selectedRating=r,showToast:(...x)=>messages.push(x),rvViewState:()=>view,refreshProductReviewUI:()=>{},fetch:async(url,opts)=>{calls.push({url,opts});const row={id:12,product_id:1,user_name:'Customer',rating:5,review_text:'My actual review'};return new Response(JSON.stringify(url.includes('public-reviews')?{reviews:[row]}:{ok:true,review:row}));}});
 vm.runInContext(load+'\n'+submit,c);return {c,input,btn,messages,calls,view};
}
(async()=>{
 let x=setup();await x.c.submitReview();assert.equal(JSON.parse(x.calls[0].opts.body).rating,5);assert.equal(x.c.REVIEWS[1][0].id,12);assert.equal(x.input.value,'');assert.equal(x.c._reviewsBatchDone,null);
 // Failed saves neither invent a review nor discard the customer's draft.
 x=setup();x.c.fetch=async()=>new Response(JSON.stringify({error:'Purchase required'}),{status:403});await x.c.submitReview();assert.equal(x.c.REVIEWS[1].length,0);assert.equal(x.input.value,'My actual review');assert.equal(x.c.selectedRating,5);assert.equal(x.btn.disabled,false);assert.match(x.messages[0][0],/Purchase required/);
 // Double clicks share one write; navigation cannot change the submitted product.
 x=setup();let resolve;let writes=0;x.c.fetch=async(url)=>{if(url.includes('public-reviews'))return new Response(JSON.stringify({reviews:[{id:12,product_id:1,rating:5}]}));writes++;return new Promise(r=>resolve=r)};const saving=x.c.submitReview();await x.c.submitReview();assert.equal(writes,1);x.c.currentProduct={id:2};resolve(new Response(JSON.stringify({ok:true,review:{id:12,product_id:1,rating:5}})));await saving;assert.equal(x.c.REVIEWS[1][0].id,12);assert.equal(x.input.value,'My actual review');
 // A pre-save GET finishing late cannot erase the confirmed write.
 x=setup();let finishRead;let reads=0;x.c.fetch=async(url)=>url.includes('public-reviews')?(++reads===1?new Promise(r=>finishRead=r):new Response(JSON.stringify({reviews:[{id:12,product_id:1,rating:5}]}))):new Response(JSON.stringify({ok:true,review:{id:12,product_id:1,rating:5}}));const reading=x.c.loadProductReviews(1);await x.c.submitReview();finishRead(new Response(JSON.stringify({reviews:[]})));await reading;assert.equal(x.c.REVIEWS[1][0].id,12);
 // Reload reads server rows without an HTTP-cache response or full product rebuild.
 x=setup();x.c.fetch=async(url,options)=>{assert.equal(options.cache,'no-store');return new Response(JSON.stringify({reviews:[{id:12,rating:5}]}))};await x.c.loadProductReviews(1);assert.equal(x.c.REVIEWS[1][0].id,12);assert.equal(x.c.REVIEWS_LOADED[1],true);
 // A successful POST with a row missing on reload cannot invent a local review.
 x=setup();x.c.fetch=async(url)=>new Response(JSON.stringify(url.includes('public-reviews')?{reviews:[]}:{ok:true,review:{id:12,product_id:1}}));await x.c.submitReview();assert.equal(x.c.REVIEWS[1].length,0);assert.equal(x.input.value,'My actual review');assert.match(x.messages.at(-1)[0],/publication could not be confirmed/);
 // Read failures preserve the draft, and pending moderation is explicit.
 x=setup();x.c.fetch=async(url)=>new Response(JSON.stringify(url.includes('public-reviews')?{error:'Unavailable'}:{ok:true,review:{id:12,product_id:1}}),{status:url.includes('public-reviews')?503:200});await x.c.submitReview();assert.equal(x.input.value,'My actual review');assert.equal(x.c.REVIEWS[1].length,0);
 x=setup();x.c.fetch=async(url)=>new Response(JSON.stringify(url.includes('public-reviews')?{reviews:[]}:{ok:true,review:{id:12,product_id:1,status:'pending'}}));await x.c.submitReview();assert.equal(x.input.value,'');assert.equal(x.c.REVIEWS[1].length,0);assert.match(x.messages.at(-1)[0],/awaiting approval/);
 x=setup();x.c.fetch=async(url)=>new Response(JSON.stringify(url.includes('public-reviews')?{reviews:[{id:12,product_id:1,rating:5,created_at:'2026-01-01',updated_at:'2026-10-07'}]}:{ok:true,updated:true,review:{id:12,product_id:1}}));await x.c.submitReview();assert.equal(x.view.page,0);assert.equal(x.view.expanded,false);assert.equal(x.c.REVIEWS[1][0].updatedAt,'2026-10-07');assert.match(x.messages.at(-1)[0],/existing review was updated/);
 assert.ok(!load.includes('buildProductPage('));assert.ok(!submit.includes('buildProductPage('));
 console.log('PASS: confirmed save, failure/draft recovery, duplicate click, product navigation, stale GET race, reload and partial rendering');
})().catch(e=>{console.error(e);process.exitCode=1});


