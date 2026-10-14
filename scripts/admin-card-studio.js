/* Browser-local card preferences. Does not mutate orders, products or server configuration. */
(function () {
  'use strict';
  const root = document.getElementById('app'), charts = window.OzylixAdminCharts;
  if (!root || !charts) return;
  const selector = '.dw-widget,.aw-card,.card,.oz-section-card,.kpi,.oz-kpi-card,.mkt-kpi';
  const states = new Map(), wired = new WeakSet(), observed = new WeakSet();
  const types = {revenue:'Paid revenue trend',fulfilment:'Fulfilment breakdown',payments:'Payment breakdown',inventory:'Inventory health',orders:'Order count',paid:'Paid order value',lowstock:'Low stock count',note:'Personal note'};
  const accents = {default:'',sage:'#526b48',blue:'#558ca0',gold:'#c69532',rose:'#ca7469',violet:'#8573ad'};
  let frame = 0, drag = null, dialog = null;
  const live = document.createElement('div'); live.className = 'dw-status'; live.setAttribute('role','status'); root.appendChild(live);
  const announce = text => { live.textContent = text; };
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const dimension = value => Number.isFinite(Number(value)) && Number(value)>0 ? Math.max(96,Math.round(Number(value))) : null;
  const clean = value => String(value || '').trim().slice(0,140);
  function stateFor(page) {
    if (!states.has(page)) {
      let saved = {}; try { saved = object(JSON.parse(localStorage.getItem('ozylix_admin_card_studio_'+page.id+'_v1') || '{}')); } catch (_) {}
      const custom = Array.isArray(saved.custom) ? saved.custom.filter(item => item && /^custom-[a-z0-9-]+$/i.test(item.id) && Object.hasOwn(types,item.type)).map(item => ({id:item.id,type:item.type,note:String(item.note || '').slice(0,3000)})) : [];
      states.set(page,{page,settings:{cards:object(saved.cards),custom},originals:new Map(),customNodes:new Map()});
    }
    return states.get(page);
  }
  function save(state) {
    try { localStorage.setItem('ozylix_admin_card_studio_'+state.page.id+'_v1',JSON.stringify(state.settings)); announce('Card preferences saved in this browser.'); }
    catch (_) { announce('Card preferences changed for this session. Browser storage is unavailable.'); }
  }
  function cardsOn(page) { return [...page.querySelectorAll(selector)].filter(card => !card.parentElement.closest(selector) && !card.classList.contains('skel')); }
  function idFor(card) {
    if (card.dataset.csId) return card.dataset.csId;
    const parent = card.parentElement;
    const key = card.dataset.widget ? 'widget:'+card.dataset.widget : card.dataset.awId ? 'card:'+card.dataset.awId : card.id ? 'element:'+card.id : card.querySelector('[id]')?.id ? 'element:'+card.querySelector('[id]').id : 'slot:'+(parent.id || parent.dataset.awGroup || [...card.closest('.page').querySelectorAll('*')].indexOf(parent))+':'+[...parent.children].indexOf(card);
    card.dataset.csId = key; return key;
  }
  function labelNode(card) { return card.querySelector('.card-title,.kpi-label,.oz-kpi-label,h2,h3'); }
  function labelFor(card) { return clean(labelNode(card)?.textContent || card.getAttribute('aria-label') || card.dataset.widget || 'Card'); }
  function metaFor(card) { return object(stateFor(card.closest('.page')).settings.cards[idFor(card)]); }
  function visible(card) { return !card.classList.contains('cs-hidden') && card.getClientRects().length>0; }
  function chartHeight(card) {
    const height = dimension(metaFor(card).height); if (!height) return;
    const wrap = card.querySelector('.dw-chart-wrap:not(.dw-spark)'); if (!wrap) return;
    const top = wrap.getBoundingClientRect().top-card.getBoundingClientRect().top+card.scrollTop;
    const footer = [...card.querySelectorAll('.dw-legend,.dw-chart-data,.aw-data-note,.cs-source')].reduce((sum,node) => { const style = getComputedStyle(node); return sum+node.getBoundingClientRect().height+(parseFloat(style.marginTop)||0)+(parseFloat(style.marginBottom)||0); },0);
    const next = Math.max(60,height-top-footer-12)+'px';
    if (card.style.getPropertyValue('--cs-chart-height') !== next) card.style.setProperty('--cs-chart-height',next);
  }
  const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(entries => { entries.forEach(entry => chartHeight(entry.target)); charts.redraw(); }) : null;
  function apply(card) {
    const state = stateFor(card.closest('.page')), id = idFor(card), meta = object(state.settings.cards[id]);
    card.classList.add('cs-card');
    if (!state.originals.has(id)) state.originals.set(id,labelFor(card));
    card.classList.toggle('cs-hidden',meta.hidden === true);
    const label = labelNode(card), title = clean(meta.title);
    if (title && label && label.textContent !== title) label.textContent = title;
    if (title) card.setAttribute('aria-label',title);
    const width = dimension(meta.width), height = dimension(meta.height);
    if (width) card.style.setProperty('--cs-free-width',width+'px'); else card.style.removeProperty('--cs-free-width');
    if (height) card.style.setProperty('--cs-free-height',height+'px'); else { card.style.removeProperty('--cs-free-height'); card.style.removeProperty('--cs-chart-height'); }
    card.classList.toggle('cs-sized',!!height); card.classList.toggle('cs-tinted',!!accents[meta.accent]);
    card.style.setProperty('--cs-accent',accents[meta.accent] || 'var(--dw-line)');
    const parent = card.parentElement, children = [...parent.children];
    if (children.every(node => node.matches(selector))) {
      parent.classList.add('cs-flex');
      const count = children.filter(node => !node.classList.contains('cs-hidden')).length;
      parent.style.setProperty('--cs-default-span',count<=1 ? 12 : count===2 ? 6 : count===3 ? 4 : 3);
    }
    if (!observed.has(card)) { resizeObserver?.observe(card); observed.add(card); }
    chartHeight(card);
    if (!wired.has(card)) {
      wired.add(card);
      let controls = card.querySelector(':scope > .dw-controls,:scope > .aw-controls');
      if (!controls) { controls = document.createElement('div'); controls.className = 'cs-controls'; card.prepend(controls); }
      const label = labelFor(card);
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'cs-edit'; edit.textContent = 'Customize'; edit.setAttribute('aria-label','Customize '+label);
      const hide = document.createElement('button'); hide.type = 'button'; hide.className = 'cs-hide'; hide.textContent = 'Hide'; hide.setAttribute('aria-label','Hide '+label);
      controls.append(edit,hide);
      edit.addEventListener('click',() => openEditor(state,card,edit));
      hide.addEventListener('click',() => { state.settings.cards[id] = {...metaFor(card),hidden:true}; apply(card); save(state); announce(label+' hidden. Restore it in Manage cards.'); });
      if (!card.querySelector(':scope > .aw-resize')) {
        const corner = document.createElement('button'); corner.type = 'button'; corner.className = 'aw-resize'; corner.textContent = '↘'; corner.setAttribute('aria-label','Resize '+label); card.appendChild(corner);
      }
    }
    card.querySelector(':scope > .aw-resize')?.setAttribute('title','Drag for any width and height. Arrow keys resize by 10px; Shift uses 1px.');
  }
  function closeDialog() {
    if (!dialog) return;
    const {element,opener} = dialog; dialog = null; element.remove(); opener?.focus();
  }
  function openDialog(title,opener) {
    closeDialog();
    const overlay = document.createElement('div'); overlay.className = 'cs-overlay';
    const panel = document.createElement('section'); panel.className = 'cs-dialog'; panel.tabIndex = -1; panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true');
    const heading = document.createElement('h2'); heading.id = 'cs-dialog-title'; heading.textContent = title; panel.setAttribute('aria-labelledby',heading.id);
    const close = document.createElement('button'); close.type = 'button'; close.className = 'cs-close'; close.textContent = 'Close'; close.addEventListener('click',closeDialog);
    const header = document.createElement('header'); header.append(heading,close);
    const content = document.createElement('div'); content.className = 'cs-dialog-body'; panel.append(header,content); overlay.appendChild(panel); root.appendChild(overlay);
    dialog = {element:overlay,opener}; overlay.addEventListener('click',event => { if (event.target === overlay) closeDialog(); });
    panel.addEventListener('keydown',event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeDialog(); }
      if (event.key !== 'Tab') return;
      const focusable = [...panel.querySelectorAll('button,input,select,textarea,[tabindex="0"]')].filter(node => !node.disabled && node.getClientRects().length);
      if (!focusable.length) { event.preventDefault(); return; }
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    panel.focus(); return content;
  }
  function field(form,label,type,value) {
    const row = document.createElement('label'); row.className = 'cs-field'; const text = document.createElement('span'); text.textContent = label;
    const input = document.createElement(type === 'textarea' ? 'textarea' : 'input'); if (type !== 'textarea') input.type = type;
    input.value = value ?? ''; if (type === 'number') { input.min = '96'; input.step = '1'; input.placeholder = 'Auto'; }
    if (type === 'text') input.maxLength = 140;
    if (type === 'textarea') input.maxLength = 3000;
    row.append(text,input); form.appendChild(row); return input;
  }
  function choice(form,label,options,value) {
    const row = document.createElement('label'); row.className = 'cs-field'; const text = document.createElement('span'); text.textContent = label;
    const input = document.createElement('select'); Object.entries(options).forEach(([key,label]) => { const option = document.createElement('option'); option.value = key; option.textContent = label; input.appendChild(option); }); input.value = value;
    row.append(text,input); form.appendChild(row); return input;
  }
  function openEditor(state,card,opener) {
    const body = openDialog('Customize card',opener), form = document.createElement('form'), id = idFor(card), meta = metaFor(card);
    const title = field(form,'Card title','text',meta.title || labelFor(card));
    const size = document.createElement('div'); size.className = 'cs-field-grid'; form.appendChild(size);
    const width = field(size,'Width (px)','number',meta.width), height = field(size,'Height (px)','number',meta.height);
    const note = document.createElement('p'); note.className = 'cs-hint'; note.textContent = 'Enter exact sizes or leave blank for Auto. Width fits the available screen; height has no preset maximum. Smaller cards scroll their contents.'; form.appendChild(note);
    const accent = choice(form,'Card accent',{default:'Theme default',sage:'Sage',blue:'Blue',gold:'Gold',rose:'Rose',violet:'Violet'},meta.accent || 'default');
    const style = card.querySelector('canvas[data-chart-kind="bar"],canvas[data-chart-kind="area"],canvas[data-chart-kind="hbar"],canvas[data-chart-kind="line"]') ? choice(form,'Chart style',{default:'Default',bar:'Bars',line:'Line',area:'Area'},meta.chartStyle || 'default') : null;
    const custom = state.settings.custom.find(item => item.id === id);
    const text = custom?.type === 'note' ? field(form,'Note','textarea',custom.note) : null;
    const buttons = document.createElement('div'); buttons.className = 'cs-form-actions';
    const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Reset card';
    reset.addEventListener('click',() => { state.settings.cards[id] = {}; const node = labelNode(card); if (node) node.textContent = state.originals.get(id); card.setAttribute('aria-label',state.originals.get(id)); apply(card); save(state); closeDialog(); schedule(); });
    const submit = document.createElement('button'); submit.type = 'submit'; submit.className = 'cs-primary'; submit.textContent = 'Save card'; buttons.append(reset,submit); form.appendChild(buttons); body.appendChild(form);
    form.addEventListener('submit',event => {
      event.preventDefault(); state.settings.cards[id] = {...meta,title:clean(title.value),width:dimension(width.value),height:dimension(height.value),accent:accent.value,chartStyle:style?.value || 'default'};
      if (text) custom.note = text.value;
      apply(card); save(state); closeDialog(); schedule(); charts.redraw();
    });
  }
  function openManager(state,opener) {
    const body = openDialog('Manage cards',opener), note = document.createElement('p'); note.className = 'cs-hint'; note.textContent = 'Hide cards you do not need. Built-in cards can always be restored. These choices belong to this browser.'; body.appendChild(note);
    const list = document.createElement('div'); list.className = 'cs-card-list';
    cardsOn(state.page).forEach(card => {
      const id = idFor(card), row = document.createElement('div'); row.className = 'cs-manage-row';
      const label = document.createElement('label'), check = document.createElement('input'); check.type = 'checkbox'; check.checked = !metaFor(card).hidden;
      const name = document.createElement('span'); name.textContent = labelFor(card); label.append(check,name);
      check.addEventListener('change',() => { state.settings.cards[id] = {...metaFor(card),hidden:!check.checked}; apply(card); save(state); charts.redraw(); });
      const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Customize'; edit.setAttribute('aria-label','Customize '+labelFor(card)); edit.addEventListener('click',() => openEditor(state,card,opener)); row.append(label,edit);
      if (card.dataset.csCustom) {
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Delete'; remove.setAttribute('aria-label','Delete '+labelFor(card));
        remove.addEventListener('click',() => { state.settings.custom = state.settings.custom.filter(item => item.id !== id); delete state.settings.cards[id]; charts.remove?.(card); resizeObserver?.unobserve(card); state.customNodes.delete(id); card.remove(); row.remove(); save(state); }); row.appendChild(remove);
      }
      list.appendChild(row);
    }); body.appendChild(list);
    const actions = document.createElement('div'); actions.className = 'cs-form-actions';
    const restore = document.createElement('button'); restore.type = 'button'; restore.textContent = 'Show all cards'; restore.addEventListener('click',() => { cardsOn(state.page).forEach(card => { const id = idFor(card); state.settings.cards[id] = {...metaFor(card),hidden:false}; apply(card); }); save(state); openManager(state,opener); });
    const add = document.createElement('button'); add.type = 'button'; add.className = 'cs-primary'; add.textContent = 'Add card'; add.addEventListener('click',() => openAdd(state,opener)); actions.append(restore,add); body.appendChild(actions);
  }
  function openAdd(state,opener) {
    const body = openDialog('Add a card',opener), form = document.createElement('form');
    const type = choice(form,'Card type',types,'revenue'), title = field(form,'Card title','text',types.revenue), note = field(form,'Note (for personal note cards)','textarea','');
    type.addEventListener('change',() => { title.value = types[type.value]; note.closest('label').hidden = type.value !== 'note'; }); note.closest('label').hidden = true;
    const hint = document.createElement('p'); hint.className = 'cs-hint'; hint.textContent = 'Data cards use loaded store records and follow the Orders, Payments or Inventory filters on those pages.'; form.appendChild(hint);
    const add = document.createElement('button'); add.type = 'submit'; add.className = 'cs-primary'; add.textContent = 'Add card'; form.appendChild(add); body.appendChild(form);
    form.addEventListener('submit',event => {
      event.preventDefault(); const id = 'custom-'+(crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
      state.settings.custom.push({id,type:type.value,note:note.value}); state.settings.cards[id] = {title:clean(title.value) || types[type.value]};
      createCustom(state); save(state); closeDialog(); schedule(); announce('Card added. Use Arrange to move it and drag its corner to resize.');
    });
  }
  function createCustom(state) {
    if (!state.settings.custom.length) return;
    let group = state.page.querySelector(':scope > .cs-custom-grid');
    if (!group) { group = document.createElement('div'); group.className = 'cs-custom-grid cs-flex'; group.setAttribute('aria-label','Personal cards'); state.page.appendChild(group); }
    state.settings.custom.forEach(item => {
      if (state.customNodes.get(item.id)?.isConnected) return;
      const card = document.createElement('section'); card.className = 'card cs-custom'; card.dataset.csId = item.id; card.dataset.csCustom = 'true';
      const header = document.createElement('div'); header.className = 'card-hdr'; const title = document.createElement('span'); title.className = 'card-title'; title.textContent = clean(state.settings.cards[item.id]?.title) || types[item.type]; header.appendChild(title); card.appendChild(header);
      if (['orders','paid','lowstock'].includes(item.type)) { const value = document.createElement('div'); value.className = 'cs-value'; card.appendChild(value); }
      else if (item.type === 'note') { const text = document.createElement('p'); text.className = 'cs-note'; card.appendChild(text); }
      else { const canvas = document.createElement('canvas'); canvas.id = 'cs-chart-'+item.id; card.appendChild(canvas); }
      const source = document.createElement('p'); source.className = 'cs-source'; source.textContent = item.type === 'note' ? 'Personal note · saved in this browser' : 'Loaded store records'; card.appendChild(source); group.appendChild(card); state.customNodes.set(item.id,card);
      apply(card);
      const controls = card.querySelector('.cs-controls');
      const handle = document.createElement('button'); handle.type = 'button'; handle.className = 'cs-handle'; handle.textContent = '⠿'; handle.setAttribute('aria-label','Move '+labelFor(card)); handle.title = 'Drag to move this personal card, or use arrow keys.'; controls.prepend(handle);
      for (const [delta,label] of [[-1,'Move earlier'],[1,'Move later']]) { const button = document.createElement('button'); button.type = 'button'; button.textContent = delta<0 ? '↑' : '↓'; button.setAttribute('aria-label',label); button.addEventListener('click',() => { const index = state.settings.custom.findIndex(c => c.id === item.id), target = index+delta; if (target<0 || target>=state.settings.custom.length) return; [state.settings.custom[index],state.settings.custom[target]] = [state.settings.custom[target],state.settings.custom[index]]; const neighbor = state.customNodes.get(state.settings.custom[index].id); if (delta<0) neighbor.before(card); else neighbor.after(card); save(state); }); controls.appendChild(button); }
    });
  }
  const number = value => Math.max(0,Number(value)||0);
  const paid = order => /\bpaid\b|success/i.test(order.payment_status || '') && !/unpaid|not.?paid/i.test(order.payment_status || '');
  function refreshCustom(state) {
    let orders = typeof allOrders !== 'undefined' ? allOrders : [], products = typeof allProducts !== 'undefined' ? allProducts.filter(p => !p.deleted_at) : [];
    let scope = 'Loaded store records';
    if (state.page.id === 'page-orders' && typeof ordersFilteredList !== 'undefined') { orders = ordersFilteredList; scope = 'Loaded orders · current filters'; }
    if (state.page.id === 'page-payments' && typeof paymentsFilteredList !== 'undefined') { orders = paymentsFilteredList; scope = 'Loaded payments · current filters'; }
    if (state.page.id === 'page-dashboard' && typeof window._dashGFilterOrders === 'function') { orders = window._dashGFilterOrders(orders); scope = 'Loaded orders · dashboard range'; }
    if (state.page.id === 'page-inventory') {
      const q = (document.getElementById('invSearch')?.value || '').toLowerCase(), filter = typeof currentInvFilter !== 'undefined' ? currentInvFilter : 'all';
      products = products.filter(p => String(p.name || '').toLowerCase().includes(q) && (filter === 'critical' ? p.stock===0 : filter === 'low' ? p.stock>0 && p.stock<20 : filter === 'ok' ? p.stock>=20 : true)); scope = 'Loaded products · current filters';
    }
    state.settings.custom.forEach(item => {
      const card = state.customNodes.get(item.id); if (!card) return;
      const meta = metaFor(card);
      if (item.type === 'note') { const text = card.querySelector('.cs-note'); if (text.textContent !== item.note) text.textContent = item.note; return; }
      const source = card.querySelector('.cs-source'); if (source.textContent !== scope) source.textContent = scope;
      if (['orders','paid','lowstock'].includes(item.type)) {
        const value = item.type === 'orders' ? orders.length : item.type === 'lowstock' ? products.filter(p => number(p.stock)<20).length : orders.filter(paid).reduce((sum,o) => sum+number(o.total),0);
        const text = (item.type === 'paid' ? '₹' : '')+new Intl.NumberFormat('en-IN',{maximumFractionDigits:0}).format(value); const element = card.querySelector('.cs-value'); if (element.textContent !== text) element.textContent = text; return;
      }
      let labels, values, kind='donut', unit='count', name='Orders';
      if (item.type === 'inventory') { labels=['Stocked · 20+','Low · 1–19','Out of stock']; values=[0,0,0]; products.forEach(p => values[number(p.stock)===0 ? 2 : number(p.stock)<20 ? 1 : 0]++); name='Products'; }
      if (item.type === 'payments') { labels=['Paid','COD pending','Failed','Other / pending']; values=[0,0,0,0]; orders.forEach(o => values[paid(o) ? 0 : /cod/i.test(o.payment_status || '') ? 1 : /fail/i.test(o.payment_status || '') ? 2 : 3]++); }
      if (item.type === 'fulfilment') { const counts = new Map(); orders.forEach(o => { const status=String(o.status || o.fulfillment || 'Pending'); counts.set(status,(counts.get(status)||0)+1); }); labels=[...counts.keys()]; values=[...counts.values()]; kind='hbar'; }
      if (item.type === 'revenue') {
        const dates=orders.map(o => new Date(o.created_at).getTime()).filter(Number.isFinite), monthly=dates.length && Math.max(...dates)-Math.min(...dates)>90*86400000;
        const buckets=new Map(); orders.forEach(o => { const date=new Date(o.created_at); if (!Number.isFinite(date.getTime())) return; const key=date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+(monthly ? '' : '-'+String(date.getDate()).padStart(2,'0')); buckets.set(key,(buckets.get(key)||0)+(paid(o) ? number(o.total) : 0)); }); const sorted=[...buckets].sort((a,b) => a[0].localeCompare(b[0])); labels=sorted.map(b => b[0]); values=sorted.map(b => b[1]); kind='bar'; unit='money'; name='Paid value';
      }
      const signature=JSON.stringify({labels,values,kind,style:meta.chartStyle}); if (card.dataset.csSignature === signature) return; card.dataset.csSignature=signature;
      charts.register('cs-chart-'+item.id,kind,labels,[{name,unit,values}],{center:name.toLowerCase()}); chartHeight(card);
    });
  }
  function toolbar(state) {
    const container = state.page.querySelector('.dw-toolbar-actions,.aw-tools'); if (!container || container.querySelector('[data-cs-manage]')) return;
    const manage = document.createElement('button'); manage.type='button'; manage.className='dw-button'; manage.dataset.csManage='true'; manage.textContent='Manage cards'; manage.addEventListener('click',() => openManager(state,manage));
    const add = document.createElement('button'); add.type='button'; add.className='dw-button'; add.dataset.csAdd='true'; add.textContent='Add card'; add.addEventListener('click',() => openAdd(state,add)); container.append(manage,add);
    const reset = state.page.querySelector('#dwReset,[data-aw-action="reset"]'); reset?.addEventListener('click',() => { cardsOn(state.page).forEach(card => { const id=idFor(card), label=labelNode(card); if (label && state.originals.has(id)) label.textContent=state.originals.get(id); }); state.settings.cards={}; save(state); schedule(); });
    const help = state.page.querySelector('#dwHelp,.aw-toolbar p'); if (help) help.textContent='Drag a corner for any size. Customize sets exact pixels; Manage cards hides or restores cards; Add card creates a personal widget.';
  }
  function sync() {
    frame=0; const page=root.querySelector('.page.active'); if (!page) return;
    if (drag && drag.card.closest('.page') !== page) endResize(false);
    const state=stateFor(page); toolbar(state); createCustom(state); const cards=cardsOn(page); cards.forEach(apply); refreshCustom(state);
    const arrange=page.querySelector('[data-aw-action="arrange"]'); if (arrange && cards.length) arrange.disabled=false;
    charts.redraw();
  }
  function schedule() { if (!frame) frame=requestAnimationFrame(sync); }
  function applySize(card,width,height) { const state=stateFor(card.closest('.page')); state.settings.cards[idFor(card)]={...metaFor(card),width:dimension(width),height:dimension(height)}; apply(card); charts.redraw(); }
  function endResize(commit) {
    if (!drag) return;
    const current=drag; drag=null;
    if (current.handle.hasPointerCapture(current.id)) current.handle.releasePointerCapture(current.id);
    if (current.moving) {
      if (commit && current.target) {
        if (current.after) current.target.after(current.card); else current.target.before(current.card);
        const state=stateFor(current.card.closest('.page')), byId=new Map(state.settings.custom.map(item => [item.id,item]));
        state.settings.custom=[...current.card.parentElement.children].map(card => byId.get(card.dataset.csId)).filter(Boolean); save(state);
      }
      current.ghost?.remove(); current.target?.classList.remove('cs-drop');
    } else if (!commit) { stateFor(current.card.closest('.page')).settings.cards[idFor(current.card)]=current.before; apply(current.card); } else save(stateFor(current.card.closest('.page')));
    current.card.classList.remove('cs-resizing'); charts.redraw();
  }
  root.addEventListener('pointerdown',event => {
    const handle=event.target.closest('.aw-resize,.cs-handle'); if (!handle || !handle.closest('.aw-editing,.dw-editing') || event.button!==0) return;
    const card=handle.closest('.cs-card'); if (!card) return;
    event.preventDefault(); event.stopImmediatePropagation(); const rect=card.getBoundingClientRect();
    drag={id:event.pointerId,handle,card,x:event.clientX,y:event.clientY,width:rect.width,height:rect.height,before:{...metaFor(card)},moving:handle.matches('.cs-handle')}; handle.setPointerCapture(event.pointerId); handle.focus(); if (!drag.moving) card.classList.add('cs-resizing');
  },true);
  root.addEventListener('pointermove',event => {
    if (!drag || event.pointerId!==drag.id) return; event.preventDefault(); event.stopImmediatePropagation();
    if (drag.moving) {
      if (!drag.ghost && Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<6) return;
      if (!drag.ghost) { drag.ghost=document.createElement('div'); drag.ghost.className='dw-drag-label'; drag.ghost.textContent=labelFor(drag.card); document.body.appendChild(drag.ghost); }
      drag.ghost.style.left=Math.max(8,Math.min(innerWidth-240,event.clientX+14))+'px'; drag.ghost.style.top=Math.max(8,Math.min(innerHeight-50,event.clientY+12))+'px';
      drag.target?.classList.remove('cs-drop'); drag.target=null;
      const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('.cs-custom');
      if (target && target!==drag.card && target.parentElement===drag.card.parentElement) { drag.target=target; target.classList.add('cs-drop'); const rect=target.getBoundingClientRect(); drag.after=event.clientY>rect.top+rect.height*.6 || (event.clientY>rect.top+rect.height*.3 && event.clientX>rect.left+rect.width*.6); }
      return;
    }
    applySize(drag.card,Math.min(drag.card.parentElement.clientWidth,Math.max(96,drag.width+event.clientX-drag.x)),Math.max(96,drag.height+event.clientY-drag.y));
  },true);
  root.addEventListener('pointerup',event => { if (!drag || event.pointerId!==drag.id) return; event.stopImmediatePropagation(); endResize(true); },true);
  root.addEventListener('pointercancel',event => { if (drag) { event.stopImmediatePropagation(); endResize(false); } },true);
  root.addEventListener('keydown',event => {
    if (event.key==='Escape' && drag) { event.preventDefault(); event.stopImmediatePropagation(); endResize(false); return; }
    const handle=event.target.closest('.aw-resize,.cs-handle'); if (!handle || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
    if (handle.matches('.cs-handle')) { event.preventDefault(); event.stopImmediatePropagation(); handle.parentElement.querySelector('[aria-label="'+(['ArrowLeft','ArrowUp'].includes(event.key) ? 'Move earlier' : 'Move later')+'"]').click(); handle.focus(); return; }
    const card=handle.closest('.cs-card'); if (!card) return; event.preventDefault(); event.stopImmediatePropagation(); const rect=card.getBoundingClientRect(), step=event.shiftKey ? 1 : 10;
    applySize(card,rect.width+(event.key==='ArrowRight' ? step : event.key==='ArrowLeft' ? -step : 0),rect.height+(event.key==='ArrowDown' ? step : event.key==='ArrowUp' ? -step : 0)); save(stateFor(card.closest('.page')));
  },true);
  root.addEventListener('change',event => {
    if (event.target.matches('.dw-size,[data-aw-width],[data-aw-height]')) { const card=event.target.closest('.cs-card'); if (card) { const state=stateFor(card.closest('.page')), meta={...metaFor(card)}; if (event.target.matches('[data-aw-height]')) delete meta.height; else { delete meta.width; if (event.target.matches('[data-aw-width]')) delete meta.height; } state.settings.cards[idFor(card)]=meta; apply(card); save(state); } }
    schedule();
  });
  root.addEventListener('click',schedule); root.addEventListener('input',schedule);
  new MutationObserver(records => { if (records.some(record => record.type==='attributes' ? record.target.matches('.page') : !record.target.closest('.cs-custom,.cs-overlay,.dw-chart-wrap,.dw-legend,.dw-chart-data,.cs-controls'))) schedule(); }).observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('resize',schedule,{passive:true}); window.addEventListener('blur',() => endResize(false)); document.addEventListener('visibilitychange',() => { if (document.hidden) endResize(false); });
  window.OzylixCardStudio={chartKind(canvas,kind) { if (!['bar','area','hbar','line'].includes(kind)) return kind; const card=canvas.closest('.cs-card'); const chosen=card && metaFor(card).chartStyle; return ['bar','area','line'].includes(chosen) ? chosen : kind; }};
  schedule();
})();
