/* Enhance the existing native FAQ without changing answers or structured data. */
(function(){
'use strict';
function enhance(){
  const el=document.getElementById('fullFaqWrap');if(!el)return;
  const header=document.querySelector('#page-faq .page-header');
  if(header)header.innerHTML='<span class="faq-eyebrow">OZYLIX HELP CENTRE</span><h1>A little clarity.<br><em>A better daily routine.</em></h1><p>From choosing your supplement to tracking your order.<br>Find straightforward answers to the things that matter.</p>';

  const container=el.parentElement;
  container.classList.add('faq-layout');
  if(!container.querySelector('.faq-sidebar'))container.insertAdjacentHTML('afterbegin', "<aside class=\"faq-sidebar\"><p class=\"faq-eyebrow\">BROWSE BY TOPIC</p><nav aria-label=\"FAQ topics\"><a href=\"#faq-topic-0\"><span>About Ozylix</span><span class=\"faq-topic-count\">04</span></a><a href=\"#faq-topic-1\"><span>Choosing and using products</span><span class=\"faq-topic-count\">09</span></a><a href=\"#faq-topic-2\"><span>Ordering and delivery</span><span class=\"faq-topic-count\">07</span></a><a href=\"#faq-topic-3\"><span>Offers and VitaPoints</span><span class=\"faq-topic-count\">05</span></a><a href=\"#faq-topic-4\"><span>Returns and support</span><span class=\"faq-topic-count\">05</span></a></nav><div class=\"faq-help-card\"><span class=\"faq-help-mark\" aria-hidden=\"true\">\u2197</span><h2>Still need a hand?</h2><p>Our team can help with products, orders and delivery.</p><a href=\"mailto:hi@ozylix.com\">Email Ozylix <span aria-hidden=\"true\">\u2192</span></a></div></aside>");
  if(!container.querySelector('.faq-search'))el.insertAdjacentHTML('beforebegin', "<div class=\"faq-search\"><label for=\"faqSearchInput\">Find your answer</label><div class=\"faq-search-field\"><span aria-hidden=\"true\">\u2315</span><input id=\"faqSearchInput\" type=\"search\" placeholder=\"Try delivery, VitaPoints or ingredients\" autocomplete=\"off\" aria-controls=\"fullFaqWrap\"></div><p id=\"faqSearchStatus\" role=\"status\" aria-live=\"polite\">30 answers, all in one place.</p></div>");
  const input=container.querySelector('#faqSearchInput');
  input.value='';
  input.oninput=function(){
    const query=this.value.trim().toLowerCase();let count=0;
    el.querySelectorAll('.faq-topic').forEach(topic=>{
      let matches=0;
      topic.querySelectorAll('details').forEach(detail=>{const match=!query||detail.textContent.toLowerCase().includes(query);detail.hidden=!match;if(match){matches++;count++;}detail.open=!!query&&match;});
      topic.hidden=!matches;
    });
    container.querySelector('#faqSearchStatus').textContent=query?(count?count+' matching '+(count===1?'answer':'answers')+'.':'No matching answers. Try another word or email our team.'):'30 answers, all in one place.';
  };
  container.querySelectorAll('.faq-sidebar nav a').forEach(link=>{link.onclick=function(event){event.preventDefault();input.value='';input.oninput();const target=document.getElementById(this.getAttribute('href').slice(1));target?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});container.querySelectorAll('.faq-sidebar nav a').forEach(a=>a.classList.toggle('is-active',a===this));};});


}
const original=window.renderFullFaq;
if(typeof original==='function'){window.renderFullFaq=function(){const result=original.apply(this,arguments);enhance();return result;};}
enhance();
})();
