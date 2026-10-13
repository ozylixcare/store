// Run the shipped behaviour-tab code with local DOM/network fixtures only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const acorn = require(require.resolve('acorn', {paths:[__dirname, process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES].filter(Boolean)}));

function behaviourCode(source) {
  const candidates = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'CallExpression' && node.callee.type === 'FunctionExpression') {
      const code = source.slice(node.start,node.end);
      if (code.includes('__ozyBehaviourTabs') && code.includes('mktLoadBehaviour')) candidates.push(code);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(acorn.parse(source,{ecmaVersion:'latest'}));
  assert.equal(candidates.length,1,'one behaviour tab initializer');
  return candidates[0];
}

(async () => {
  for (const file of ['scripts/admin-api.js','scripts/admin-api.min.js']) {
    const elements = new Map();
    let health = {status:'healthy'};
    let failed = false;
    let writes = 0;
    const context = {
      document:{getElementById(id) { if(!elements.has(id)) elements.set(id,{innerHTML:'',textContent:'',className:''}); return elements.get(id); }},
      MARKETING_BACKEND_URL:'https://fixture.invalid',
      fetch: async (url,options) => {
        if (options && options.method && options.method !== 'GET') writes++;
        const route = new URL(url).pathname;
        let data;
        if (route.endsWith('/health')) return {ok:!failed,status:failed?500:200,json:async()=>health};
        if (route.endsWith('/overview')) data = {live:{},traffic:{},funnel:{},revenue:{},recovery:{}};
        else if (route.endsWith('/live')) data = {visitors:[]};
        else if (route.endsWith('/products')) data = {products:[]};
        else throw new Error('Unexpected request: '+url);
        return {ok:true,json:async()=>data};
      },
    };
    context.window=context;
    vm.createContext(context);
    vm.runInContext('('+behaviourCode(fs.readFileSync(path.join(__dirname,'..',file),'utf8'))+')',context);
    const render = async () => { context.mktLoadBehaviour(); await new Promise(resolve=>setImmediate(resolve)); return elements.get('beh-health'); };
    let el = await render();
    assert.equal(el.className,'mkt-hint warn');
    assert.match(el.innerHTML,/Engine:<\/strong> status unavailable/);
    assert.doesNotMatch(el.innerHTML,/has never run|0 events|0 queued/);
    assert.match(el.innerHTML,/Meta CAPI \(status unavailable\)/);
    health = {status:'healthy',minutes_since_tick:2,events_last_hour:7,outbox:{queued:3,failed:1},channels:{email:{enabled:true},whatsapp:{enabled:false}},integrations:{meta_capi:true,ga4_mp:false}};
    el = await render();
    assert.equal(el.className,'mkt-hint ok');
    assert.match(el.innerHTML,/last tick 2m ago.*7 events.*3 queued, 1 failed/);
    assert.match(el.innerHTML,/✅ email.*⚪ whatsapp/);
    assert.match(el.innerHTML,/✅ Meta CAPI.*⚪ GA4/);
    assert.doesNotMatch(el.innerHTML,/unavailable|never run/);
    health = {...health,status:'never_run',minutes_since_tick:null};
    el = await render();
    assert.equal(el.className,'mkt-hint warn');
    assert.match(el.innerHTML,/has never run/);
    for (const status of ['stale','degraded']) {
      health = {...health,status,minutes_since_tick:30,last_tick_error:'<synthetic error>'};
      el = await render();
      assert.equal(el.className,'mkt-hint warn');
      assert.match(el.innerHTML,/&lt;synthetic error&gt;/);
    }
    failed = true;
    el = await render();
    assert.match(el.innerHTML,/Could not load: HTTP 500/);
    assert.equal(writes,0);
  }
  console.log('PASS: source and shipped admin health rendering, missing fields, measured counts, channels, never-run/stale/degraded states, escaped errors and read-only requests');
})().catch(error => { console.error(error); process.exitCode=1; });
