const ORIGIN = 'https://www.ozylix.com';
const pages = {
  '/': ['Effervescent Vitamins & Supplements Online India | Ozylix', 'Shop Ozylix effervescent vitamins, spirulina supplements and multivitamins. Explore ingredients and pack options; delivery availability and charges are confirmed at checkout.'],
  '/shop': ['Shop Effervescent Vitamins & Supplements | Ozylix', 'Browse Ozylix effervescent vitamins, spirulina supplements and multivitamins. Compare ingredients, pack sizes and current product availability.'],
  '/about': ['About Ozylix | Supplement Brand from Anand, Gujarat', 'Meet Ozylix, a supplement brand based in Anand, Gujarat. Learn about our team, products and approach to daily nutrition.'],
  '/contact': ['Contact Ozylix | Customer Support', 'Contact Ozylix for product questions, order support and business enquiries. Find our support details and contact options.'],
  '/faq': ['Ozylix FAQs | Products, Orders & Delivery', 'Find answers to common questions about Ozylix supplements, ordering, delivery and customer support.'],
  '/advisor': ['Supplement Advisor | Explore Ozylix Products', 'Explore the Ozylix supplement range with our product advisor. Review ingredients and product details before choosing your daily nutrition products.'],
  '/blog': ['Ozylix Journal | Supplements & Brand Stories', 'Read the Ozylix journal for product guides, supplement format comparisons and stories about our brand and manufacturing.'],
};
const products = {
  'multidiata-ozylix-premium-multivitamin': 'Multidiata Multivitamin',
  'green-tea-effervescent-tablet': 'Green Tea Effervescent Tablets',
  'ashwagandha-effervescent-tablet': 'Ashwagandha Effervescent Tablets',
  'men-s-multivitamin-effervescent-tablet': "Men’s Multivitamin Effervescent Tablets",
  'women-s-multivitamin-effervescent-tablet': "Women’s Multivitamin Effervescent Tablets",
  'apple-cider-vinegar-effervescent-tablet': 'Apple Cider Vinegar Effervescent Tablets',
  'complete-bone-health-effervescent-tablet': 'Complete Bone Health Effervescent Tablets',
  'rehydration-effervescent-tablet': 'Rehydration Effervescent Tablets',
  'natural-vitamin-c-amla-effervescent-tablet': 'Vitamin C + Amla Effervescent Tablets',
  'glutathione-effervescent-tablet': 'Glutathione Effervescent Tablets',
  'l-carnitine-l-tartrate-effervescent-tablet': 'L-Carnitine L-Tartrate Effervescent Tablets',
  'vitaplus-b12-d3-vegan-with-certified-organic-spirulina': 'VitaPlus B12 + D3 Spirulina Tablets',
  'mg-magnesium-b12-d3-with-magnesium': 'MG Magnesium + B12 + D3 Tablets',
  'cs-iron-calcium-iron-with-b12-d3': 'CS Calcium + Iron + B12 + D3 Tablets',
  'moringa-tablets': 'Moringa Tablets',
  'power-pro-tablets': 'Power Pro Tablets',
};
for (const [slug, name] of Object.entries(products)) {
  pages['/product/' + slug] = [name + ' | Ozylix', 'Explore Ozylix ' + name + '. Review ingredients, directions, pack options and current pricing. Delivery availability and charges are confirmed at checkout.'];
}
const articles = {
  'from-ozylix-factory-to-your-home': 'From the Ozylix Factory to Your Home',
  'ozylix-supplement-manufacturing-anand-gujarat': 'Ozylix Supplement Manufacturing in Anand, Gujarat',
  'how-to-choose-effervescent-vitamins-india': 'How to Choose Effervescent Vitamins in India',
  'ozylix-effervescent-vitamins-spirulina-wellness-range': 'Explore the Ozylix Effervescent & Spirulina Range',
  'shopping-direct-from-ozylix-delivery-vita-points-support': 'Shopping Direct from Ozylix: Delivery, Vita Points & Support',
};
for (const [slug, title] of Object.entries(articles)) {
  pages['/blog/' + slug] = [title + ' | Ozylix Journal', title + '. Read the Ozylix journal for product information, brand stories and practical shopping guidance.'];
}

export function pageSeo(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  const data = pages[path];
  return data ? { title: data[0], description: data[1], canonical: ORIGIN + (path === '/' ? '/' : path) } : null;
}

export function brandGraph(meta) {
  return { '@context': 'https://schema.org', '@graph': [
    { '@type': ['Organization', 'OnlineStore'], '@id': ORIGIN + '/#organization', name: 'Ozylix', url: ORIGIN + '/', logo: ORIGIN + '/assets/ozylix-icon-512.png', email: 'hi@ozylix.com', sameAs: ['https://www.instagram.com/ozylix_care'] },
    { '@type': 'WebSite', '@id': ORIGIN + '/#website', name: 'Ozylix', url: ORIGIN + '/', inLanguage: 'en-IN', publisher: { '@id': ORIGIN + '/#organization' } },
    { '@type': 'WebPage', '@id': meta.canonical + '#webpage', url: meta.canonical, name: meta.title, description: meta.description, inLanguage: 'en-IN', isPartOf: { '@id': ORIGIN + '/#website' } },
  ] };
}

// Stream route-specific metadata into the shared shell before JavaScript runs.
// Account/admin routes and redirects are deliberately outside this transform.
export function withPageSeo(response, request) {
  const url = new URL(request.url);
  const meta = pageSeo(url.pathname);
  if (!meta || url.hostname === 'back.ozylix.com' || response.status !== 200 || request.method === 'HEAD' || !response.headers.get('Content-Type')?.includes('text/html') || typeof HTMLRewriter === 'undefined') return response;
  let schemaSeen = false;
  return new HTMLRewriter()
    .on('title', { element: element => element.setInnerContent(meta.title) })
    .on('link[rel="canonical"]', { element: element => element.setAttribute('href', meta.canonical) })
    .on('meta[name="description"]', { element: element => element.setAttribute('content', meta.description) })
    .on('meta[property="og:title"], meta[name="twitter:title"]', { element: element => element.setAttribute('content', meta.title) })
    .on('meta[property="og:description"], meta[name="twitter:description"]', { element: element => element.setAttribute('content', meta.description) })
    .on('meta[property="og:url"]', { element: element => element.setAttribute('content', meta.canonical) })
    .on('script[type="application/ld+json"]', { element(element) {
      if (schemaSeen) return element.remove();
      schemaSeen = true;
      element.setAttribute('data-ozylx-seo', '1');
      element.setInnerContent(JSON.stringify(brandGraph(meta)).replace(/</g, '\\u003c'), { html: true });
    } })
    .transform(response);
}
