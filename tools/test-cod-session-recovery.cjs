const fs=require('node:fs');const vm=require('node:vm');const assert=require('node:assert/strict');
const source=fs.readFileSync(__dirname+'/../scripts/auth-core.js','utf8');
const values=new Map([['asc_jwt','old-server-token'],['asc_user','profile'],['asc_cart','keep-cart']]);let resume,method,nav=0,hidden=0,orders=0,message='';
const c=vm.createContext({localStorage:{removeItem:k=>values.delete(k)},updateAccountNavBtn:()=>nav++,hideProcessingScreen:()=>hidden++,requireLoginForCheckout:(cb,m)=>{resume=cb;method=m},initiateCOD:()=>orders++,showAuthError:m=>message=m});
vm.runInContext(source.slice(source.indexOf('function recoverCodSignIn()'),source.indexOf('var codOrderInFlight')),c);c.recoverCodSignIn();assert.equal(values.has('asc_jwt'),false);assert.equal(values.has('asc_user'),false);assert.equal(values.get('asc_cart'),'keep-cart');assert.equal(method,'cod');assert.equal(orders,0);resume();assert.equal(orders,1);assert.equal(nav,1);assert.equal(hidden,1);assert.match(message,/Sign in again/);
assert.match(source,/if \(latestToken && latestToken !== _jwt\)/);assert.match(source,/recoverCodSignIn\(\);\s+return;/);assert.match(source,/function showRedirectFailure\(\)/);
console.log('PASS: rejected session cleared, cart retained, COD resumed only after login, refreshed-token retry and redirect feedback present');
