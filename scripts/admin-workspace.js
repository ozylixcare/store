/* Movable dashboard widgets and interactive canvas charts. No network writes. */
(function () {
  'use strict';
  const page = document.getElementById('page-dashboard');
  if (!page) return;
  const storageKey = 'ozylix_admin_dashboard_workspace_v1';
  const sizes = {small:4, medium:6, wide:8, full:12};
  const palette = ['#526b48','#558ca0','#c69532','#8573ad','#ca7469','#70a49b'];
  const models = new Map();
  const widgets = new Map();
  const defaults = [];
  let settings = {order:[], sizes:{}, density:'comfortable', depth:true};
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && typeof saved === 'object') {
      settings.order = Array.isArray(saved.order) ? saved.order.filter(id => typeof id === 'string') : [];
      settings.sizes = saved.sizes && typeof saved.sizes === 'object' ? saved.sizes : {};
      settings.density = saved.density === 'compact' ? 'compact' : 'comfortable';
      settings.depth = saved.depth !== false;
    }
  } catch (_) { /* Optional browser storage. */ }
  let editing = false, drag = null, redrawFrame = 0;
  const toolbar = document.createElement('div');
  toolbar.className = 'dw-toolbar';
  toolbar.innerHTML = '<div class="dw-toolbar-copy"><strong>Your workspace, your way</strong><p id="dwHelp">Explore charts with your cursor or touch. Arrange widgets to make this space yours.</p></div><div class="dw-toolbar-actions"><button type="button" class="dw-button" id="dwArrange" aria-pressed="false">Arrange widgets</button><select class="dw-density" id="dwDensity" aria-label="Dashboard spacing"><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select><button type="button" class="dw-button" id="dwDepth" aria-pressed="true">3D depth</button><button type="button" class="dw-button" id="dwReset">Reset layout</button></div>';
  page.querySelector('.page-hdr').insertAdjacentElement('afterend',toolbar);
  const status = document.createElement('div');
  status.className = 'dw-status'; status.setAttribute('role','status');
  page.appendChild(status);
  const announce = text => { status.textContent = text; };
  const grid = document.createElement('div');
  grid.className = 'dw-grid'; grid.setAttribute('aria-label','Dashboard widgets');
  const firstRow = document.getElementById('revenueCanvas')?.closest('.card')?.parentElement;
  const recent = document.getElementById('dashOrdersTbody')?.closest('.card');
  if (!firstRow || !recent) return;
  // Preserve original data nodes and handlers; replace only fixed row wrappers.
  const rows = [];
  for (let row = firstRow; row; row = row.nextElementSibling) {
    rows.push(row); if (row === recent) break;
  }
  firstRow.before(grid);
  const definitions = [
    ['revenue','revenueCanvas','wide','Paid revenue trend'],
    ['today-revenue','sparkRevVal','small'], ['today-orders','sparkOrdVal','small'],
    ['paid-share','sparkConvVal','small'], ['status','statusCanvas','small','Order status'],
    ['payment','payCanvas','small','Payment split'], ['hourly','hourlyCanvas','small','Orders by hour'],
    ['map','indiaMap','medium'], ['cities','topCitiesChart','medium'],
    ['category','catCanvas','medium','Paid sales by category'], ['products','topProductsWidget','medium'],
    ['flow','orderFunnelWidget','medium','Fulfilment pipeline'],
    ['growth','dashCustGrowthCanvas','medium','First-time buyers'],
    ['activity','activityFeed','small'], ['low-stock','lowStockList','small'], ['goal','goalWidget','small'],
    ['area','areaCanvas','medium','Order value · trailing 30 days'], ['heatmap','heatmapWidget','medium'],
    ['delivery-rate','ring1Canvas','small'], ['paid-rate','ring2Canvas','small'], ['stock-rate','ring3Canvas','small'],
    ['forecast','forecastCanvas','small','7-day projection · estimate'],
    ['recent-orders','dashOrdersTbody','full']
  ];
  function addWidget(id, card, size, title) {
    if (!card) return;
    card.classList.add('dw-widget'); card.dataset.widget = id;
    if (title && card.querySelector('.card-title')) card.querySelector('.card-title').textContent = title;
    const label = title || card.querySelector('.card-title')?.textContent.trim() || {
      'today-revenue':'Today’s revenue','today-orders':'Today’s orders','paid-share':'Paid order share',
      'delivery-rate':'Delivery rate','paid-rate':'Paid orders','stock-rate':'Stock health'
    }[id] || id;
    card.setAttribute('aria-label',label);
    const controls = document.createElement('div'); controls.className = 'dw-controls';
    controls.innerHTML = '<button type="button" class="dw-handle" aria-label="Move widget" title="Drag to move. Use arrow keys to reorder.">⠿</button><button type="button" class="dw-step" data-move="-1" aria-label="Move earlier">↑</button><button type="button" class="dw-step" data-move="1" aria-label="Move later">↓</button><label>Size <select class="dw-size" aria-label="Widget width"><option value="small">Small</option><option value="medium">Medium</option><option value="wide">Wide</option><option value="full">Full</option></select></label>';
    controls.querySelector('.dw-handle').setAttribute('aria-label','Move '+label);
    controls.querySelector('.dw-size').setAttribute('aria-label',label+' width');
    card.prepend(controls); grid.appendChild(card);
    widgets.set(id,{card,size,label}); defaults.push(id);
    setSize(id, Object.hasOwn(sizes,settings.sizes[id]) ? settings.sizes[id] : size);
  }
  definitions.forEach(([id,node,size,title]) => addWidget(id, document.getElementById(node)?.closest('.card'),size,title));
  rows.forEach(row => { if (row.parentElement === page) row.remove(); });
  const pulseRow = document.getElementById('unifiedPulseRow');
  if (pulseRow) {
    const pulseCard = document.createElement('section'); pulseCard.className = 'card'; pulseCard.appendChild(pulseRow);
    addWidget('platform',pulseCard,'full','Platform signals');
    defaults.splice(defaults.indexOf('activity'),0,...defaults.splice(defaults.indexOf('platform'),1));
    const updatePulse = () => { pulseCard.hidden = !pulseRow.children.length; };
    new MutationObserver(updatePulse).observe(pulseRow,{childList:true}); updatePulse();
  }
  function addChartCard(id, title, size) {
    const card = document.createElement('section'); card.className = 'card';
    const header = document.createElement('div'); header.className = 'card-hdr';
    const label = document.createElement('span'); label.className = 'card-title'; label.textContent = title;
    header.appendChild(label); card.appendChild(header);
    const canvas = document.createElement('canvas'); canvas.id = 'dw-'+id; card.appendChild(canvas);
    addWidget(id,card,size,title);
  }
  addChartCard('order-size','Order value distribution','medium');
  addChartCard('stock-mix','Inventory health · current stock','medium');
  // Place new insights before operations by default, rather than below the table.
  defaults.splice(defaults.indexOf('flow'),0,...defaults.splice(-2));
  function setSize(id, size) {
    const widget = widgets.get(id); if (!widget) return;
    widget.card.style.setProperty('--dw-span',sizes[size]); widget.card.dataset.size = size;
    widget.card.querySelector('.dw-size').value = size;
  }
  function applyOrder(order) {
    const used = new Set();
    [...order,...defaults].forEach(id => {
      if (widgets.has(id) && !used.has(id)) { grid.appendChild(widgets.get(id).card); used.add(id); }
    });
    updateMoveButtons();
  }
  function updateMoveButtons() {
    [...grid.children].forEach((card,index) => {
      card.querySelector('[data-move="-1"]').disabled = index === 0;
      card.querySelector('[data-move="1"]').disabled = index === grid.children.length - 1;
    });
  }
  function save() {
    settings.order = [...grid.children].map(card => card.dataset.widget);
    settings.sizes = Object.fromEntries([...widgets].map(([id,{card}]) => [id,card.dataset.size]));
    try { localStorage.setItem(storageKey,JSON.stringify(settings)); }
    catch (_) { announce('Layout changed. Browser storage is unavailable; this layout will last for this session.'); return; }
    announce('Dashboard layout saved in this browser.');
  }
  function applyAppearance() {
    page.classList.toggle('dw-compact',settings.density === 'compact');
    document.getElementById('dwDensity').value = settings.density;
    document.getElementById('dwDepth').setAttribute('aria-pressed',String(settings.depth));
    scheduleDraw();
  }
  function move(card, delta) {
    const list = [...grid.children], index = list.indexOf(card), target = list[index + delta];
    if (!target) return;
    if (delta < 0) grid.insertBefore(card,target); else target.after(card);
    updateMoveButtons(); save(); scheduleDraw();
    announce(card.getAttribute('aria-label')+' moved to position '+([...grid.children].indexOf(card)+1)+'.');
  }
  toolbar.addEventListener('click',event => {
    if (event.target.id === 'dwArrange') {
      editing = !editing; page.classList.toggle('dw-editing',editing);
      event.target.setAttribute('aria-pressed',String(editing)); event.target.textContent = editing ? 'Done arranging' : 'Arrange widgets';
      document.getElementById('dwHelp').textContent = editing ? 'Drag the grip to move a card. Use arrows on touch or keyboard. Choose a width for each card.' : 'Explore charts with your cursor or touch. Your layout is saved in this browser.';
      scheduleDraw();
    }
    if (event.target.id === 'dwDepth') { settings.depth = !settings.depth; applyAppearance(); save(); }
    if (event.target.id === 'dwReset') {
      cancelDrag(); settings = {order:[],sizes:{},density:'comfortable',depth:true};
      widgets.forEach(({size},id) => setSize(id,size)); applyOrder(defaults); applyAppearance(); save();
      announce('Default dashboard layout restored.');
    }
  });
  toolbar.addEventListener('change',event => {
    if (event.target.id === 'dwDensity') { settings.density = event.target.value; applyAppearance(); save(); }
  });
  grid.addEventListener('change',event => {
    if (event.target.matches('.dw-size')) { setSize(event.target.closest('.dw-widget').dataset.widget,event.target.value); save(); scheduleDraw(); }
  });
  grid.addEventListener('click',event => {
    const button = event.target.closest('[data-move]');
    if (editing && button) move(button.closest('.dw-widget'),Number(button.dataset.move));
  });
  grid.addEventListener('keydown',event => {
    if (!editing || !event.target.matches('.dw-handle')) return;
    const deltas = {ArrowUp:-1,ArrowLeft:-1,ArrowDown:1,ArrowRight:1};
    if (deltas[event.key]) { event.preventDefault(); move(event.target.closest('.dw-widget'),deltas[event.key]); event.target.focus(); }
    if (event.key === 'Escape') cancelDrag();
  });
  function clearDrop() { grid.querySelectorAll('.dw-drop-before,.dw-drop-after').forEach(card => card.classList.remove('dw-drop-before','dw-drop-after')); }
  function cancelDrag() {
    if (!drag) return;
    drag.card.classList.remove('dw-dragging'); drag.ghost?.remove(); clearDrop();
    if (drag.handle.hasPointerCapture(drag.pointer)) drag.handle.releasePointerCapture(drag.pointer);
    drag = null;
  }
  grid.addEventListener('pointerdown',event => {
    const handle = event.target.closest('.dw-handle');
    if (!editing || !handle || event.button !== 0) return;
    const card = handle.closest('.dw-widget');
    drag = {card,handle,pointer:event.pointerId,x:event.clientX,y:event.clientY,target:null,after:false};
    handle.setPointerCapture(event.pointerId); event.preventDefault(); handle.focus();
  });
  grid.addEventListener('pointermove',event => {
    if (!drag || event.pointerId !== drag.pointer) return;
    if (!drag.ghost && Math.hypot(event.clientX-drag.x,event.clientY-drag.y) < 6) return;
    if (!drag.ghost) {
      drag.card.classList.add('dw-dragging'); drag.ghost = document.createElement('div');
      drag.ghost.className = 'dw-drag-label'; drag.ghost.textContent = drag.card.getAttribute('aria-label'); document.body.appendChild(drag.ghost);
    }
    drag.ghost.style.left = Math.max(6,Math.min(event.clientX+14,innerWidth-245))+'px';
    drag.ghost.style.top = Math.max(6,Math.min(event.clientY+12,innerHeight-50))+'px';
    const target = document.elementFromPoint(event.clientX,event.clientY)?.closest('.dw-widget');
    clearDrop(); drag.target = null;
    if (target && grid.contains(target) && target !== drag.card) {
      const rect = target.getBoundingClientRect();
      drag.after = event.clientY > rect.top+rect.height*.55 || (event.clientY > rect.top+rect.height*.3 && event.clientX > rect.left+rect.width*.65);
      drag.target = target; target.classList.add(drag.after ? 'dw-drop-after' : 'dw-drop-before');
    }
    const main = page.closest('.main');
    const bounds = main.getBoundingClientRect(), top = Math.max(70,bounds.top), bottom = Math.min(innerHeight-65,bounds.bottom);
    const step = event.clientY < top+70 ? -18 : event.clientY > bottom-70 ? 18 : 0;
    if (step) {
      if (main.scrollHeight > main.clientHeight+2 && /auto|scroll/.test(getComputedStyle(main).overflowY)) main.scrollBy(0,step);
      else window.scrollBy(0,step);
    }
  });
  grid.addEventListener('pointerup',event => {
    if (!drag || drag.pointer !== event.pointerId) return;
    const {card,target,after,handle} = drag;
    if (target) { if (after) target.after(card); else grid.insertBefore(card,target); }
    cancelDrag(); updateMoveButtons(); if (target) save(); handle.focus(); scheduleDraw();
  });
  grid.addEventListener('pointercancel',cancelDrag);
  document.addEventListener('keydown',event => { if (event.key === 'Escape') cancelDrag(); });
  window.addEventListener('blur',cancelDrag);
  // Canvas rendering keeps exact values and axes, adding only shallow visual depth.
  const finite = value => Math.max(0,Number.isFinite(Number(value)) ? Number(value) : 0);
  const money = value => '₹'+new Intl.NumberFormat('en-IN',{maximumFractionDigits:0}).format(value);
  const format = (value,unit) => unit === 'money' ? money(value) : new Intl.NumberFormat('en-IN',{maximumFractionDigits:1}).format(value);
  const short = value => value >= 100000 ? (value/100000).toFixed(1)+'L' : value >= 1000 ? (value/1000).toFixed(1)+'k' : Math.round(value).toString();
  function theme(owner = page) {
    const style = getComputedStyle(owner);
    return {ink:style.getPropertyValue('--dw-ink').trim(),muted:style.getPropertyValue('--dw-muted').trim(),line:style.getPropertyValue('--dw-line').trim(),surface:style.getPropertyValue('--dw-surface').trim()};
  }
  function register(id, kind, labels, series, options = {}) {
    const canvas = document.getElementById(id); if (!canvas || !canvas.closest('#app .page')) return;
    let model = models.get(id);
    if (model && model.canvas !== canvas) {
      resizeObserver?.unobserve(model.wrap); models.delete(id); model = null;
    }
    if (!model) {
      const wrap = document.createElement('div'); wrap.className = 'dw-chart-wrap'+(kind === 'spark' ? ' dw-spark' : '');
      canvas.before(wrap); wrap.appendChild(canvas); canvas.removeAttribute('style');
      const tip = document.createElement('div'); tip.className = 'dw-chart-tip'; tip.hidden = true; wrap.appendChild(tip);
      model = {canvas,wrap,tip,owner:canvas.closest('.page'),hidden:new Set(),hits:[],selected:-1,kind}; models.set(id,model);
      canvas.tabIndex = 0;
      canvas.addEventListener('pointermove',event => inspect(model,event));
      canvas.addEventListener('click',event => inspect(model,event));
      canvas.addEventListener('pointerleave',() => { model.selected = -1; model.tip.hidden = true; draw(model); });
      canvas.addEventListener('blur',() => { model.selected = -1; model.tip.hidden = true; draw(model); });
      canvas.addEventListener('keydown',event => {
        if (event.key === 'Escape') { model.selected = -1; model.tip.hidden = true; draw(model); return; }
        if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key) || !model.hits.length) return;
        event.preventDefault();
        const delta = ['ArrowLeft','ArrowUp'].includes(event.key) ? -1 : 1;
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? model.hits.length-1 : (model.selected+delta+model.hits.length)%model.hits.length;
        selectHit(model,index); announce(model.tip.textContent); draw(model);
      });
      if (kind !== 'spark') {
        const legend = document.createElement('div'); legend.className = 'dw-legend'; wrap.after(legend); model.legend = legend;
        const details = document.createElement('details'); details.className = 'dw-chart-data';
        details.innerHTML = '<summary>View chart data</summary><div></div>'; legend.after(details); model.details = details;
      }
      resizeObserver?.observe(wrap);
    }
    Object.assign(model,{kind,labels:labels.map(String),series:series.map((s,i) => ({...s,color:s.color || palette[i%palette.length],values:s.values.map(value => kind === 'forecast' && value == null ? null : finite(value))})),options,selected:-1});
    model.tip.hidden = true;
    model.hidden = new Set([...model.hidden].filter(i => i < (kind === 'donut' ? labels.length : series.length)));
    canvas.setAttribute('role','img');
    canvas.setAttribute('aria-label',(canvas.closest('.dw-widget,.aw-card,.card')?.getAttribute('aria-label') || canvas.closest('.card')?.querySelector('.card-title')?.textContent || 'Chart')+'. Use arrow keys to inspect values, or open View chart data.');
    renderLegend(model); renderTable(model); draw(model);
  }
  function renderLegend(model) {
    if (!model.legend) return;
    model.legend.replaceChildren();
    const entries = model.kind === 'donut' ? model.labels.map((label,i) => ({label,color:model.options.colors?.[i] || palette[i%palette.length]})) : model.series.map(s => ({label:s.name,color:s.color}));
    entries.forEach((entry,index) => {
      const button = document.createElement('button'); button.type = 'button'; button.setAttribute('aria-pressed',String(!model.hidden.has(index)));
      const dot = document.createElement('i'); dot.style.setProperty('--legend-color',entry.color); dot.setAttribute('aria-hidden','true');
      button.append(dot,document.createTextNode(entry.label));
      button.addEventListener('click',() => {
        if (model.hidden.has(index)) model.hidden.delete(index); else model.hidden.add(index);
        model.selected = -1; model.tip.hidden = true; button.setAttribute('aria-pressed',String(!model.hidden.has(index))); draw(model);
      }); model.legend.appendChild(button);
    });
  }
  function renderTable(model) {
    if (!model.details) return;
    const table = document.createElement('table'), head = document.createElement('thead'), header = document.createElement('tr');
    ['Period / category',...model.series.map(s => s.name)].forEach(name => { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = name; header.appendChild(cell); });
    head.appendChild(header); table.appendChild(head);
    const body = document.createElement('tbody');
    model.labels.forEach((label,index) => {
      const row = document.createElement('tr'), cell = document.createElement('th'); cell.scope = 'row'; cell.textContent = label; row.appendChild(cell);
      model.series.forEach(series => { const td = document.createElement('td'); td.textContent = series.values[index] == null ? '—' : format(series.values[index],series.unit); row.appendChild(td); }); body.appendChild(row);
    });
    if (!model.labels.length) { const row = document.createElement('tr'), cell = document.createElement('td'); cell.colSpan = model.series.length+1; cell.textContent = 'No data in this range'; row.appendChild(cell); body.appendChild(row); }
    table.appendChild(body); model.details.querySelector('div').replaceChildren(table);
  }
  function scheduleDraw() {
    if (!redrawFrame) redrawFrame = requestAnimationFrame(() => {
      redrawFrame = 0;
      if (!document.hidden) { models.forEach(draw); if (page.classList.contains('active')) nativeRenders.forEach(render => render()); }
    });
  }
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(scheduleDraw) : null;
  function setupCanvas(model) {
    const width = model.canvas.clientWidth, height = model.canvas.clientHeight;
    if (width < 10 || height < 10 || !model.owner.classList.contains('active')) return null;
    const ratio = Math.min(devicePixelRatio || 1,2), ctx = model.canvas.getContext('2d');
    model.canvas.width = Math.round(width*ratio); model.canvas.height = Math.round(height*ratio); ctx.setTransform(ratio,0,0,ratio,0,0);
    return {ctx,width,height};
  }
  function draw(model) {
    const setup = setupCanvas(model); if (!setup) return;
    const {ctx,width:w,height:h} = setup, colors = theme(model.owner); model.hits = [];
    ctx.clearRect(0,0,w,h); ctx.font = '11px sans-serif';
    const values = model.series[0]?.values || [], total = values.reduce((a,b) => a+b,0);
    if (!model.labels.length || !model.series.length || (model.kind === 'donut' && !total)) {
      ctx.fillStyle = colors.muted; ctx.textAlign = 'center'; ctx.fillText('No data in this range',w/2,h/2); return;
    }
    if (model.kind === 'donut') { drawDonut(model,ctx,w,h,colors); return; }
    if (model.kind === 'hbar') { drawHorizontal(model,ctx,w,h,colors); return; }
    const spark = model.kind === 'spark';
    const sharedScale = model.options.sharedScale;
    const pad = {left:spark ? 3 : 48,right:spark ? 3 : model.series.length > 1 && !sharedScale ? 40 : 14,top:18,bottom:spark ? 5 : 34};
    const plotW = Math.max(1,w-pad.left-pad.right), plotH = Math.max(1,h-pad.top-pad.bottom), n = model.labels.length;
    const sharedMax = Math.max(1,...model.series.flatMap(series => series.values))*1.12;
    if (!spark) {
      const max = sharedScale ? sharedMax : Math.max(1,values.reduce((a,b) => Math.max(a,b),0))*1.12;
      for (let i=0;i<=4;i++) {
        const y = pad.top+plotH-i*plotH/4; ctx.strokeStyle = colors.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(w-pad.right,y); ctx.stroke();
        ctx.fillStyle = colors.muted; ctx.textAlign = 'right'; ctx.font = '10px sans-serif'; ctx.fillText((model.series[0].unit === 'money' ? '₹' : '')+short(max*i/4),pad.left-8,y+3);
        if (model.series.length>1 && !sharedScale) { const secondMax = Math.max(1,...model.series[1].values)*1.12; ctx.textAlign = 'left'; ctx.fillText(short(secondMax*i/4),w-pad.right+7,y+3); }
      }
    }
    model.series.forEach((series,si) => {
      if (model.hidden.has(si)) return;
      const max = sharedScale ? sharedMax : Math.max(1,series.values.reduce((a,b) => Math.max(a,b),0))*1.12;
      const points = series.values.map((value,index) => ({x:pad.left+(index+.5)*plotW/n,y:pad.top+plotH-value/max*plotH,value,index})).filter(point => point.value != null);
      if (!points.length) return;
      if (model.kind === 'bar' && si === 0) {
        const barW = Math.max(1,Math.min(38,plotW/n*.6));
        points.forEach((point,index) => {
          const x = point.x-barW/2, height = point.value/max*plotH;
          if (height > 0) {
            if ((model.owner === page ? settings.depth : !model.owner.classList.contains('aw-flat')) && barW>5) {
              const d = Math.min(5,barW*.22); ctx.fillStyle = series.color+'75';
              ctx.beginPath(); ctx.moveTo(x+barW,point.y); ctx.lineTo(x+barW+d,point.y-d); ctx.lineTo(x+barW+d,pad.top+plotH-d); ctx.lineTo(x+barW,pad.top+plotH); ctx.closePath(); ctx.fill();
              ctx.fillStyle = series.color+'b0'; ctx.beginPath(); ctx.moveTo(x,point.y); ctx.lineTo(x+d,point.y-d); ctx.lineTo(x+barW+d,point.y-d); ctx.lineTo(x+barW,point.y); ctx.closePath(); ctx.fill();
            }
            const gradient = ctx.createLinearGradient(0,point.y,0,point.y+height); gradient.addColorStop(0,series.color); gradient.addColorStop(1,series.color+'90');
            ctx.fillStyle = gradient; ctx.beginPath(); ctx.roundRect(x,point.y,barW,height,Math.min(4,height/2,barW/2)); ctx.fill();
          }
          addHit(model,index,point.x,point.y,pad.left+index*plotW/n,pad.top,plotW/n,plotH);
        });
      } else {
        const gradient = ctx.createLinearGradient(0,pad.top,0,h-pad.bottom); gradient.addColorStop(0,series.color+'40'); gradient.addColorStop(1,series.color+'02');
        if (si === 0 && model.kind !== 'bar') {
          ctx.beginPath(); ctx.moveTo(points[0].x,h-pad.bottom); points.forEach(p => ctx.lineTo(p.x,p.y)); ctx.lineTo(points.at(-1).x,h-pad.bottom); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
        }
        if (model.kind === 'forecast' && si === 1) ctx.setLineDash([5,4]);
        ctx.beginPath(); points.forEach((p,i) => i ? ctx.lineTo(p.x,p.y) : ctx.moveTo(p.x,p.y)); ctx.strokeStyle = series.color; ctx.lineWidth = spark ? 2 : 2.5; ctx.stroke(); ctx.setLineDash([]);
        if (!spark && n<=31) points.forEach(p => { ctx.beginPath(); ctx.arc(p.x,p.y,n>14 ? 2 : 3,0,Math.PI*2); ctx.fillStyle = series.color; ctx.fill(); });
        if (si === 0 || model.hidden.has(0) || model.kind === 'forecast') points.forEach(point => {
          if (!model.hits.some(hit => hit.index === point.index)) addHit(model,point.index,point.x,point.y,pad.left+point.index*plotW/n,pad.top,plotW/n,plotH);
        });
      }
    });
    if (!spark) {
      ctx.fillStyle = colors.muted; ctx.textAlign = 'center'; ctx.font = '10px sans-serif';
      const every = Math.max(1,Math.ceil(n/Math.max(2,plotW/60)));
      model.labels.forEach((label,i) => { if (i%every === 0 || (n<8 && i === n-1)) ctx.fillText(label.length>12 ? label.slice(0,11)+'…' : label,pad.left+(i+.5)*plotW/n,h-12); });
    }
    if (model.selected>=0 && model.hits[model.selected]) {
      const hit = model.hits[model.selected]; ctx.strokeStyle = colors.ink; ctx.globalAlpha = .25; ctx.setLineDash([3,4]);
      ctx.beginPath(); ctx.moveTo(hit.x,pad.top); ctx.lineTo(hit.x,h-pad.bottom); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
  }
  function addHit(model,index,x,y,left,top,width,height) { model.hits.push({index,x,y,left,top,width,height}); }
  function drawDonut(model,ctx,w,h,colors) {
    const values = model.series[0].values;
    const total = values.reduce((sum,value,i) => sum+(model.hidden.has(i) ? 0 : value),0);
    const cx = w/2, cy = h/2-3, r = Math.min(w*.31,h*.38), inner = r*.7;
    ctx.lineWidth = r-inner; ctx.strokeStyle = colors.line; ctx.beginPath(); ctx.arc(cx,cy,(r+inner)/2,0,Math.PI*2); ctx.stroke();
    let angle = -Math.PI/2;
    values.forEach((value,index) => {
      if (!value || model.hidden.has(index) || !total) return;
      const end = angle+value/total*Math.PI*2, color = model.options.colors?.[index] || palette[index%palette.length];
      ctx.lineWidth = r-inner; ctx.strokeStyle = color;
      if (model.owner === page ? settings.depth : !model.owner.classList.contains('aw-flat')) { ctx.shadowColor = color+'40'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 5; }
      ctx.beginPath(); ctx.arc(cx,cy,(r+inner)/2,angle+.012,end-.012); ctx.stroke(); ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      model.hits.push({index,x:cx+Math.cos((angle+end)/2)*r,y:cy+Math.sin((angle+end)/2)*r,cx,cy,r,inner,start:angle,end}); angle = end;
    });
    ctx.fillStyle = colors.ink; ctx.textAlign = 'center'; ctx.font = '700 28px sans-serif'; ctx.fillText(short(total),cx,cy+4);
    ctx.fillStyle = colors.muted; ctx.font = '11px sans-serif'; ctx.fillText(model.options.center || 'orders',cx,cy+25);
  }
  function drawHorizontal(model,ctx,w,h,colors) {
    const series = model.series[0], max = Math.max(1,...series.values), row = (h-16)/model.labels.length;
    model.labels.forEach((label,index) => {
      const y = 8+index*row, left = 10, trackW = Math.max(1,w-20), value = series.values[index];
      ctx.fillStyle = colors.ink; ctx.textAlign = 'left'; ctx.font = '11px sans-serif'; ctx.fillText(label.slice(0,28),left,y+12);
      ctx.textAlign = 'right'; ctx.fillStyle = colors.muted; ctx.fillText(format(value,series.unit),w-10,y+12);
      const top = y+21, barH = Math.max(3,Math.min(13,row-26)); ctx.fillStyle = colors.line; ctx.beginPath(); ctx.roundRect(left,top,trackW,barH,3); ctx.fill();
      if (!model.hidden.has(0) && value) {
        const color = palette[index%palette.length], width = Math.max(1,value/max*trackW);
        const gradient = ctx.createLinearGradient(left,0,left+width,0); gradient.addColorStop(0,color); gradient.addColorStop(1,color+'90');
        if (model.owner === page ? settings.depth : !model.owner.classList.contains('aw-flat')) { ctx.shadowColor = color+'40'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 3; }
        ctx.fillStyle = gradient; ctx.beginPath(); ctx.roundRect(left,top,width,barH,Math.min(3,width/2)); ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      }
      addHit(model,index,left+trackW/2,top,left,y,trackW,row);
    });
  }
  function selectHit(model,index) {
    const hit = model.hits[index]; if (!hit) return;
    model.selected = index;
    const lines = [model.labels[hit.index]];
    model.series.forEach(series => { if (series.values[hit.index] != null) lines.push(series.name+': '+format(series.values[hit.index],series.unit)); });
    if (model.kind === 'donut') { const total = model.series[0].values.reduce((a,b) => a+b,0); lines.push((total ? model.series[0].values[hit.index]/total*100 : 0).toFixed(1)+'% of total'); }
    model.tip.textContent = lines.join('\n'); model.tip.hidden = false;
    const x = Math.min(model.wrap.clientWidth-model.tip.offsetWidth-8,Math.max(8,hit.x-model.tip.offsetWidth/2));
    model.tip.style.left = Math.max(8,x)+'px'; model.tip.style.top = Math.max(2,Math.min(model.wrap.clientHeight-model.tip.offsetHeight-4,hit.y-model.tip.offsetHeight-12))+'px';
  }
  function inspect(model,event) {
    const rect = model.canvas.getBoundingClientRect(), x = event.clientX-rect.left, y = event.clientY-rect.top;
    const index = model.hits.findIndex(hit => {
      if (hit.r) { let angle = Math.atan2(y-hit.cy,x-hit.cx); if (angle < -Math.PI/2) angle+=Math.PI*2; const distance = Math.hypot(x-hit.cx,y-hit.cy); return distance>=hit.inner && distance<=hit.r+8 && angle>=hit.start && angle<=hit.end; }
      return x>=hit.left && x<=hit.left+hit.width && y>=hit.top && y<=hit.top+hit.height;
    });
    if (index >= 0) selectHit(model,index); else { model.selected = -1; model.tip.hidden = true; }
    draw(model);
  }
  // Replace dashboard drawing only. Other admin pages keep their original charts.
  function intercept(name, ids, handler) {
    const original = window[name]; if (typeof original !== 'function') return;
    window[name] = function (...args) {
      if (ids.includes(args[0])) return handler(...args);
      return original.apply(this,args);
    };
  }
  intercept('drawBarChart',['revenueCanvas'],(id,labels,data,color,line) => register(id,'bar',labels,[{name:'Paid revenue',unit:'money',values:data,color:palette[0]},...(line ? [{name:'Orders · right axis',unit:'count',values:line,color:palette[2]}] : [])]));
  intercept('drawDonutChart',['statusCanvas','payCanvas'],(id,labels,data,colors) => register(id,'donut',labels,[{name:'Orders',unit:'count',values:data}],{colors:id === 'payCanvas' ? labels.map(label => ({Paid:palette[0],COD:palette[2],Failed:palette[4],Pending:palette[1]})[label] || palette[1]) : colors}));
  intercept('drawHourlyChart',['hourlyCanvas'],(id,data) => register(id,'bar',data.map((_,i) => String(i).padStart(2,'0')+':00'),[{name:'Orders',unit:'count',values:data,color:palette[1]}]));
  intercept('drawHBarChart',['catCanvas'],() => {
    const history = typeof allOrders !== 'undefined' ? allOrders : [];
    drawCategories(currentRange(history));
  });
  intercept('drawAreaChart',['areaCanvas','dashCustGrowthCanvas'],(id,labels,data) => register(id,'area',labels,[{name:id === 'areaCanvas' ? 'Order value' : 'First-time buyers',unit:id === 'areaCanvas' ? 'money' : 'count',values:data,color:id === 'areaCanvas' ? palette[0] : palette[1]}]));
  intercept('drawSparkline',['sparkRevCanvas','sparkOrdCanvas'],(id,data) => register(id,'spark',data.map((_,i) => { const day = new Date(); day.setDate(day.getDate()-(data.length-i-1)); return day.toLocaleDateString('en-IN',{day:'numeric',month:'short'}); }),[{name:id === 'sparkRevCanvas' ? 'Paid revenue' : 'Orders',unit:id === 'sparkRevCanvas' ? 'money' : 'count',values:data,color:id === 'sparkRevCanvas' ? palette[0] : palette[1]}]));
  intercept('drawForecastChart',['forecastCanvas'],(id,actual,forecast) => {
    const labels = [...actual,...forecast].map((_,index) => { const day = new Date(); day.setDate(day.getDate()+index-actual.length+1); return day.toLocaleDateString('en-IN',{day:'numeric',month:'short'}); });
    register(id,'forecast',labels,[
      {name:'Past order value',unit:'money',values:[...actual,...forecast.map(() => null)],color:palette[0]},
      {name:'Projection · estimate',unit:'money',values:[...actual.slice(0,-1).map(() => null),actual.at(-1),...forecast],color:palette[2]}
    ],{sharedScale:true});
  });
  // Theme-aware progress rings stay sharp when cards move or change size.
  const nativeRenders = new Map();
  function paintRing(id,value,color,label) {
    const canvas = document.getElementById(id); if (!canvas || !page.classList.contains('active')) return;
    const rows = currentRange(typeof allOrders !== 'undefined' ? allOrders : []);
    if (id === 'ring2Canvas') value = rows.length ? rows.filter(paid).length/rows.length*100 : 0;
    if (id === 'ring3Canvas' && typeof allProducts !== 'undefined') {
      const products = allProducts.filter(product => !product.deleted_at); value = products.length ? products.filter(product => finite(product.stock)>=20).length/products.length*100 : 0;
    }
    value = Math.min(100,finite(value)); const ratio = Math.min(devicePixelRatio || 1,2), ctx = canvas.getContext('2d'), colors = theme();
    canvas.width = 100*ratio; canvas.height = 100*ratio; canvas.style.width = '100px'; canvas.style.height = '100px'; ctx.setTransform(ratio,0,0,ratio,0,0);
    ctx.lineWidth = 8; ctx.strokeStyle = colors.line; ctx.beginPath(); ctx.arc(50,50,38,0,Math.PI*2); ctx.stroke();
    ctx.lineCap = 'round'; ctx.strokeStyle = palette[['ring1Canvas','ring2Canvas','ring3Canvas'].indexOf(id)] || palette[0];
    if (settings.depth) { ctx.shadowColor = ctx.strokeStyle+'40'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3; }
    if (value) { ctx.beginPath(); ctx.arc(50,50,38,-Math.PI/2,-Math.PI/2+value/100*Math.PI*2); ctx.stroke(); }
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; ctx.fillStyle = colors.ink; ctx.font = '700 18px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(Math.round(value)+'%',50,52);
    ctx.fillStyle = colors.muted; ctx.font = '8px sans-serif'; ctx.fillText(label || 'achieved',50,65);
    canvas.setAttribute('role','img'); canvas.setAttribute('aria-label',(label || 'Monthly goal')+': '+Math.round(value)+' percent');
  }
  ['drawRing','drawGoalRing'].forEach(name => {
    const original = window[name]; if (typeof original !== 'function') return;
    window[name] = function (...args) {
      if (grid.contains(document.getElementById(args[0]))) { const render = () => paintRing(...args); nativeRenders.set(args[0],render); return render(); }
      return original.apply(this,args);
    };
  });
  const paid = order => {
    const value = String(order.payment_status || '').trim().toLowerCase();
    return !/unpaid|not.?paid/.test(value) && (/\bpaid\b|success/.test(value));
  };
  function currentRange(orders) {
    const range = typeof _dashGRange === 'object' ? _dashGRange : {mode:'days',days:7};
    if (range.mode === 'all') return orders;
    const start = new Date(), end = new Date();
    if (range.mode === 'custom' && range.from && range.to) {
      start.setTime(new Date(range.from+'T00:00:00').getTime()); end.setTime(new Date(range.to+'T00:00:00').getTime());
    } else if (range.mode !== 'today') start.setDate(start.getDate()-((range.days || 7)-1));
    start.setHours(0,0,0,0); end.setHours(23,59,59,999);
    return orders.filter(order => { const time = new Date(order.created_at); return time>=start && time<=end; });
  }
  // The cards and charts must use the same inclusive local-calendar date window.
  window._dashGFilterOrders = currentRange;
  function bucketsForRange(orders) {
    const range = typeof _dashGRange === 'object' ? _dashGRange : {mode:'days',days:7};
    let end = new Date(), start = new Date();
    if (range.mode === 'custom') { start = new Date(range.from+'T00:00:00'); end = new Date(range.to+'T00:00:00'); }
    else if (range.mode === 'all') {
      const times = orders.map(o => new Date(o.created_at).getTime()).filter(Number.isFinite); start = times.length ? new Date(Math.min(...times)) : end;
    } else start.setDate(start.getDate()-((range.mode === 'today' ? 1 : range.days || 7)-1));
    start.setHours(0,0,0,0); end.setHours(23,59,59,999);
    const monthly = (end-start)/86400000 >= 60, buckets = [];
    const cursor = new Date(start); if (monthly) cursor.setDate(1);
    // Bound drawing work for very long histories by using yearly buckets.
    const yearly = monthly && (end-start)/86400000 > 365*10;
    if (yearly) cursor.setMonth(0,1);
    const key = date => yearly ? String(date.getFullYear()) : monthly ? date.getFullYear()+'-'+date.getMonth() : date.getFullYear()+'-'+date.getMonth()+'-'+date.getDate();
    while (cursor<=end && buckets.length<400) {
      buckets.push({key:key(cursor),label:yearly ? String(cursor.getFullYear()) : cursor.toLocaleDateString('en-IN',monthly ? {month:'short',year:'2-digit'} : {day:'numeric',month:'short'}),revenue:0,count:0,buyers:0});
      if (yearly) cursor.setFullYear(cursor.getFullYear()+1); else if (monthly) cursor.setMonth(cursor.getMonth()+1); else cursor.setDate(cursor.getDate()+1);
    }
    const byKey = new Map(buckets.map(bucket => [bucket.key,bucket]));
    orders.forEach(order => { const bucket = byKey.get(key(new Date(order.created_at))); if (bucket) { bucket.count++; if (paid(order)) bucket.revenue+=finite(order.total); } });
    const firstSeen = new Map();
    const history = typeof allOrders !== 'undefined' && allOrders.length ? allOrders : orders;
    history.forEach(order => {
      const identity = String(order.customer_email || order.customer_phone || order.customer_id || '').trim().toLowerCase(), date = new Date(order.created_at);
      if (!identity || !Number.isFinite(date.getTime())) return;
      if (!firstSeen.has(identity) || date<firstSeen.get(identity)) firstSeen.set(identity,date);
    });
    firstSeen.forEach(date => { if (date>=start && date<=end) { const bucket = byKey.get(key(date)); if (bucket) bucket.buyers++; } });
    return buckets;
  }
  window.renderRevenueChart = function (orders) {
    const rows = currentRange(orders || []), buckets = bucketsForRange(rows);
    register('revenueCanvas','bar',buckets.map(b => b.label),[{name:'Paid revenue',unit:'money',values:buckets.map(b => b.revenue),color:palette[0]},{name:'Orders · right axis',unit:'count',values:buckets.map(b => b.count),color:palette[2]}]);
    const badge = document.getElementById('dashRevTotal'); if (badge) badge.textContent = money(buckets.reduce((sum,b) => sum+b.revenue,0));
  };
  window.renderDashCustGrowth = function (orders) {
    const buckets = bucketsForRange(currentRange(orders || []));
    register('dashCustGrowthCanvas','area',buckets.map(b => b.label),[{name:'First-time buyers',unit:'count',values:buckets.map(b => b.buyers),color:palette[1]}]);
    const badge = document.getElementById('custGrowthTotalDash');
    if (badge) badge.textContent = buckets.reduce((sum,b) => sum+b.buyers,0)+' buyers';
  };
  window.renderHourlyChart = function (orders) {
    const hourly = Array(24).fill(0);
    currentRange(orders || []).forEach(order => { const hour = new Date(order.created_at).getHours(); if (Number.isInteger(hour)) hourly[hour]++; });
    register('hourlyCanvas','bar',hourly.map((_,i) => String(i).padStart(2,'0')+':00'),[{name:'Orders',unit:'count',values:hourly,color:palette[1]}]);
    const peak = hourly.indexOf(Math.max(...hourly)); document.getElementById('peakHour').textContent = hourly[peak] ? 'Peak '+String(peak).padStart(2,'0')+':00' : 'No orders';
  };
  const originalStatus = window.renderStatusChart;
  if (typeof originalStatus === 'function') window.renderStatusChart = function (orders) { return originalStatus.call(this,currentRange(orders || [])); };
  window.renderPayChart = function (orders) {
    const counts = {Paid:0,COD:0,Failed:0,Pending:0};
    currentRange(orders || []).forEach(order => {
      const value = String(order.payment_status || '').toLowerCase();
      counts[paid(order) ? 'Paid' : value.includes('cod') ? 'COD' : value.includes('fail') ? 'Failed' : 'Pending']++;
    });
    const labels = Object.keys(counts).filter(label => counts[label]>0);
    register('payCanvas','donut',labels,[{name:'Orders',unit:'count',values:labels.map(label => counts[label])}],{colors:labels.map(label => ({Paid:palette[0],COD:palette[2],Failed:palette[4],Pending:palette[1]})[label])});
  };
  window.renderOrderFunnel = function (orders) {
    const rows = currentRange(orders || []), counts = new Map();
    rows.forEach(order => { const status = String(order.fulfillment || order.status || 'Pending'); counts.set(status,(counts.get(status) || 0)+1); });
    const names = ['Pending','Processing','Shipped','Delivered','Cancelled'];
    counts.forEach((_,key) => { if (!names.includes(key)) names.push(key); });
    const container = document.getElementById('orderFunnelWidget'); container.replaceChildren();
    const flow = document.createElement('div'); flow.className = 'dw-flow';
    const note = document.createElement('div'); note.className = 'dw-flow-note'; note.setAttribute('role','status');
    note.textContent = 'Current fulfilment status of orders in the selected range. Select a stage to inspect its share.';
    names.forEach((name,index) => {
      const count = counts.get(name) || 0, percent = rows.length ? count/rows.length*100 : 0;
      const button = document.createElement('button'); button.type = 'button'; button.setAttribute('aria-pressed','false');
      button.innerHTML = '<span class="dw-flow-number">'+(index+1)+'</span><span><strong></strong><small></small><span class="dw-flow-track"><i></i></span></span><b>'+count+'</b>';
      button.querySelector('strong').textContent = name; button.querySelector('small').textContent = percent.toFixed(1)+'% of orders'; button.querySelector('i').style.width = percent+'%';
      button.addEventListener('click',() => { flow.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed',String(b === button))); note.textContent = count+' of '+rows.length+' orders are '+name.toLowerCase()+' ('+percent.toFixed(1)+'%) in this range.'; }); flow.appendChild(button);
    });
    container.append(flow,note); document.getElementById('funnelTotal').textContent = rows.length+' orders';
  };
  function extraInsights(orders, products) {
    const rows = currentRange(orders), bands = [0,500,1000,2000,5000], distribution = Array(5).fill(0);
    document.getElementById('dashRevTotal').textContent = money(rows.filter(paid).reduce((sum,order) => sum+finite(order.total),0));
    const rangeLabel = typeof _dashGRangeLabel === 'function' ? _dashGRangeLabel() : 'selected range';
    const orderValueCard = document.querySelector('#kpiCards .kpi:nth-child(2)');
    if (orderValueCard) {
      orderValueCard.querySelector('.kpi-label').textContent = 'Order value · '+rangeLabel;
      const codValue = rows.filter(order => String(order.payment_status || '').toLowerCase().includes('cod')).reduce((sum,order) => sum+finite(order.total),0);
      orderValueCard.querySelector('.kpi-trend').textContent = money(rows.filter(paid).reduce((sum,order) => sum+finite(order.total),0))+' paid · '+money(codValue)+' COD order value';
    }
    const orderValueTicker = document.querySelector('#statsTicker .stat-tick:first-child .stat-tick-lbl');
    if (orderValueTicker) orderValueTicker.textContent = 'Order value · '+rangeLabel;
    rows.forEach(order => { const value = finite(order.total); let index = 0; while (index<bands.length-1 && value>=bands[index+1]) index++; distribution[index]++; });
    register('dw-order-size','bar',['₹0–499','₹500–999','₹1k–1,999','₹2k–4,999','₹5k+'],[{name:'Orders',unit:'count',values:distribution,color:palette[1]}]);
    const stock = [0,0,0]; products.filter(p => !p.deleted_at).forEach(product => { const value = finite(product.stock); stock[value === 0 ? 2 : value < 20 ? 1 : 0]++; });
    register('dw-stock-mix','donut',['Stocked · 20+','Low · 1–19','Out of stock'],[{name:'Products',unit:'count',values:stock}],{colors:[palette[0],palette[2],palette[4]],center:'products'});
    drawCategories(rows);
    const conv = document.getElementById('sparkConvVal')?.previousElementSibling; if (conv) conv.textContent = 'Paid order share';
    const share = rows.length ? rows.filter(paid).length/rows.length*100 : 0;
    document.getElementById('sparkConvVal').textContent = share.toFixed(1)+'%';
    document.getElementById('sparkConvLabel').textContent = rows.filter(paid).length+' of '+rows.length+' paid · '+(typeof _dashGRangeLabel === 'function' ? _dashGRangeLabel() : 'selected range');
    const tickerLabel = document.querySelector('#statsTicker .stat-tick:nth-child(3) .stat-tick-lbl');
    if (tickerLabel) { tickerLabel.textContent = 'Paid share · '+(typeof _dashGRangeLabel === 'function' ? _dashGRangeLabel() : 'selected range'); tickerLabel.previousElementSibling.textContent = share.toFixed(1)+'%'; }
  }
  function drawCategories(rows) {
    // Empty category ranges must clear an earlier range's chart, including delayed native calls.
    const cats = new Map();
    rows.filter(paid).forEach(order => {
      try { const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        if (Array.isArray(items)) items.forEach(item => { const key = String(item.category || 'Other'); cats.set(key,(cats.get(key) || 0)+finite(item.price)*finite(item.qty ?? 1)); });
      } catch (_) { /* Invalid historical items do not break the dashboard. */ }
    });
    const entries = [...cats].sort((a,b) => b[1]-a[1]).slice(0,7);
    register('catCanvas','hbar',entries.map(e => e[0]),[{name:'Paid item sales',unit:'money',values:entries.map(e => e[1])}]);
  }
  const originalRender = window.renderDashboardData;
  if (typeof originalRender === 'function') window.renderDashboardData = function (orders,products,stats) {
    const result = originalRender.apply(this,arguments); extraInsights(orders || [],products || []); return result;
  };
  const originalAdvanced = window.renderAdvancedWidgets;
  if (typeof originalAdvanced === 'function') window.renderAdvancedWidgets = function (orders,products) {
    return originalAdvanced.call(this,currentRange(orders || []),products || []);
  };
  // Shared renderer for the other admin workspaces. Existing dashboard hooks stay scoped.
  window.OzylixAdminCharts = {register, redraw:scheduleDraw};
  applyOrder(settings.order); applyAppearance();
  widgets.forEach(({card}) => resizeObserver?.observe(card));
  window.addEventListener('resize',() => { scheduleDraw(); nativeRenders.forEach(render => render()); },{passive:true});
  new MutationObserver(() => {
    if (!page.classList.contains('active')) cancelDrag();
    scheduleDraw();
  }).observe(page,{attributes:true,attributeFilter:['class']});
  new MutationObserver(scheduleDraw).observe(document.body,{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',() => { if (document.hidden) cancelDrag(); else scheduleDraw(); });
  // An early synchronous loader may already have drawn before this deferred layer.
  if (typeof allOrders !== 'undefined' && allOrders.length && typeof allProducts !== 'undefined') {
    renderDashboardData(allOrders,allProducts,typeof _dashLastStats === 'object' ? _dashLastStats : {});
  }
})();
