const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const catalog=require('../scripts/store-templates.js');
const loader=fs.readFileSync('scripts/themes.js','utf8');
async function render({published=null,draft=null,search='',legacy='plum'}={}) {
  const nodes={},attrs={},events=[];
  const saved={ozylix_theme:legacy};
  if(draft) saved.ozylix_storefront_theme_draft=JSON.stringify(draft);
  const context=vm.createContext({
    window:{OzylixStoreTemplates:catalog},location:{search},URLSearchParams,
    Date,CustomEvent:class{constructor(name,options){this.type=name;this.detail=options.detail;}},
    document:{readyState:'complete',documentElement:{setAttribute(k,v){attrs[k]=v;}},
      getElementById:id=>nodes[id],createElement:()=>({}),head:{appendChild(el){nodes[el.id]=el;}},dispatchEvent:e=>events.push(e)},
    localStorage:{getItem:k=>saved[k]||null,setItem:(k,v)=>saved[k]=v},
    fetch:async()=>({ok:true,json:async()=>({ok:true,theme:published})})
  });
  vm.runInContext(loader,context);await new Promise(setImmediate);
  return {nodes,attrs,events,saved};
}
(async()=>{
  const original=catalog.makeTheme('classic'),sage=catalog.makeTheme('sage-olive');
  assert.equal(original.palette.brand,'#C0394A');assert.equal(sage.palette.brand,'#2E3D28');
  original.palette.brand='changed';assert.equal(catalog.makeTheme('classic').palette.brand,'#C0394A','templates must not share mutable palettes');
  let result=await render();assert.equal(result.attrs['data-store-template'],'classic');
  result=await render({published:catalog.makeTheme('classic')});
  assert.match(result.nodes['live-theme'].textContent,/--indigo:#C0394A;/);assert.doesNotMatch(result.nodes['live-theme'].textContent,/#2E3D28/);
  result=await render({published:sage});assert.equal(result.attrs['data-store-template'],'sage-olive');
  result=await render({published:sage,draft:catalog.makeTheme('classic'),search:'?preview=1'});
  assert.equal(result.attrs['data-store-template'],'classic','published refresh cannot replace an unsaved preview');
  assert.equal(result.saved.ozylix_theme,'plum','store drafts never overwrite the admin interface palette');
  result=await render({published:catalog.makeTheme('classic'),search:'?preview=1&templatePreview=sage-olive'});
  assert.equal(result.attrs['data-store-template'],'sage-olive');
  result=await render({published:{header:{bg:'#FFFFFF',fg:'#16121A'},bubbles:'off'}});
  assert.match(result.nodes['live-theme'].textContent,/\.navbar\{background:#FFFFFF;/);
  assert.doesNotMatch(result.nodes['live-theme'].textContent,/:root\{\.navbar/,'Safari requires top-level selector rules');
  const admin=fs.readFileSync('scripts/admin-ui.js','utf8');
  const state={},elements={storeEdPickers:{innerHTML:''}};
  const adminContext=vm.createContext({window:{OzylixStoreTemplates:catalog,localStorage:{getItem:k=>state[k]||null,setItem:(k,v)=>state[k]=v}},document:{getElementById:id=>elements[id]},renderStoreEditor(){},renderStyleStrip(){},renderCombos(){}});
  vm.runInContext(admin.slice(admin.indexOf('const STORE_ED_DRAFT_KEY'),admin.indexOf('// ── Page lifecycle')),adminContext);
  vm.runInContext(admin.slice(admin.indexOf('function storeEdApplyTemplate('),admin.indexOf('function renderStoreEditor()')),adminContext);
  vm.runInContext("storeEdApplyTemplate('sage-olive')",adminContext);
  assert.equal(JSON.parse(state.ozylix_storefront_theme_draft).template,'sage-olive');
  vm.runInContext("storeEdApplyTemplate('classic')",adminContext);
  assert.equal(JSON.parse(state.ozylix_storefront_theme_draft).palette.brand,'#C0394A');
  for(const path of fs.readdirSync('.',{recursive:true}).filter(x=>x==='index.html'||x.endsWith('/index.html'))){
    if(path.includes('node_modules/'))continue;
    const html=fs.readFileSync(path,'utf8');if(!html.includes('id="page-shipping"'))continue;
    assert.ok(html.includes('--paper:#F5F3F4;'),path);
    assert.ok(html.includes('/scripts/store-templates.js'),path);
    assert.ok(html.indexOf('/styles/store-responsive.css')>html.indexOf('critical-css-account'),path);
    assert.ok(!html.includes('Sage reference:'),path);
  }
  console.log('PASS: original default, reversible templates, published refresh, isolated drafts, preview overrides, Safari CSS and all route assets');
})().catch(e=>{console.error(e);process.exitCode=1;});
