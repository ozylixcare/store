# Google Search Console and organic SEO launch

Primary public origin: https://www.ozylix.com. The owner confirms the Search Console property is already verified. Preserve the existing Google verification tag.

## Prepared change

The live audit found 28 sitemap URLs returning HTTP 200, but 27 initially canonicalize to the homepage. The edge now streams a distinct title, description, social metadata and self-referencing canonical into each sitemap page before browser JavaScript runs. The shared homepage and client SEO graph use a consistent Schema.org context, Organization/OnlineStore, WebSite and current WebPage. Conflicting organization IDs, circular parent relationships and unsupported accreditation markup are removed. Product prices and stock continue to come from the live catalogue; no inventory or ratings are invented.

Local validation: all 28 sitemap pages pass HTTP, unique-title, canonical, description, Google verification and structured-data checks. Public routing, API proxy, service worker privacy and private-asset tests pass. The minified SEO bundle and source manifest were rebuilt and checked. The asset builder now continues to rebuild existing minified siblings when their source falls below its size threshold.

Deploy the reviewed storefront changes through the existing Cloudflare Pages pipeline. Deployment has not been performed by this session. Cloud environment publication does not deploy the website. Keep the Pages middleware enabled: route-specific initial metadata is emitted by the shared Worker router it imports. No backend/database changes are required.

## Validate after deployment

1. Fetch the public homepage, /shop, two product pages and a journal article. Confirm HTTP 200, different titles and a canonical matching each clean www URL, without query parameters. View source, not only the JavaScript-rendered DOM.
2. Confirm https://ozylix.com/ redirects to https://www.ozylix.com/. Check the existing robots.txt and sitemap.xml return 200; sitemap content is XML and lists the same 28 clean URLs.
3. Use Google's Rich Results Test on an actual product page. Verify any Product offer agrees with visible price and stock. Organization/WebSite markup alone does not promise rich-result eligibility.
4. Preserve private admin/account exclusion. Dynamic catalogue additions need matching metadata and sitemap updates before indexing requests; don't submit retired products or invented article URLs. Unknown product/blog route handling still merits a separate soft-404 review.

## Submit in the existing verified property

Open https://search.google.com/search-console and select the verified ozylix.com property. If using a URL-prefix property, select https://www.ozylix.com/.

In Sitemaps, submit https://www.ozylix.com/sitemap.xml (or sitemap.xml when the UI already supplies the prefix). If already submitted, check its fetch status and discovered URLs rather than creating a new property.

Use URL Inspection and Test Live URL for the homepage, /shop, /product/glutathione-effervescent-tablet and one existing journal article. Confirm crawl availability and rendered content, then request indexing after the corrected deployment is live. Compare Google's selected canonical after recrawling; submission is a request, not immediate indexing.

Account operations were not performed: this session has no authenticated Search Console interface. The existing verification tag proves only that the tag is present; property ownership was confirmed by the user.

## Organic brand visibility

Use one brand identity: Ozylix, https://www.ozylix.com, hi@ozylix.com and the existing official Instagram profile. Confirm business contact details before adding further directory/profile references. Don't fabricate reviews, clinical evidence or accreditation.

Prioritize product pages and the existing journal articles. Link each product guide to relevant purchasable products and the /shop category. Add original ingredient, serving, pack-size, directions and suitability information supported by product labels, with genuine review or expert attribution where available. Keep claims and delivery promises consistent with checkout and current policies. New content is a separate reviewed publishing step.

Record Search Console performance for branded queries (Ozylix and common spelling variations) and non-branded product queries separately. Review Pages indexing, Product results and Core Web Vitals weekly during launch. Investigate excluded URLs individually; neither valid markup nor sitemap submission guarantees ranking.

## Reproduce local checks

With the saved local Wrangler development server running on 127.0.0.1:8082:

```sh
node tools/build-assets.mjs --check
node tools/test-seo-pages.mjs
node tools/test-public-domains.mjs
node tools/test-api-proxy.mjs
node tools/test-service-worker.mjs
node tools/test-private-assets.mjs
```

Live audit observations and response files are retained outside the checkout at /workspace/seo-launch. They describe the pre-deployment site, not the locally corrected version.
