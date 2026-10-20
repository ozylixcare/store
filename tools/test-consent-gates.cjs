'use strict';
const vm=require('vm'),fs=require('fs'),assert=require('node:assert/strict');
function setup(preferences,restricted=false){
 const storage=new Map();if(preferences)storage.set('ozylix.privacy.v1',JSON.stringify({version:1,...preferences}));const loaded=[];
 const c={console,Set,Date,JSON,URL,URLSearchParams,Number,Promise,location:{origin:'https://www.ozylix.com',hostname:'www.ozylix.com',pathname:'/account',href:'https://www.ozylix.com/account?email=private@example.invalid',search:'?email=private@example.invalid'},navigator:{userAgent:'Browser',globalPrivacyControl:restricted},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{readyState:'loading',addEventListener(){},createElement(){return{}},head:{appendChild(s){loaded.push(s.src)}}}};c.window=c;vm.createContext(c);
 vm.runInContext(fs.readFileSync('scripts/privacy-controls.js','utf8'),c);vm.runInContext(fs.readFileSync('scripts/tracking.js','utf8'),c);return{c,loaded};
}
for(const preferences of [null,{analytics:false,advertising:false}]){const {c,loaded}=setup(preferences);assert.equal(loaded.filter(s=>/googletagmanager|facebook/.test(s)).length,0);c._trackPage('account');assert.equal(c.dataLayer.length,0);}
const opted=setup({analytics:true,advertising:true});assert.ok(opted.loaded.some(s=>/gtag/.test(s)));assert.ok(opted.loaded.some(s=>/fbevents/.test(s)));opted.c._trackPage('account');assert.ok(!JSON.stringify(opted.c.dataLayer).includes('private@example.invalid'));const n=opted.c.dataLayer.length;opted.c._trackSearch('private@example.invalid');assert.equal(opted.c.dataLayer.length,n);
const analytics=setup({analytics:true,advertising:false});assert.ok(!analytics.loaded.some(s=>/facebook|gtm.js/.test(s)));
assert.equal(setup({analytics:true,advertising:true},true).loaded.filter(s=>/googletagmanager|facebook/.test(s)).length,0);
for(const p of ['index.html','privacy/index.html','faq/index.html']){const html=fs.readFileSync(p,'utf8');assert.ok(!/<script[^>]+src=["']https:\/\/www.googletagmanager.com/.test(html));assert.ok(!html.includes("fbq('init'"));assert.ok(!html.includes('facebook.com/tr?'));assert.ok(html.includes('privacy-controls.js'));}
console.log('PASS consent: no optional SDK/events before choice, category separation, GPC, URL/search minimisation and HTML loader removal');
