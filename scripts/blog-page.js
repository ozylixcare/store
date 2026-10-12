// Blog content and rendering load only when requested.
(()=>{
const BLOGS = [
  // ── Category 1: Skin & Glow ──
  { id:1,  tag:"Skin Glow",
    title:"The 30-Day Glutathione Glow: What to Expect Week-by-Week",
    excerpt:"A science-backed timeline of results from Ozylix's 650mg L-Glutathione with L-Cysteine and Astaxanthin — week by week, from first fizz to visible skin brightening.",
    img:"https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=600&q=80",
    date:"Jan 15, 2026", readTime:"6 min read", author:"Dr. Ananya Gupta",
    relatedProduct:1 },

  { id:2,  tag:"Hyperpigmentation",
    title:"Why Your Face Serum Isn't Working: The Internal Approach to Hyperpigmentation",
    excerpt:"Topical creams treat the surface. Glutathione with Vitamin C tackles melanin synthesis from within — here's why internal supplementation changes everything.",
    img:"https://images.unsplash.com/photo-1552693673-1bf958298935?w=600&q=80",
    date:"Jan 22, 2026", readTime:"7 min read", author:"Dr. Kavita Sharma",
    relatedProduct:1 },

  { id:3,  tag:"Effervescent Science",
    title:"Effervescent vs. Capsules: Why 'Fizzy' Glutathione Absorbs 3x Faster",
    excerpt:"Bioavailability research explains why Ozylix's effervescent format reaches your bloodstream 3× faster than traditional capsules or softgels.",
    img:"https://images.unsplash.com/photo-1587854680352-936b22b91030?w=600&q=80",
    date:"Feb 1, 2026", readTime:"6 min read", author:"Dr. Sanjay Mehta",
    relatedProduct:1 },

  { id:4,  tag:"Bridal Wellness",
    title:"The Ultimate Bridal Supplement Routine: 3 Months to Radiant Wedding Skin",
    excerpt:"India's wedding season demands glowing skin. A 12-week supplement stack — Glutathione, B12+Biotin, and Vitamin C — for brides across Gujarat and beyond.",
    img:"https://images.unsplash.com/photo-1519741497674-611481863552?w=600&q=80",
    date:"Feb 10, 2026", readTime:"8 min read", author:"Dr. Kavita Sharma",
    relatedProduct:4 },

  { id:5,  tag:"Anti-Pollution",
    title:"Pollution vs. Skin: How Antioxidants Shield Urban Indian Skin",
    excerpt:"Delhi, Mumbai, Bangalore — pollution accelerates skin ageing by 10 years. Astaxanthin and Glutathione form a protective antioxidant shield against smog damage.",
    img:"https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=600&q=80",
    date:"Feb 18, 2026", readTime:"5 min read", author:"Dr. Ananya Gupta",
    relatedProduct:1 },

  // ── Category 2: Superfoods & Superpowers ──
  { id:6,  tag:"Superfood Guide",
    title:"Spirulina vs. Moringa: Which 'Green Superfood' Does Your Body Need More?",
    excerpt:"Both are nutritional powerhouses — but Spirulina leads on protein and B12 while Moringa wins on iron and antioxidants. A complete comparison to help you choose.",
    img:"https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600&q=80",
    date:"Mar 1, 2026", readTime:"7 min read", author:"Nutritionist Priya Rao",
    relatedProduct:10 },

  { id:7,  tag:"Vegan Nutrition",
    title:"The Vegan B12 Crisis in India: How Spirulina Bridges the Nutritional Gap",
    excerpt:"Over 47% of Indian vegetarians are B12 deficient. Ozylix's Certified Organic Spirulina with D3 is the plant-based answer — no animal products, full absorption.",
    img:"https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&q=80",
    date:"Mar 8, 2026", readTime:"6 min read", author:"Dr. Sanjay Mehta",
    relatedProduct:10 },

  { id:8,  tag:"Hair Growth",
    title:"Moringa for Hair Growth: The 'Miracle Tree' Secret to Thicker Hair",
    excerpt:"Moringa contains sulphur-rich amino acids that directly feed hair follicles. Combined with Biotin in effervescent form — results come faster than you'd expect.",
    img:"https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80",
    date:"Mar 15, 2026", readTime:"6 min read", author:"Nutritionist Meera Iyer",
    relatedProduct:4 },

  { id:9,  tag:"Fitness Recovery",
    title:"Post-Workout Recovery: Why Spirulina is the Natural Alternative to Synthetic BCAAs",
    excerpt:"Spirulina contains all essential amino acids, phycocyanin, and iron. For plant-based athletes, Ozylix's VitaPlus Spirulina is the clean recovery choice.",
    img:"https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&q=80",
    date:"Mar 22, 2026", readTime:"7 min read", author:"Fitness Expert Rohit Shah",
    relatedProduct:10 },

  { id:10, tag:"Weight Management",
    title:"Ancient Wisdom, Modern Format: Why We Combined ACV with Moringa",
    excerpt:"Apple Cider Vinegar with Garcinia Cambogia and Moringa Leaf Extract — the story behind Ozylix's Green Apple effervescent and why it outperforms plain ACV.",
    img:"https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=600&q=80",
    date:"Mar 29, 2026", readTime:"7 min read", author:"Nutritionist Priya Rao",
    relatedProduct:2 },

  // ── Category 3: Urban Wellness & Lifestyle ──
  { id:11, tag:"Productivity",
    title:"The 'Sluggish Morning' Fix: A Supplement Routine for High-Performance Professionals",
    excerpt:"Corporate India runs on caffeine. Here's a smarter morning stack — L-Carnitine, Vitamin C+Moringa, and B12+Biotin — that delivers sustainable all-day energy.",
    img:"https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=600&q=80",
    date:"Apr 5, 2026", readTime:"6 min read", author:"Wellness Expert Rahul Verma",
    relatedProduct:3 },

  { id:12, tag:"Eye Health",
    title:"Screen Time & Eye Strain: Can Superfoods Save Your Vision in 2026?",
    excerpt:"The average Indian professional spends 11+ hours on screens. Astaxanthin and Spirulina's zeaxanthin protect the macula from blue light damage.",
    img:"https://images.unsplash.com/photo-1542751371-adc38448a05e?w=600&q=80",
    date:"Apr 12, 2026", readTime:"5 min read", author:"Dr. Sanjay Mehta",
    relatedProduct:10 },

  { id:13, tag:"Metabolic Health",
    title:"Metabolic Flexibility: How Apple Cider Vinegar Effervescent Prevents 3 PM Brain Fog",
    excerpt:"Post-lunch blood sugar crashes cause 3 PM brain fog. ACV with Moringa and B-vitamins stabilises glucose metabolism and keeps cognition sharp all afternoon.",
    img:"https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600&q=80",
    date:"Apr 19, 2026", readTime:"6 min read", author:"Nutritionist Priya Rao",
    relatedProduct:2 },

  { id:14, tag:"Deficiency Alert",
    title:"The Silent Epidemic: Why 70% of Indians Are Vitamin D & B12 Deficient",
    excerpt:"You can live in a sunny country and still be severely deficient. This is why urban Indians need targeted daily supplementation — and which Ozylix products help most.",
    img:"https://images.unsplash.com/photo-1559757175-0eb30cd8c063?w=600&q=80",
    date:"Apr 26, 2026", readTime:"8 min read", author:"Dr. Kavita Sharma",
    relatedProduct:8 },

  { id:15, tag:"Gut-Skin Axis",
    title:"Gut-Skin Axis: Why Your Digestion Is the Key to Clear Skin",
    excerpt:"Leaky gut triggers systemic inflammation that shows up on your face. Moringa, ACV and zinc-rich effervescents repair the gut lining from within.",
    img:"https://images.unsplash.com/photo-1551601651-2a8555f1a136?w=600&q=80",
    date:"May 3, 2026", readTime:"7 min read", author:"Dr. Ananya Gupta",
    relatedProduct:2 },

  // ── Category 4: B2B & Manufacturing ──
  { id:16, tag:"Gujarat Manufacturing",
    title:"Anand: Why India's 'Milk Capital' Is Becoming the Global Hub for Nutraceuticals",
    excerpt:"Ozylix's FSSAI approved plant in Anand, Gujarat sits at the centre of India's emerging nutraceutical corridor — here's why it matters for global quality.",
    img:"https://images.unsplash.com/photo-1581092921461-39b392021a78?w=600&q=80",
    date:"May 10, 2026", readTime:"6 min read", author:"Ozylix Team" },

  { id:17, tag:"Private Label",
    title:"How to Start Your Own Supplement Brand in India: A Step-by-Step Guide to Private Labeling",
    excerpt:"From FSSAI registration to formulation, packaging and launch — Ozylix's B2B arm handles everything for aspiring supplement entrepreneurs across India.",
    img:"https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&q=80",
    date:"May 17, 2026", readTime:"9 min read", author:"Ozylix B2B Team" },

  { id:18, tag:"Manufacturing Science",
    title:"The Science of Solubility: What Goes into Making a World-Class Effervescent Tablet?",
    excerpt:"pH balance, CO₂ release rate, citric acid ratios and coating technology — an inside look at how Ozylix's FSSAI approved plant formulates effervescents that actually work.",
    img:"https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=600&q=80",
    date:"May 24, 2026", readTime:"7 min read", author:"Dr. Sanjay Mehta" },

  { id:19, tag:"Global Exports",
    title:"Exporting Health: Why Indian Supplements Are Taking Over Global Markets in 2026",
    excerpt:"India's nutraceutical exports crossed $6 billion in 2025. FSSAI licensed manufacturers from Gujarat are leading the charge — and Ozylix is part of that story.",
    img:"https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=600&q=80",
    date:"May 28, 2026", readTime:"6 min read", author:"Ozylix Team" },

  { id:20, tag:"Sustainability",
    title:"Sustainable Supplementation: How Ozylix Supports Local Farmers in Gujarat",
    excerpt:"Ozylix's Moringa and Spirulina are ethically sourced from certified farms across Gujarat. Here's our commitment to sustainable, local, and traceable nutrition.",
    img:"https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&q=80",
    date:"Jun 4, 2026", readTime:"5 min read", author:"Ozylix Team" },
  // ── Category 5: Ozylix Company & Customer Journey ──
  { id:21, tag:"Factory to Home", slug:"from-ozylix-factory-to-your-home",
    title:"From the Ozylix Factory to Your Home",
    excerpt:"Discover Ozylix’s direct-to-consumer factory-to-home story, including product information, ordering, delivery, and customer support.",
    img:"/assets/blog/ozylix-factory-to-home.webp", alt:"Ozylix effervescent supplement tubes representing the brand’s factory-to-home model",
    date:"Aug 15, 2026", readTime:"5 min read", author:"Ozylix Editorial Team",
    metaTitle:"From the Ozylix Factory to Your Home | Ozylix",
    metaDescription:"Learn how Ozylix presents its Indian supplement range through a direct factory-to-home shopping model.",
    bodyHtml:`
      <p>When people search for a wellness brand, they want to know where a product comes from, how it reaches them, how they can contact the company, and whether the brand explains its purpose clearly. Ozylix presents a direct-to-consumer supplement experience built around its own factory-to-home story: products are introduced through the Ozylix storefront and delivered through the company’s online ordering journey.</p>
      <p>Ozylix’s public catalogue includes effervescent vitamins, spirulina products, moringa products, and other nutraceutical formats. The factory-to-home message gives that catalogue a clear customer journey: discover a product, read its information, place an order, and receive it through Ozylix’s support and delivery process.</p>
      <h3>What “factory to home” means</h3>
      <p>“Factory to home” describes Ozylix’s intended direct customer journey, not a promise about every delivery route or order. The company’s public information presents an Indian manufacturing story and a direct online storefront. Customers should still read the product label, order confirmation, shipping policy, and support information for the details that apply to their purchase.</p>
      <p>A company story is only one part of a purchasing decision. Readers should also check the product name, serving instructions, ingredient list, allergen information, storage guidance, batch or lot information, and the contact details printed on the packaging. People who take medicines, are pregnant or breastfeeding, have a medical condition, or are preparing for a procedure should discuss supplement use with a qualified healthcare professional.</p>
      <p>Explore the <a href="/about">Ozylix About page</a>, browse the <a href="/shop">current product range</a>, review the <a href="/faq">FAQs</a>, or <a href="/contact">contact the team</a> with a product or order question.</p>
      <p><strong>Important:</strong> Dietary supplements are not a substitute for professional medical advice. Always follow the product label and current website terms.</p>` },

  { id:22, tag:"Gujarat Manufacturing", slug:"ozylix-supplement-manufacturing-anand-gujarat",
    title:"Made in Anand, Gujarat: How Ozylix Approaches Supplement Manufacturing",
    excerpt:"Explore Ozylix’s public manufacturing story in Anand, Gujarat, its factory-to-home model, and the importance of clear product information.",
    img:"/assets/blog/ozylix-quality-you-can-trust.webp", alt:"Ozylix supplement tube displayed with an Anand, Gujarat manufacturing story",
    date:"Aug 15, 2026", readTime:"6 min read", author:"Ozylix Editorial Team",
    metaTitle:"Made in Anand, Gujarat: Ozylix Supplement Manufacturing",
    metaDescription:"Explore Ozylix’s public manufacturing story in Anand, Gujarat, including its factory-to-home model and clear product information.",
    bodyHtml:`
      <p>Anand, Gujarat is part of Ozylix’s public identity. The brand’s website presents Ozylix as a direct-to-consumer wellness brand and identifies Anand as the location associated with its manufacturing story. For customers, the location matters because origin is one of the first questions people ask when they compare supplement brands online.</p>
      <p>A manufacturing story is most valuable when it goes beyond a photograph or a slogan. It should explain the relationship between the facility, product format, quality checks, packaging, and customer support, while distinguishing what is verified from what is aspirational. Ozylix can build trust by keeping that explanation specific and current.</p>
      <h3>From location to process</h3>
      <p>“Made in India” gives a product an origin, but it does not by itself explain how a product was formulated, tested, packed, stored, or shipped. Customers should use the product page and packaging to review ingredients, serving information, warnings, storage instructions, and other details relevant to the specific product.</p>
      <p>Effervescent products are designed to be dissolved in water before consumption. That creates practical questions about moisture protection, tube closure, serving instructions, and storage. The most useful manufacturing communication answers those questions using the product label rather than making broad statements about absorption or guaranteed results.</p>
      <h3>A quality story is a documentation story</h3>
      <p>Ozylix’s public site uses phrases such as FSSAI licensed, lab tested, and third-party tested in its company narrative. Those phrases should always be read together with the exact licence or testing documentation and the scope of the claim. A facility approval is not the same as approval of a medical treatment, and a supplement should not be presented as preventing, treating, or curing a disease.</p>
      <p>Visit the <a href="/about">About page</a> for company information, use the <a href="/shop">Shop</a> for current availability, or <a href="/contact">contact Ozylix</a> with manufacturing or product questions.</p>
      <p><strong>Important:</strong> Consumers who take medicines or have health concerns should speak with a healthcare professional before using a new supplement.</p>` },

  { id:23, tag:"Effervescent Guide", slug:"how-to-choose-effervescent-vitamins-india",
    title:"How to Choose an Effervescent Vitamin Supplement in India",
    excerpt:"A practical checklist for comparing effervescent vitamin supplements in India, from labels and storage to company transparency and support.",
    img:"/assets/blog/ozylix-grand-launch-effervescent-vitamins.webp", alt:"Ozylix effervescent vitamin tubes shown in a product-format guide",
    date:"Aug 15, 2026", readTime:"6 min read", author:"Ozylix Editorial Team",
    metaTitle:"How to Choose Effervescent Vitamin Supplements in India | Ozylix",
    metaDescription:"Use this practical checklist to compare effervescent vitamin supplements in India, including labels, storage, support, and product information.",
    bodyHtml:`
      <p>Effervescent supplements are designed to be dissolved in water before they are consumed. The format can be convenient for people who prefer a drinkable routine, but convenience should not replace careful product selection. Before buying an effervescent vitamin supplement in India, compare the label, company information, instructions, storage requirements, and support available after purchase.</p>
      <h3>Start with the product label</h3>
      <p>The label is the most important source of information for a specific supplement. Check the product name, serving size, ingredient list, quantity per tube or pack, directions for use, storage instructions, warnings, manufacturer or marketer details, and batch information. If a product is intended to be dissolved in water, follow the stated volume and preparation instructions.</p>
      <p>A company webpage can provide context, but it should not contradict the packaging. If the online description and label differ, contact the company before using the product. Product information, safety, quality, and possible interactions are important considerations when evaluating a dietary supplement.</p>
      <h3>Look for a clear company identity</h3>
      <p>A supplement brand should make it reasonably easy to identify who is responsible for the product and how customers can ask questions. Ozylix provides public routes for shopping, FAQs, and customer contact. That information is a useful starting point for checking whether the company explains its products and policies consistently.</p>
      <h3>Do not choose by exaggerated promises</h3>
      <p>Words such as “instant,” “miracle,” “guaranteed,” “cures,” or “works for everyone” should prompt caution. Dissolving a product in water does not by itself prove a particular absorption speed or outcome. A better approach is to ask whether the format fits your routine, whether you can store the tube as directed, and whether the ingredients are appropriate for you.</p>
      <p>Browse the <a href="/shop">Ozylix effervescent range</a>, read the <a href="/faq">FAQs</a>, and <a href="/contact">contact the company</a> if you need help understanding a product label.</p>
      <p><strong>Important:</strong> Supplements are not a substitute for diagnosis, medication, a balanced diet, sleep, or professional care.</p>` },

  { id:24, tag:"Product Range", slug:"ozylix-effervescent-vitamins-spirulina-wellness-range",
    title:"Inside the Ozylix Range: Effervescent Vitamins, Spirulina and Everyday Wellness",
    excerpt:"A clear guide to exploring the Ozylix range, including effervescent formats, spirulina, moringa, and label-first product selection.",
    img:"/assets/blog/ozylix-quality-you-can-trust.webp", alt:"Ozylix product tube illustrating the company’s quality and product-range story",
    date:"Aug 15, 2026", readTime:"6 min read", author:"Ozylix Editorial Team",
    metaTitle:"Inside the Ozylix Range: Effervescent Vitamins and Spirulina",
    metaDescription:"Explore the Ozylix range of effervescent vitamins, spirulina, moringa, and other wellness formats with a practical label-first guide.",
    bodyHtml:`
      <p>People shop for supplements for different reasons: some prefer an effervescent drink, some look for a plant-based format, and others want to compare a particular ingredient or serving routine. Ozylix presents a range that includes effervescent vitamins, spirulina products, moringa products, and other nutraceutical formats. The exact formula and suitability of each product depend on its individual label.</p>
      <h3>Effervescent formats</h3>
      <p>Effervescent products are dissolved in water before consumption. This can make the routine feel different from swallowing a conventional tablet or capsule. Follow the product’s directions for the amount of water, serving frequency, storage, and use after opening.</p>
      <h3>Plant-based formats</h3>
      <p>Spirulina and moringa are plant-based ingredients that appear in parts of the Ozylix range. Category language is not a substitute for checking the full ingredient list, allergen information, serving details, or dietary suitability of a particular product. Customers following a strict dietary pattern should check the label and contact the company when needed.</p>
      <h3>Choose by information, not promises</h3>
      <p>The most useful question is not “Which product is best for everyone?” It is “Which product information matches my needs, routine, and professional guidance?” Read the label, compare the current product page, and avoid claims that promise guaranteed transformation or disease treatment.</p>
      <p>Use the <a href="/shop">Ozylix Shop</a> for current availability, learn more on the <a href="/about">About page</a>, and review the <a href="/faq">FAQs</a> before ordering.</p>
      <p><strong>Important:</strong> People who take medicines, are pregnant or breastfeeding, or have a medical condition should seek professional advice before using a new supplement.</p>` },

  { id:25, tag:"Customer Support", slug:"shopping-direct-from-ozylix-delivery-vita-points-support",
    title:"Shopping Direct from Ozylix: Delivery, Vita Points and Customer Support",
    excerpt:"What to check when shopping direct from Ozylix, from product information and delivery terms to Vita Points and support.",
    img:"/assets/blog/ozylix-vita-points-rewards.webp", alt:"Ozylix Vita Points rewards visual with an effervescent supplement tube",
    date:"Aug 15, 2026", readTime:"5 min read", author:"Ozylix Editorial Team",
    metaTitle:"Shopping Direct from Ozylix: Delivery, Vita Points and Support",
    metaDescription:"Learn what to check when shopping direct from Ozylix, including product information, delivery terms, Vita Points, and customer support.",
    bodyHtml:`
      <p>Shopping direct from a brand is easiest when the company identity, product information, ordering flow, delivery terms, and support route are easy to find. Ozylix’s customer journey is designed around moving from the company’s factory-to-home story to an online storefront where customers can review products and place orders.</p>
      <h3>Check the product before ordering</h3>
      <p>Start with the product page and packaging information. Review the ingredient list, serving size, directions, warnings, storage guidance, pack quantity, price, and any terms that apply to the product or promotion. If you have a health condition or take medicines, speak with a healthcare professional before using a new supplement.</p>
      <h3>Review delivery and returns</h3>
      <p>Delivery promises and return terms can change, so use the current Ozylix website and order confirmation as the source of truth. Check the delivery address, dispatch information, estimated arrival, and return or replacement conditions before completing an order. If a shipment arrives damaged or incorrect, contact the company with the order details and photographs where appropriate.</p>
      <h3>How Vita Points fit into the customer journey</h3>
      <p>Ozylix presents Vita Points as a customer rewards programme in its public campaign material. Customers should review the current programme terms for how points are earned, when they become available, how they can be redeemed, and whether exclusions or expiry rules apply.</p>
      <p>Visit the <a href="/shop">Shop</a> to view current products, read the <a href="/faq">FAQs</a> for common ordering questions, or use the <a href="/contact">Contact page</a> when you need assistance.</p>
      <p><strong>Important:</strong> Product, price, delivery, loyalty, and return terms are subject to the current website and order confirmation.</p>` }

];



const BLOGS_NEWEST_FIRST = BLOGS.slice().sort(function(a,b){ return new Date(b.date).getTime()-new Date(a.date).getTime(); });

function renderBlogCard(b) {
  const shopBtn = b.relatedProduct
    ? `<div style="margin-top:12px">
        <button onclick="event.preventDefault();event.stopPropagation();openProduct(${b.relatedProduct})"
          style="background:var(--face-warm);color:var(--clay-lo);box-shadow:inset 0 0 0 1.5px rgba(138,74,51,.32);border:none;border-radius:8px;padding:7px 16px;font-size:0.76rem;font-weight:700;cursor:pointer;letter-spacing:0.3px">
          🛒 Shop This Product →
        </button>
       </div>`
    : '';
  return `<a class="blog-card" href="#blog-${b.id}" onclick="openBlog(${b.id});return false" aria-label="Read: ${b.title}">
    <img class="blog-img" data-src="${b.img}" alt="${b.alt || b.title}" loading="lazy"
      onerror="this.src=PRODUCT_FALLBACKS.default" decoding="async">
    <div class="blog-body">
      <span class="blog-tag">${b.tag}</span>
      <h3 class="blog-title">${b.title}</h3>
      <p class="blog-exc">${b.excerpt}</p>
      <div class="blog-meta"><span>📅 ${b.date}</span><span>⏱ ${b.readTime}</span><span>✍ ${b.author}</span></div>
      ${shopBtn}
    </div>
  </a>`;
}
function renderFullBlog() { const el=document.getElementById('fullBlogGrid'); if(el) el.innerHTML=BLOGS_NEWEST_FIRST.map(renderBlogCard).join(''); hydrateBlogImgs(); }
// v10.2: blog tile images hydrate just before entering view, so a stalled
// image host can never hold the load event hostage. Pattern mirrors the promo
// marquee (6b6c50b). Any tiles still unhydrated after 6s load anyway.
function hydrateBlogImgs() {
  var pending = document.querySelectorAll('img.blog-img[data-src]');
  if (!pending.length) return;
  function hydrate(img) { if (img && img.dataset.src) { img.src = img.dataset.src; img.removeAttribute('data-src'); } }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) { if (entry.isIntersecting) { hydrate(entry.target); io.unobserve(entry.target); } });
    }, { rootMargin: '600px 0px 600px 0px' });
    pending.forEach(function(img) { io.observe(img); });
    setTimeout(function() { pending.forEach(hydrate); }, 6000);
  } else { pending.forEach(hydrate); }
}

