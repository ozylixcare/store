/* Personal layouts across the backoffice. Stores presentation IDs only; never writes business data. */
(function () {
  'use strict';
  const root = document.getElementById('app');
  const charts = window.OzylixAdminCharts;
  if (!root || !charts) return;
  const widths = {small:4,medium:6,wide:8,full:12};
  const heights = {auto:0,short:200,medium:280,tall:380};
  const states = new Map();
  let pending = 0, pointer = null, autoScroll = 0;
  const status = document.createElement('div');
  status.className = 'dw-status'; status.setAttribute('role','status'); root.appendChild(status);
  const announce = message => { status.textContent = message; };
  const clean = value => String(value || '').replace(/\s+/g,' ').trim().slice(0,100);
  function read(page) {
    try { const data = JSON.parse(localStorage.getItem('ozylix_admin_panel_'+page.id+'_v1') || '{}');
      return {groups:data.groups && typeof data.groups === 'object' ? data.groups : {},density:data.density === 'compact' ? 'compact' : 'comfortable',depth:data.depth !== false};
    } catch (_) { return {groups:{},density:'comfortable',depth:true}; }
  }
  function save(state) {
    state.groups.forEach(group => {
      const cards = [...group.element.children].filter(el => el.classList.contains('aw-card'));
      state.settings.groups[group.id] = {order:cards.map(card => card.dataset.awId),widths:Object.fromEntries(cards.map(card => [card.dataset.awId,card.dataset.awWidth])),heights:Object.fromEntries(cards.map(card => [card.dataset.awId,card.dataset.awHeight]))};
    });
    try { localStorage.setItem('ozylix_admin_panel_'+state.page.id+'_v1',JSON.stringify(state.settings)); announce('Page layout saved in this browser.'); }
    catch (_) { announce('Layout changed for this session. Browser storage is unavailable.'); }
  }
  function appearance(state) {
    state.page.classList.toggle('aw-compact',state.settings.density === 'compact');
    state.page.classList.toggle('aw-flat',!state.settings.depth);
    state.toolbar.querySelector('[data-aw-action="depth"]').setAttribute('aria-pressed',String(state.settings.depth));
    state.toolbar.querySelector('[data-aw-density]').value = state.settings.density;
    charts.redraw();
  }
  function setDimensions(card,width,height) {
    width = Object.hasOwn(widths,width) ? width : 'medium';
    height = Object.hasOwn(heights,height) ? height : 'auto';
    card.dataset.awWidth = width; card.dataset.awHeight = height;
    card.style.setProperty('--aw-span',widths[width]);
    card.style.setProperty('--aw-chart-height',(heights[height] || 260)+'px');
    card.querySelector('[data-aw-width]').value = width;
    card.querySelector('[data-aw-height]').value = height;
  }
  function resizeButton(card) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'aw-resize';
    button.textContent = '↘'; button.title = 'Drag to resize. Arrow keys adjust chart height and card width.';
    button.setAttribute('aria-label','Resize '+(card.getAttribute('aria-label') || 'card'));
    card.appendChild(button);
  }
  function updateButtons(group) {
    const cards = [...group.element.children].filter(el => el.classList.contains('aw-card'));
    cards.forEach((card,index) => {
      card.querySelector('[data-aw-move="-1"]').disabled = index === 0;
      card.querySelector('[data-aw-move="1"]').disabled = index === cards.length-1;
    });
  }
  function addControls(card,group,state,index) {
    if (card.classList.contains('aw-card')) return;
    const label = clean(card.querySelector('.card-title,h2,h3,.kpi-label')?.textContent) || 'Section '+(index+1);
    const id = card.id || card.querySelector('[id]')?.id || group.id+'-card-'+index;
    card.classList.add('aw-card'); card.dataset.awId = id; card.dataset.awOriginal = index;
    if (!card.hasAttribute('aria-label')) card.setAttribute('aria-label',label);
    const controls = document.createElement('div'); controls.className = 'aw-controls';
    controls.innerHTML = '<button type="button" class="aw-handle">⠿</button><button type="button" data-aw-move="-1" aria-label="Move earlier">↑</button><button type="button" data-aw-move="1" aria-label="Move later">↓</button><label>Width <select data-aw-width><option value="small">Small</option><option value="medium">Medium</option><option value="wide">Wide</option><option value="full">Full</option></select></label><label>Chart height <select data-aw-height><option value="auto">Auto</option><option value="short">Short</option><option value="medium">Medium</option><option value="tall">Tall</option></select></label>';
    controls.querySelector('.aw-handle').setAttribute('aria-label','Move '+label);
    controls.querySelector('[data-aw-width]').setAttribute('aria-label',label+' width');
    controls.querySelector('[data-aw-height]').setAttribute('aria-label',label+' chart height');
    card.prepend(controls); resizeButton(card);
    const saved = state.settings.groups[group.id];
    const width = group.count === 1 ? 'full' : group.count === 3 ? 'small' : 'medium';
    card.dataset.awDefault = width;
    setDimensions(card,saved?.widths?.[id] || width,saved?.heights?.[id] || 'auto');
  }
  function enhance(state) {
    // Preserve section boundaries, tab containers, IDs, form values and existing listeners.
    // Move only cards within their original section; never flatten a form or a data grid.
    const cards = [...state.page.querySelectorAll('.card,.oz-section-card')].filter(card => !card.parentElement.closest('.card,.oz-section-card,.aw-card') && !card.classList.contains('aw-card') && !card.classList.contains('cs-custom'));
    const parents = [...new Set(cards.map(card => card.parentElement))];
    parents.forEach(parent => {
      const children = [...parent.children]; let run = [];
      function finish() {
        if (!run.length) return;
        let element, id;
        if (parent.classList.contains('aw-group')) { element = parent; id = parent.dataset.awGroup; }
        else if (run.length === children.length && parent !== state.page) {
          element = parent; id = parent.id || 'section-'+state.nextGroup++;
        } else {
          element = document.createElement('div'); id = 'section-'+state.nextGroup++;
          run[0].before(element); run.forEach(card => element.appendChild(card));
        }
        element.classList.add('aw-group'); element.dataset.awGroup = id;
        let group = state.groups.get(id);
        if (!group) { group = {id,element,count:run.length}; state.groups.set(id,group); }
        run.forEach((card,index) => addControls(card,group,state,index));
        const saved = state.settings.groups[id]?.order;
        if (Array.isArray(saved)) {
          const order = new Map(saved.map((key,index) => [key,index]));
          const nodes = [...element.children];
          nodes.sort((a,b) => (order.get(a.dataset.awId) ?? 10000)-(order.get(b.dataset.awId) ?? 10000)).forEach(card => element.appendChild(card));
        }
        updateButtons(group); run = [];
      }
      children.forEach(child => { if (cards.includes(child)) run.push(child); else finish(); }); finish();
    });
    state.page.querySelectorAll('.table-wrap,.oz-table-scroll').forEach(wrap => {
      if (!wrap.hasAttribute('tabindex')) { wrap.tabIndex = 0; wrap.setAttribute('role','region'); wrap.setAttribute('aria-label','Scrollable data table'); }
    });
    const arrange = state.toolbar.querySelector('[data-aw-action="arrange"]');
    arrange.disabled = !state.groups.size;
  }
  function init(page) {
    if (states.has(page)) return states.get(page);
    const heading = page.querySelector('.page-hdr'); if (!heading) return null;
    page.classList.add('aw-page');
    const toolbar = document.createElement('div'); toolbar.className = 'aw-toolbar';
    toolbar.innerHTML = '<div><strong>Make this workspace yours</strong><p>Reorder cards within each section. Drag a corner to resize. Changes save in this browser.</p></div><div class="aw-tools"><button type="button" data-aw-action="arrange" aria-pressed="false">Arrange page</button><select data-aw-density aria-label="Page spacing"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select><button type="button" data-aw-action="depth" aria-pressed="true">3D depth</button><button type="button" data-aw-action="reset">Reset page layout</button></div>';
    heading.after(toolbar);
    const state = {page,toolbar,settings:read(page),groups:new Map(),nextGroup:0}; states.set(page,state);
    toolbar.addEventListener('click',event => {
      const action = event.target.dataset.awAction;
      if (action === 'arrange') {
        const editing = page.classList.toggle('aw-editing'); event.target.setAttribute('aria-pressed',String(editing)); event.target.textContent = editing ? 'Done arranging' : 'Arrange page';
        if (!editing) cancelPointer(); charts.redraw();
      }
      if (action === 'depth') { state.settings.depth = !state.settings.depth; appearance(state); save(state); }
      if (action === 'reset') {
        cancelPointer(); state.settings = {groups:{},density:'comfortable',depth:true};
        state.groups.forEach(group => { [...group.element.children].sort((a,b) => Number(a.dataset.awOriginal)-Number(b.dataset.awOriginal)).forEach(card => { group.element.appendChild(card); setDimensions(card,card.dataset.awDefault,'auto'); }); updateButtons(group); });
        appearance(state); save(state); announce('Default page layout restored.');
      }
    });
    toolbar.addEventListener('change',event => { if (event.target.matches('[data-aw-density]')) { state.settings.density = event.target.value; appearance(state); save(state); } });
    enhance(state);
    appearance(state); return state;
  }
  function move(card,delta) {
    const group = card.parentElement, list = [...group.children], target = list[list.indexOf(card)+delta];
    if (!target) return;
    if (delta < 0) target.before(card); else target.after(card);
    const state = states.get(card.closest('.page')); updateButtons(state.groups.get(group.dataset.awGroup)); save(state); charts.redraw();
  }
  root.addEventListener('change',event => {
    if (!event.target.matches('[data-aw-width],[data-aw-height]')) return;
    const card = event.target.closest('.aw-card');
    setDimensions(card,card.querySelector('[data-aw-width]').value,card.querySelector('[data-aw-height]').value);
    save(states.get(card.closest('.page'))); charts.redraw();
  });
  root.addEventListener('click',event => { const button = event.target.closest('[data-aw-move]'); if (button && button.closest('.aw-editing')) move(button.closest('.aw-card'),Number(button.dataset.awMove)); });
  function resize(card,dx,dy) {
    if (card.classList.contains('dw-widget')) {
      const size = card.querySelector('.dw-size'), keys = Object.keys(widths);
      const next = keys[Math.max(0,Math.min(3,keys.indexOf(size.value)+dx))];
      if (next !== size.value) { size.value = next; size.dispatchEvent(new Event('change',{bubbles:true})); }
      const current = card.dataset.awHeight || 'auto', keysH = Object.keys(heights);
      card.dataset.awHeight = keysH[Math.max(0,Math.min(3,keysH.indexOf(current)+dy))];
      card.style.setProperty('--aw-chart-height',(heights[card.dataset.awHeight] || 260)+'px');
      try {
        const key = 'ozylix_admin_dashboard_heights_v1', saved = JSON.parse(localStorage.getItem(key) || '{}'); saved[card.dataset.widget] = card.dataset.awHeight; localStorage.setItem(key,JSON.stringify(saved));
      } catch (_) { announce('Card height changed for this session.'); }
    } else {
      const keys = Object.keys(widths), keysH = Object.keys(heights);
      setDimensions(card,keys[Math.max(0,Math.min(3,keys.indexOf(card.dataset.awWidth)+dx))],keysH[Math.max(0,Math.min(3,keysH.indexOf(card.dataset.awHeight)+dy))]);
      save(states.get(card.closest('.page')));
    }
    charts.redraw();
  }
  root.addEventListener('keydown',event => {
    const handle = event.target.closest('.aw-handle,.aw-resize'); if (!handle) return;
    if (event.key === 'Escape') { cancelPointer(); return; }
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
    event.preventDefault(); const card = handle.closest('.aw-card,.dw-widget');
    if (handle.matches('.aw-resize')) resize(card,event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0,event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0);
    else move(card,['ArrowLeft','ArrowUp'].includes(event.key) ? -1 : 1);
    handle.focus();
  });
  function cancelPointer() {
    if (!pointer) return;
    cancelAnimationFrame(autoScroll); autoScroll = 0;
    if (pointer.resize) {
      const card = pointer.card;
      if (card.classList.contains('dw-widget')) { card.style.setProperty('--dw-span',widths[card.dataset.size]); card.style.setProperty('--aw-chart-height',(heights[card.dataset.awHeight] || 260)+'px'); }
      else setDimensions(card,card.dataset.awWidth,card.dataset.awHeight);
    }
    pointer.card.classList.remove('aw-dragging','aw-resizing'); pointer.target?.classList.remove('aw-drop'); pointer.ghost?.remove();
    if (pointer.handle.hasPointerCapture(pointer.id)) pointer.handle.releasePointerCapture(pointer.id);
    pointer = null;
  }
  function scrollDrag() {
    autoScroll = 0; if (!pointer || pointer.resize) return;
    const main = root.querySelector('.main'), rect = main.getBoundingClientRect();
    const delta = pointer.y < Math.max(60,rect.top)+55 ? -14 : pointer.y > Math.min(innerHeight-60,rect.bottom)-55 ? 14 : 0;
    if (delta) { if (main.scrollHeight>main.clientHeight && /auto|scroll/.test(getComputedStyle(main).overflowY)) main.scrollBy(0,delta); else window.scrollBy(0,delta); }
    autoScroll = requestAnimationFrame(scrollDrag);
  }
  root.addEventListener('pointerdown',event => {
    const handle = event.target.closest('.aw-handle,.aw-resize');
    if (!handle || event.button !== 0 || !handle.closest('.aw-editing,.dw-editing')) return;
    const card = handle.closest('.aw-card,.dw-widget'), rect = card.getBoundingClientRect();
    pointer = {id:event.pointerId,handle,card,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,width:rect.width,height:card.querySelector('.dw-chart-wrap')?.clientHeight || 260,resize:handle.matches('.aw-resize')};
    handle.setPointerCapture(event.pointerId); handle.focus(); event.preventDefault();
  });
  root.addEventListener('pointermove',event => {
    if (!pointer || event.pointerId !== pointer.id) return;
    pointer.x = event.clientX; pointer.y = event.clientY;
    if (pointer.resize) {
      pointer.card.classList.add('aw-resizing');
      const grid = pointer.card.parentElement, gap = parseFloat(getComputedStyle(grid).gap) || 18, column = (grid.clientWidth-gap*11)/12;
      pointer.widthKey = Object.keys(widths).reduce((best,key) => Math.abs(widths[key]*column+(widths[key]-1)*gap-(pointer.width+event.clientX-pointer.startX)) < Math.abs(widths[best]*column+(widths[best]-1)*gap-(pointer.width+event.clientX-pointer.startX)) ? key : best,'full');
      const nextHeight = Math.max(200,Math.min(380,pointer.height+event.clientY-pointer.startY));
      pointer.heightKey = ['short','medium','tall'].reduce((best,key) => Math.abs(heights[key]-nextHeight)<Math.abs(heights[best]-nextHeight) ? key : best,'medium');
      pointer.card.style.setProperty(pointer.card.classList.contains('dw-widget') ? '--dw-span' : '--aw-span',widths[pointer.widthKey]);
      pointer.card.style.setProperty('--aw-chart-height',heights[pointer.heightKey]+'px'); charts.redraw(); return;
    }
    if (!pointer.ghost && Math.hypot(event.clientX-pointer.startX,event.clientY-pointer.startY)<6) return;
    if (!pointer.ghost) { pointer.ghost = document.createElement('div'); pointer.ghost.className = 'dw-drag-label'; pointer.ghost.textContent = pointer.card.getAttribute('aria-label'); document.body.appendChild(pointer.ghost); pointer.card.classList.add('aw-dragging'); autoScroll = requestAnimationFrame(scrollDrag); }
    pointer.ghost.style.left = Math.max(8,Math.min(innerWidth-240,event.clientX+14))+'px'; pointer.ghost.style.top = Math.max(8,Math.min(innerHeight-50,event.clientY+12))+'px';
    pointer.target?.classList.remove('aw-drop'); pointer.target = null;
    const target = document.elementFromPoint(event.clientX,event.clientY)?.closest('.aw-card');
    if (target && target !== pointer.card && target.parentElement === pointer.card.parentElement) {
      pointer.target = target; target.classList.add('aw-drop'); const rect = target.getBoundingClientRect();
      pointer.after = event.clientY>rect.top+rect.height*.6 || (event.clientY>rect.top+rect.height*.3 && event.clientX>rect.left+rect.width*.6);
    }
  });
  root.addEventListener('pointerup',event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const {card,handle,target,after,resize:resizing,widthKey,heightKey} = pointer;
    if (resizing && widthKey) {
      if (card.classList.contains('dw-widget')) {
        const size = card.querySelector('.dw-size'); size.value = widthKey; size.dispatchEvent(new Event('change',{bubbles:true}));
        card.dataset.awHeight = heightKey; resize(card,0,0);
      } else { setDimensions(card,widthKey,heightKey); save(states.get(card.closest('.page'))); }
    } else if (target) { if (after) target.after(card); else target.before(card); const state = states.get(card.closest('.page')); updateButtons(state.groups.get(card.parentElement.dataset.awGroup)); save(state); }
    cancelPointer(); handle.focus(); charts.redraw();
  });
  root.addEventListener('pointercancel',() => {
    if (pointer?.resize) { const card = pointer.card; if (card.classList.contains('dw-widget')) { card.style.setProperty('--dw-span',widths[card.dataset.size]); card.style.setProperty('--aw-chart-height',(heights[card.dataset.awHeight] || 260)+'px'); } else setDimensions(card,card.dataset.awWidth,card.dataset.awHeight); }
    cancelPointer(); charts.redraw();
  });
  document.addEventListener('keydown',event => { if (event.key === 'Escape') cancelPointer(); });
  window.addEventListener('blur',cancelPointer);
  document.addEventListener('visibilitychange',() => { if (document.hidden) cancelPointer(); });
  const colors = ['#526b48','#558ca0','#c69532','#ca7469','#8573ad'];
  const number = value => Math.max(0,Number(value)||0);
  const paid = order => /\bpaid\b|success/i.test(order.payment_status || '') && !/unpaid|not.?paid/i.test(order.payment_status || '');
  function addInsights(page,name) {
    if (page.querySelector('.aw-insights')) return;
    const row = document.createElement('div'); row.className = 'aw-insights';
    const titles = name === 'orders' ? ['Fulfilment flow · filtered orders','Payment state · filtered orders'] : ['Inventory health · filtered products','Lowest stock · filtered products'];
    titles.forEach((title,index) => {
      const card = document.createElement('section'); card.className = 'card';
      const header = document.createElement('div'); header.className = 'card-hdr';
      const label = document.createElement('span'); label.className = 'card-title'; label.textContent = title;
      header.appendChild(label); const canvas = document.createElement('canvas'); canvas.id = 'aw-'+name+'-'+index;
      const note = document.createElement('p'); note.className = 'aw-data-note'; note.textContent = 'Uses the loaded records matching the filters below.';
      card.append(header,canvas,note); row.appendChild(card);
    });
    page.querySelector('.filter-bar')?.before(row);
  }
  function orderInsights() {
    const rows = typeof ordersFilteredList !== 'undefined' ? ordersFilteredList : [];
    const counts = new Map(); rows.forEach(order => { const key = String(order.status || order.fulfillment || 'Pending'); counts.set(key,(counts.get(key)||0)+1); });
    charts.register('aw-orders-0','hbar',[...counts.keys()],[{name:'Orders',unit:'count',values:[...counts.values()],color:colors[0]}]);
    const values = [0,0,0,0]; rows.forEach(order => { const value = String(order.payment_status || ''); values[paid(order) ? 0 : /cod/i.test(value) ? 1 : /fail/i.test(value) ? 2 : 3]++; });
    charts.register('aw-orders-1','donut',['Paid','COD pending','Failed','Other / pending'],[{name:'Orders',unit:'count',values}],{colors:[colors[0],colors[2],colors[3],colors[1]]});
  }
  function inventoryInsights() {
    let rows = typeof allProducts !== 'undefined' ? allProducts.filter(p => !p.deleted_at) : [];
    const query = (document.getElementById('invSearch')?.value || '').toLowerCase(); if (query) rows = rows.filter(p => String(p.name).toLowerCase().includes(query));
    const filter = typeof currentInvFilter !== 'undefined' ? currentInvFilter : 'all';
    if (filter === 'critical') rows = rows.filter(p => p.stock === 0);
    if (filter === 'low') rows = rows.filter(p => p.stock>0 && p.stock<20);
    if (filter === 'ok') rows = rows.filter(p => p.stock>=20);
    const values = [0,0,0]; rows.forEach(p => { values[number(p.stock) === 0 ? 2 : number(p.stock)<20 ? 1 : 0]++; });
    charts.register('aw-inventory-0','donut',['Stocked · 20+','Low · 1–19','Out of stock'],[{name:'Products',unit:'count',values}],{colors:[colors[0],colors[2],colors[3]],center:'products'});
    const low = [...rows].sort((a,b) => number(a.stock)-number(b.stock)).slice(0,6);
    charts.register('aw-inventory-1','hbar',low.map(p => p.name),[{name:'Units',unit:'count',values:low.map(p => number(p.stock)),color:colors[1]}]);
  }
  function after(name,callback) {
    const original = window[name]; if (typeof original !== 'function') return;
    window[name] = function (...args) { const result = original.apply(this,args); callback(...args); return result; };
  }
  after('filterOrders',orderInsights); after('filterInventory',inventoryInsights);
  function datedValues(rows,value) {
    const times = rows.map(order => new Date(order.created_at).getTime()).filter(Number.isFinite);
    const span = times.length ? Math.max(...times)-Math.min(...times) : 0;
    const yearly = span>3650*86400000, monthly = span>90*86400000, buckets = new Map();
    rows.forEach(order => {
      const date = new Date(order.created_at); if (!Number.isFinite(date.getTime())) return;
      const key = yearly ? String(date.getFullYear()) : monthly ? date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0') : date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
      buckets.set(key,(buckets.get(key)||0)+value(order));
    });
    const entries = [...buckets].sort((a,b) => a[0].localeCompare(b[0]));
    return {labels:entries.map(([key]) => key),values:entries.map(([,amount]) => amount),period:yearly ? 'year' : monthly ? 'month' : 'day'};
  }
  // The analytics page shares the same exact-value renderer and keyboard inspection.
  window.renderAnalyticsDoughnuts = function (input) {
    const page = document.getElementById('page-analytics'); init(page);
    const rows = document.getElementById('analyticsFilter').value === '365' && typeof allOrders !== 'undefined' ? allOrders : input || [];
    const methods = new Map(), statuses = new Map(), categories = new Map(), products = new Map();
    rows.forEach(order => {
      const method = order.payment_method || order.payment_mode || (/cod/i.test(order.payment_status || '') ? 'COD' : 'Unspecified');
      methods.set(method,(methods.get(method)||0)+1);
      const state = order.status || order.fulfillment || 'Pending'; statuses.set(state,(statuses.get(state)||0)+1);
      if (!paid(order)) return;
      try { const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        if (Array.isArray(items)) items.forEach(item => {
          const quantity = number(item.qty ?? item.units ?? 1), category = item.category || 'Other', name = item.name || 'Unnamed product';
          categories.set(category,(categories.get(category)||0)+number(item.price)*quantity); products.set(name,(products.get(name)||0)+quantity);
        });
      } catch (_) { /* Invalid historical items do not break the page. */ }
    });
    const kpis = page.querySelectorAll('#analyticsKpis .kpi'), collected = rows.filter(paid).reduce((sum,order) => sum+number(order.total),0), count = rows.filter(paid).length;
    const currency = value => '₹'+new Intl.NumberFormat('en-IN',{maximumFractionDigits:0}).format(value);
    [['Paid revenue',currency(collected)],['Orders',String(rows.length)],['Average paid order',currency(count ? collected/count : 0)],['Paid order share',(rows.length ? count/rows.length*100 : 0).toFixed(1)+'%']].forEach(([label,value],index) => { if (kpis[index]) { kpis[index].querySelector('.kpi-label').textContent = label; kpis[index].querySelector('.kpi-val').textContent = value; } });
    function canvasIn(hostId,id,title) {
      const host = document.getElementById(hostId); if (!host) return;
      host.replaceChildren(); host.removeAttribute('style');
      const canvas = document.createElement('canvas'); canvas.id = id; host.appendChild(canvas);
      host.closest('.card').querySelector('.card-title').textContent = title;
    }
    canvasIn('categoryRevChart','aw-category-sales','Paid item sales by category');
    canvasIn('topProductsChart','aw-product-units','Top products · paid units');
    const volume = datedValues(rows,() => 1);
    canvasIn('orderVolumeChart','aw-volume','Order volume by '+volume.period+' · active periods');
    const cat = [...categories].sort((a,b) => b[1]-a[1]).slice(0,6), product = [...products].sort((a,b) => b[1]-a[1]).slice(0,6);
    charts.register('aw-category-sales','hbar',cat.map(row => row[0]),[{name:'Paid item value',unit:'money',values:cat.map(row => row[1])}]);
    charts.register('aw-product-units','hbar',product.map(row => row[0]),[{name:'Units',unit:'count',values:product.map(row => row[1])}]);
    charts.register('aw-volume','bar',volume.labels,[{name:'Orders',unit:'count',values:volume.values,color:colors[1]}]);
    ['paymentMethodChart','orderStatusChart'].forEach(id => { const host = document.getElementById(id)?.parentElement; if (host && !host.classList.contains('dw-chart-wrap')) { host.style.maxWidth = 'none'; host.style.margin = '0'; } });
    charts.register('paymentMethodChart','donut',[...methods.keys()],[{name:'Orders',unit:'count',values:[...methods.values()]}],{colors});
    charts.register('orderStatusChart','donut',[...statuses.keys()],[{name:'Orders',unit:'count',values:[...statuses.values()]}],{colors});
  };
  window.renderPaymentTrendChart = function (rows) {
    const values = datedValues(rows,order => paid(order) ? number(order.total) : 0);
    charts.register('payTrendCanvas','area',values.labels,[{name:'Paid value',unit:'money',values:values.values,color:colors[0]}]);
    const label = document.getElementById('payTrendCanvas')?.closest('.card')?.querySelector('.card-title');
    if (label) label.textContent = 'Paid value by '+values.period+' · active periods';
  };
  window.renderPaymentMethodChart = function (rows) {
    const counts = new Map(); rows.forEach(order => { const method = order.payment_method || order.payment_mode || (/cod/i.test(order.payment_status || '') ? 'COD' : 'Unspecified'); counts.set(method,(counts.get(method)||0)+1); });
    charts.register('payMethodSplitCanvas','donut',[...counts.keys()],[{name:'Orders',unit:'count',values:[...counts.values()]}],{colors});
  };
  after('filterPayments',() => {
    const rows = typeof paymentsFilteredList !== 'undefined' ? paymentsFilteredList : [], cards = document.querySelectorAll('#payKpis .kpi'), collected = rows.filter(paid);
    if (cards[0]) {
      cards[0].querySelector('.kpi-label').textContent = 'Paid value (range)';
      cards[0].querySelector('.kpi-val').textContent = '₹'+new Intl.NumberFormat('en-IN',{maximumFractionDigits:0}).format(collected.reduce((sum,order) => sum+number(order.total),0));
      cards[0].querySelector('.kpi-change').textContent = collected.length+' paid orders';
    }
    if (cards[1]) {
      cards[1].querySelector('.kpi-label').textContent = 'COD awaiting payment';
      cards[1].querySelector('.kpi-val').textContent = rows.filter(order => !paid(order) && /cod/i.test(order.payment_status || '')).length;
    }
  });
  // Upgrade existing custom canvases without changing what their data functions calculate.
  [['drawAreaChart','area'],['drawBarChart','bar'],['drawDonutChart','donut'],['drawHBarChart','hbar'],['drawHourlyChart','bar']].forEach(([name,kind]) => {
    const original = window[name]; if (typeof original !== 'function') return;
    window[name] = function (id,labels,values,color,extra) {
      const canvas = document.getElementById(id), owner = canvas?.closest('.page');
      if (!owner || owner.id === 'page-dashboard' || !canvas.closest('.card,.oz-section-card')) return original.apply(this,arguments);
      if (!states.has(owner)) init(owner);
      if (name === 'drawHourlyChart') { values = labels; labels = values.map((_,i) => String(i).padStart(2,'0')+':00'); }
      const unit = /payTrend|geoRev|perfTrend/i.test(id) ? 'money' : 'count';
      const series = [{name:unit === 'money' ? 'Recorded value' : 'Count',unit,values:values || [],color:typeof color === 'string' && /^#[a-f0-9]{6}$/i.test(color) ? color : colors[0]}];
      if (kind === 'bar' && Array.isArray(extra)) series.push({name:'Secondary · right axis',unit:'count',values:extra,color:colors[2]});
      charts.register(id,kind,labels || [],series,kind === 'donut' ? {colors:Array.isArray(color) ? color : colors} : {});
    };
  });
  function dashboardCorners() {
    const page = document.getElementById('page-dashboard');
    let saved = {}; try { saved = JSON.parse(localStorage.getItem('ozylix_admin_dashboard_heights_v1') || '{}') || {}; } catch (_) {}
    page.querySelectorAll('.dw-widget').forEach(card => {
      if (card.querySelector('.aw-resize')) return;
      card.dataset.awHeight = Object.hasOwn(heights,saved[card.dataset.widget]) ? saved[card.dataset.widget] : 'auto';
      if (card.dataset.awHeight !== 'auto') card.style.setProperty('--aw-chart-height',heights[card.dataset.awHeight]+'px');
      resizeButton(card);
    });
    page.querySelector('#dwReset')?.addEventListener('click',() => {
      page.querySelectorAll('.dw-widget').forEach(card => { card.dataset.awHeight = 'auto'; card.style.removeProperty('--aw-chart-height'); });
      try { localStorage.removeItem('ozylix_admin_dashboard_heights_v1'); } catch (_) {} charts.redraw();
    });
  }
  function sync() {
    pending = 0; const page = root.querySelector('.page.active'); if (!page) return;
    if (pointer && pointer.card.closest('.page') !== page) cancelPointer();
    if (page.id === 'page-dashboard') return;
    const name = page.id.replace('page-',''); if (['orders','inventory'].includes(name)) addInsights(page,name);
    const state = init(page); if (state) enhance(state);
    if (name === 'orders') orderInsights();
    if (name === 'inventory') inventoryInsights();
    charts.redraw();
  }
  function schedule() { if (!pending) pending = requestAnimationFrame(sync); }
  new MutationObserver(records => {
    if (records.some(record => record.type === 'attributes' && record.target.matches('.page') || record.type === 'childList' && [...record.addedNodes].some(node => node.nodeType === 1 && (node.matches('.card,.oz-section-card') || node.querySelector('.card,.oz-section-card'))))) schedule();
  }).observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',charts.redraw,{passive:true});
  dashboardCorners(); schedule();
})();
