/**
 * SEO-CORE.js — Ozylix dynamic structured data
 * ─────────────────────────────────────────────────
 * Extracted from the inline <script type="application/ld+json"> block
 * (19 Aug 2026, Manus SEO pass). The 16-product static catalogue —
 * every entry hardcoded "OutOfStock" regardless of real stock — has
 * been replaced by emitProductGraph(), which reads the live
 * PRODUCTS array (store-core.js) and emits correct
 * Product + Offer markup with InStock/OutOfStock availability.
 */
(function () {
  var STATIC_GRAPH = [{"@type":["Organization","OnlineStore"],"@id":"https://www.ozylix.com/#organization","name":"Ozylix","url":"https://www.ozylix.com/","logo":"https://www.ozylix.com/assets/ozylix-icon-512.png","email":"hi@ozylix.com","sameAs":["https://www.instagram.com/ozylix_care"]},{"@type":"WebSite","@id":"https://www.ozylix.com/#website","name":"Ozylix","url":"https://www.ozylix.com/","inLanguage":"en-IN","publisher":{"@id":"https://www.ozylix.com/#organization"}},{"@type":"WebPage","@id":"https://www.ozylix.com/#webpage","url":"https://www.ozylix.com/","name":"Effervescent Vitamins & Supplements Online India | Ozylix","description":"Shop Ozylix effervescent vitamins, spirulina supplements and multivitamins. Explore ingredients and pack options; delivery availability and charges are confirmed at checkout.","inLanguage":"en-IN","isPartOf":{"@id":"https://www.ozylix.com/#website"}}];

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function canonicalProductSlug(product) {
    var raw = product && typeof product === "object"
      ? (product.seoSlug || product.slug || product.urlSlug || product.name)
      : product;
    return String(raw || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  // Remove any previously emitted Ozylix JSON-LD so re-runs
  // (page switches, admin updates) never stack duplicate blocks.
  function clearEmitted() {
    document.querySelectorAll('script[data-ozylx-seo]').forEach(function (s) { s.remove(); });
  }

  function insertGraph(graph) {
    graph = graph.map(function (node) {
      if (node['@type'] !== 'WebPage') return node;
      var page = Object.assign({}, node);
      var canonical = document.querySelector('link[rel="canonical"]');
      page.url = canonical ? canonical.href : 'https://www.ozylix.com/';
      page['@id'] = page.url + '#webpage';
      page.name = document.title;
      var description = document.querySelector('meta[name="description"]');
      page.description = description ? description.content : '';
      return page;
    });
    clearEmitted();
    if (!graph || !graph.length) return;
    var s = document.createElement("script");
    s.type = "application/ld+json";
    s.setAttribute("data-ozylx-seo", "1");
    s.textContent = JSON.stringify({"@context": "https://schema.org", "@graph": graph});
    var first = document.head.querySelector("script[type=\"application/ld+json\"]") || document.head.firstChild;
    if (first && first.parentNode) first.parentNode.insertBefore(s, first);
    else document.head.appendChild(s);
  }

  // The static identity/corporate graph (Organization, WebSite,
  // BreadcrumbList, FAQPage, …) never changes per product, so it
  // is emitted once as-is. Product/Offer markup is dynamic.
  window.emitStaticSeoGraph = function () { insertGraph(STATIC_GRAPH); };

  // Per-page dynamic graph — call when the shop or a product page
  // opens. Merges the static graph with live Product + Offer
  // entries so Google always sees real stock and real prices.
  window.emitPageSeoGraph = function (product) {
    var graph = STATIC_GRAPH.map(function (n) { return JSON.parse(JSON.stringify(n)); });
    if (typeof PRODUCTS !== "undefined" && PRODUCTS && PRODUCTS.length) {
      var base = location.origin;
      var list = product && product.id ? PRODUCTS.filter(function (p) { return p.id === product.id; }) : PRODUCTS.slice();
      var items = list.map(function (p, idx) {
        var price = Number(p.salePrice || p.price || 0);
        var available = typeof p.stock !== "undefined" ? Number(p.stock) > 0 : true;
        var url = "https://www.ozylix.com/product/" + canonicalProductSlug(p);
        return {
          "@type": "Product",
          "@id": url + "#product",
          "name": p.name || "",
          "description": (p.description || "").replace(/<[^>]*>/g, ""),
          "image": (p.image || p.images && p.images[0] && p.images[0].url) || "",
          "url": url,
          "sku": p.sku || String(p.id || ""),
          "brand": {"@type": "Brand", "name": "Ozylix"},
          "offers": {
            "@type": "Offer",
            "@id": url + "#offer",
            "url": url,
            "priceCurrency": "INR",
            "price": price,
            "availability": available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            "itemCondition": "https://schema.org/NewCondition",
            "seller": {"@id": "https://www.ozylix.com/#organization"},
            "areaServed": {"@type": "Country", "name": "India"}
          }
        };
      });
      if (items.length === 1) {
        graph.push(items[0]);
        var wp = graph.find(function (n) { return n["@id"] === "https://www.ozylix.com/#webpage"; });
        if (wp) wp.mainEntity = {"@id": items[0]["@id"]};
      } else if (items.length) {
        graph.push({"@type": "ItemList", "name": "Ozylix Products", "numberOfItems": items.length,
                    "itemListElement": items.map(function (p, i) { return {"@type": "ListItem", "position": i + 1, "item": p}; })});
      }
    }
    insertGraph(graph);
  };

  // Boot: static graph on first paint (search engines crawling
  // the raw HTML see identity markup immediately); the dynamic
  // pass runs after store-core.js has built PRODUCTS.
  window.emitStaticSeoGraph();
  function dynamicPass() {
    if (typeof PRODUCTS !== "undefined" && PRODUCTS && PRODUCTS.length) {
      window.emitPageSeoGraph(null);
    } else {
      setTimeout(dynamicPass, 500);
    }
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", dynamicPass);
  } else { dynamicPass(); }
})();