// ── FAQ ──

// Extracted from index.html (line 24602) by Manus SEO pass — load order preserved

function openBlog(id) {
  const b = BLOGS.find(x => x.id === id);
  if (!b) return;
  const ov = document.getElementById('blogOverlay');
  const rd = document.getElementById('blogReader');
  const bodyHtml = b.bodyHtml || (b.body
    ? b.body.split(/\.(?=\s[A-Z])/).map(s => s.trim()).filter(Boolean).map(s => '<p>' + s + '</p>').join('')
    : '<p>' + b.excerpt + '</p>');
  const shopBtn = b.relatedProduct
    ? '<div style="margin-top:24px"><button class="btn-primary" onclick="closeBlog();openProduct(' + b.relatedProduct + ')">Shop This Product &rarr;</button></div>'
    : '';
  rd.innerHTML = '<button class="br-close" onclick="closeBlog()" aria-label="Close article">&times;</button>'
    + '<img class="br-img" src="' + b.img + '" alt="' + (b.alt || b.title) + '" loading="lazy" decoding="async">'
    + '<span class="br-tag">' + b.tag + '</span>'
    + '<h2>' + b.title + '</h2>'
    + '<div class="br-meta">' + b.date + ' &middot; ' + b.readTime + ' &middot; ' + b.author + '</div>'
    + '<div class="br-body">' + bodyHtml + '</div>'
    + shopBtn;
  const blogSlug = b.slug || slugify(b.title);
  document.title = (b.metaTitle || b.title) + ' | Ozylix';
  const blogDescription = document.querySelector('meta[name="description"]');
  if (blogDescription) blogDescription.setAttribute('content', b.metaDescription || b.excerpt);
  const blogCanonical = document.querySelector('link[rel="canonical"]');
  if (blogCanonical) blogCanonical.setAttribute('href', 'https://www.ozylix.com/blog/' + blogSlug);
  const blogOgTitle = document.querySelector('meta[property="og:title"]');
  if (blogOgTitle) blogOgTitle.setAttribute('content', b.metaTitle || b.title);
  const blogOgDescription = document.querySelector('meta[property="og:description"]');
  if (blogOgDescription) blogOgDescription.setAttribute('content', b.metaDescription || b.excerpt);
  const blogOgUrl = document.querySelector('meta[property="og:url"]');
  if (blogOgUrl) blogOgUrl.setAttribute('content', 'https://www.ozylix.com/blog/' + blogSlug);
  const blogOgImage = document.querySelector('meta[property="og:image"]');
  if (blogOgImage) blogOgImage.setAttribute('content', /^https?:/.test(b.img) ? b.img : 'https://www.ozylix.com' + b.img);
  let blogSchema = document.getElementById('blog-article-schema');
  if (!blogSchema) { blogSchema = document.createElement('script'); blogSchema.id = 'blog-article-schema'; blogSchema.type = 'application/ld+json'; document.head.appendChild(blogSchema); }
  blogSchema.textContent = JSON.stringify({
    '@context':'https://schema.org', '@type':'Article', headline:b.title, description:b.metaDescription || b.excerpt,
    image:[/^https?:/.test(b.img) ? b.img : 'https://www.ozylix.com' + b.img], datePublished:new Date(b.date).toISOString().split('T')[0], dateModified:new Date(b.date).toISOString().split('T')[0], author:{'@type':'Organization',name:b.author}, publisher:{'@type':'Organization',name:'Ozylix',url:'https://www.ozylix.com/'}, mainEntityOfPage:{'@type':'WebPage','@id':'https://www.ozylix.com/blog/' + blogSlug}
  });
  ov.style.display = 'block';
  try { history.pushState({ page:'blog', id:id }, '', '/blog/' + blogSlug); } catch(e) { window.location.hash = 'blog-' + id; }
}
// ── /blog/<slug> deep links ─────────────────────────────────────────────
// Google can only link to an article it discovered, and it indexes the
// clean path /blog/<slugified-title>, never the #blog-N hash. On arrival
// the init code calls this to open the matching entry by slugified title.
function openBlogBySlug(slug) {
  if (!slug || typeof BLOGS === 'undefined') return;
  const wanted = slugify(decodeURIComponent(slug));
  const b = BLOGS.find(x => (x.slug && slugify(x.slug) === wanted) || slugify(x.title) === wanted || slugify(x.id + '') === wanted);
  if (b) openBlog(b.id);
}

function closeBlog() {
  const ov = document.getElementById('blogOverlay');
  if (ov) ov.style.display = 'none';
  if (location.pathname.startsWith('/blog/')) {
    try { history.replaceState(null, '', '/blog'); } catch(e) {}
  } else if (location.hash && location.hash.startsWith('#blog-')) {
    try { history.replaceState(null, '', location.pathname + location.search); } catch(e) {}
  }
}


window.OzylixBlogPage = {renderFullBlog,openBlog,openBlogBySlug,closeBlog};
})();
