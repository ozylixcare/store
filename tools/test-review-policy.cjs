'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const auth=fs.readFileSync(require.resolve('../scripts/auth-core.js'),'utf8'),cart=fs.readFileSync(require.resolve('../scripts/cart-utils.js'),'utf8');
const slots={policy:{},message:{},cod:{},badge:{}};
const context=vm.createContext({console,Number,String,Date,JSON,Array,Math,CustomEvent:class{},
  document:{dispatchEvent(){},querySelectorAll:s=>s==='[data-delivery-policy]'?[slots.policy]:s==='[data-cod-message]'?[slots.cod]:[slots.message],querySelector:()=>slots.badge},
  updateCodBtnNote(){},getOrderTotal:()=>({paidSubtotal:2096}),getSelectedGateway:()=> 'cod',
  API_BASE:'https://api.example.invalid',_reviewsBatchDone:null,REVIEWS_BATCH_TOTAL:0,REVIEWS_BATCH_AVG:null,FEATURED_REVIEWS_AVG:null,REVIEW_PRODUCT_TOTALS:[],
  fetch:async()=>({ok:true,json:async()=>({total:10001,average:4.2,product_totals:[{product_id:8,total:10001,average:4.2}],reviews:[{id:1,user_name:'Buyer',rating:1,verified:false},{id:2,user_name:'Buyer',rating:5,verified:true}]})}),
  esc:String,starCount:n=>n,
});
vm.runInContext(cart.slice(cart.indexOf('var SHIP_THRESHOLD'),cart.indexOf('function loadDeliveryPolicy')),context);
vm.runInContext(auth.slice(auth.indexOf('async function loadReviewsBatch'),auth.indexOf('async function loadReviewStats')),context);
vm.runInContext(auth.slice(auth.indexOf('function testiCardHtml'),auth.indexOf('async function renderTestimonials')),context);
(async()=>{
  context.applyDeliveryPolicy({shippingFee:69,codShippingFee:69,freeShippingThreshold:999});
  assert.equal(context.calcShipping(998.99),69);assert.equal(context.calcShipping(999),0);assert.equal(context.calcShipping(2096,'cod'),69);
  assert.ok(slots.policy.textContent.includes('₹69'));assert.ok(slots.policy.textContent.includes('₹999'));assert.equal(slots.badge.textContent,'Delivery ₹69');
  assert.ok(!slots.cod.textContent.includes('no extra'));
  context.applyDeliveryPolicy({shippingMode:'free',codShippingFee:0});assert.equal(context.calcShipping(1),0);assert.equal(context.calcShipping(2096,'cod'),0);
  const rows=await context.loadReviewsBatch();assert.equal(context.REVIEWS_BATCH_TOTAL,10001);assert.equal(context.REVIEWS_BATCH_AVG,4.2);
  assert.equal(rows[0].verified,false);assert.equal(rows[1].verified,true);
  assert.ok(!context.testiCardHtml({...rows[0],text:'Fine'}).includes('Verified Buyer'));assert.ok(context.testiCardHtml({...rows[1],text:'Fine'}).includes('Verified Buyer'));
  console.log('PASS delivery threshold/COD text, changed admin policy, full aggregate totals and conditional verified badges');
})().catch(e=>{console.error(e);process.exitCode=1;});
