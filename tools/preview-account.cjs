// Isolated browser fixture: never loads production authentication or sends requests.
// node tools/preview-account.cjs [before|after]
const fs=require('fs'),cp=require('child_process');
const before=process.argv[2]==='before',root=before?'0459943':null;
const read=p=>root?cp.execFileSync('git',['show',root+':'+p],{encoding:'utf8'}):fs.readFileSync(p,'utf8');
const html=read('index.html');
fs.mkdirSync('qa-preview',{recursive:true});
let fragment=html.slice(html.indexOf('<div class="page" id="page-account"'),html.indexOf('<footer class="footer'));
fragment=fragment.replace('class="page" id="page-account"','class="page active" id="page-account"');
const extract=(source,a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
const core=read('scripts/auth-core.js');
let styles=[...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
for(const p of ['styles/store-main.css','styles/store-account-mobile.css','styles/store-responsive.css','styles/store-template-refresh.css','styles/account-refinements.css','styles/liquid-buttons.css'])styles+='\n'+read(!before&&['styles/store-main.css','styles/store-account-mobile.css','styles/store-template-refresh.css'].includes(p)?p.replace('.css','.min.css'):p).replace(/@import[^;]+;/g,'');
const nav=extract(html,'<nav class="app-bottom-nav"','<script defer src="/scripts/app-nav.js');
const header=extract(html,'<div class="app-topbar"','<nav class="app-bottom-nav"')+extract(html,'<nav class="navbar">','</nav>')+'</nav>';
const chat=extract(html,'<div class="wa-fab vita-help-fab"','<div class="wa-chat-popup"');
const fixture=`
const currentPage='account',API_BASE='/mock',testUser={id:'fixture',name:'Alexandra Wellness Member',email:'alexandra.long.email@example.test',phone:'',address:{}};
localStorage.setItem('asc_jwt','fixture-token');
const getCurrentUser=()=>testUser,accountSessionMatches=()=>true,syncAccountSession=()=>{};
const updateAccountNavBtn=()=>{},refreshAccountWelcome=()=>{},loadActiveAccountPanel=()=>loadOrdersList();
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const showToast=text=>document.getElementById('qaFeedback').textContent=text;
const openAuth=()=>{},showPage=()=>{},setAppNav=()=>{},openSideCart=()=>{},handleAccountNavClick=()=>{},toggleWAPopup=()=>showToast('Support launcher connected');
const doLogout=()=>showToast('Mock sign out: no production session affected');
const state=new URLSearchParams(location.search).get('state')||'content';
const rows=Array.from({length:14},(_,i)=>({id:'TEST-ORDER-'+String(i+1).padStart(2,'0'),orderId:'TEST-ORDER-'+String(i+1).padStart(2,'0'),date:'22 Oct 2026',created_at:'2026-10-22',status:i?'Processing':'Delivered',fulfillment:i?'Processing':'Delivered',total:1499,payment_status:'Paid',payment_method:'cashfree',vita_points_earned:i?0:1499,items:[{name:'Glutathione Effervescent Tablets — Orange Flavour',pack_size:'90 tablets',qty:2,product_id:1}],customer_email:testUser.email,awb_code:'TESTAWB123'}));
if(new URLSearchParams(location.search).has('long')){testUser.name='AlexandraVeryLongCustomerNameWithoutSpaces'.repeat(3);testUser.email='very.long.customer.email.address.for.layout.testing@example.test';rows[0].id=rows[0].orderId='TEST-LONG-ORDER-'.repeat(8);rows[0].items[0].name='VeryLongProductDescriptionWithoutSpaces'.repeat(8);}
const readAccountOrders=async()=>{if(state==='error')throw Error('Mock service unavailable');if(state==='loading')return new Promise(()=>{});return state==='empty'?[]:rows;};
const response=data=>({ok:true,json:async()=>data});
const fetchWithTimeout=async(path)=>{if(state==='error')throw Error('Mock service unavailable');if(state==='loading')return new Promise(()=>{});if(path.endsWith('/eligible'))return response({reasons:['Damaged item'],orders:state==='empty'?[]:[{order_id:'TEST-ELIGIBLE-ORDER',eligible:true,days_left:5,total:1499,created_at:'2026-10-22',items:[{id:1,name:'Glutathione Effervescent Tablets — Orange Flavour',qty:2}]}],ineligible:[]});if(path.endsWith('/returns/my'))return response({returns:state==='empty'?[]:[{id:'RETURN-TEST',order_id:'TEST-ORDER-01',created_at:'2026-10-22',status:'requested',items:[{name:'Glutathione Orange',qty:1}],admin_note:'Your request is being reviewed. We will contact you with the next step.'}]});return response({data:rows});};
window.fetch=async(path,opts)=>{if(state==='loading')return new Promise(()=>{});if(state==='error')return {ok:false,json:async()=>({error:'Mock settings unavailable'})};return response({email:false,whatsapp:false,deletion_available:true,nonce:'fixture-nonce'});};
window.ozylixPrivacy={open:()=>showToast('Cookie preference control connected'),clearDevice:async()=>{}};
const VITA={TIER_50_THRESHOLD:15000,MAX_REDEEM_PER_ORDER:5000};
const vitaToRupees=p=>p/150,getVitaState=()=>({balance:state==='empty'?0:4500,pendingPts:state==='empty'?0:1499,lifetime:5999,history:state==='empty'?[]:[{pts:1499,label:'Points earned after delivery',t:Date.now(),ref:'TEST-ORDER-01'}]}),vitaRefreshFromServer=async()=>{if(state==='loading')return new Promise(()=>{});return state!=='error';};
const vp3dHTML=()=>'',vp3dScan=()=>{},vitaCountUp=(el,n)=>el.textContent=n;
${extract(core,'async function renderVitaPanel()','// Expands the per-order breakdown')}
function openProductReview(){showToast('Mock review handler connected');}
`;
const footer=`
Object.assign(window,window.OzylixAccountPage);
window.addEventListener('popstate',()=>switchAccountPanel(new URLSearchParams(location.search).get('section')||'orders',{history:false}));
loadAccountPage();
document.getElementById('awName').textContent='Welcome back, '+testUser.name;
document.getElementById('awEmail').textContent=testUser.email;
document.getElementById('awOrders').textContent=state==='empty'?'0':'14';
document.getElementById('awPoints').textContent=state==='empty'?'0':'4,500';
document.getElementById('awSaved').textContent='₹499';
`;
fs.cpSync('assets','qa-preview/assets',{recursive:true});
const content='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ozylix Account '+(before?'Before':'After')+' — isolated QA fixture</title><style>'+styles+'</style></head><body><a class="skip-link" href="#page-account">Skip to content</a>'+header+'<div style="position:relative;top:100px;text-align:center;font:10px system-ui;color:#6d626b">ISOLATED QA FIXTURE · SYNTHETIC DATA · '+(before?'BEFORE':'AFTER')+'</div>'+fragment+nav+chat+'<p id="qaFeedback" role="status"></p><script>'+fixture+'</script><script>'+read(before?'scripts/account-page.js':'scripts/account-page.min.js')+'</script><script>'+read('scripts/account-privacy.js')+'</script><script>'+footer+'</script><script>'+read('scripts/store-motion.js')+'</script></body></html>';
fs.writeFileSync('qa-preview/'+(before?'before':'after')+'.html',content);
// The wrapper gives the iframe a real CSS viewport at each requested width.
fs.writeFileSync('qa-preview/index.html',`<!doctype html><html><head><title>Account responsive QA</title><style>body{margin:0;background:#e8e2e7;font:14px system-ui}header{padding:12px;background:white;display:flex;gap:12px;align-items:center}iframe{border:0;display:block;margin:16px auto;background:#fff}</style></head><body><header><label>Viewport <select id="width">${[320,360,390,430,768,1024,1280,1440].map(w=>'<option>'+w+'</option>')}</select></label><label>Version <select id="version"><option>after</option><option>before</option></select></label><label>Section <select id="section"><option>orders</option><option>tracking</option><option>invoices</option><option>vita</option><option>returns</option><option>profile</option><option>privacy</option></select></label><label>State <select id="state"><option>content</option><option>empty</option><option>error</option><option>loading</option><option>long</option></select></label><button id="top">Page top</button><span>Isolated iframe viewport · no production requests</span></header><iframe title="Account test viewport" width="320" height="900" src="after.html"></iframe><script>const frame=document.querySelector('iframe');function update(){frame.width=document.getElementById('width').value;frame.src=document.getElementById('version').value+'.html?section='+document.getElementById('section').value+'&state='+document.getElementById('state').value+(document.getElementById('state').value==='long'?'&long=1':'');}document.querySelectorAll('select').forEach(s=>s.onchange=update);document.getElementById('top').onclick=()=>frame.contentWindow.scrollTo({top:0,behavior:'instant'});</script></body></html>`);
console.log('Created '+(before?'before':'after')+' isolated fixture');
