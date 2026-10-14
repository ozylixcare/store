import assert from 'node:assert/strict';
import fs from 'node:fs';

const origin = new URL(process.env.SEO_TEST_ORIGIN || 'http://127.0.0.1:8082');
assert.ok(['127.0.0.1', 'localhost'].includes(origin.hostname), 'Use a local development server for this test');
const sitemap = fs.readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
assert.ok(urls.length > 20, 'Sitemap must include the product and journal pages');
const titles = new Set();
for (const canonical of urls) {
  const path = new URL(canonical).pathname;
  const response = await fetch(new URL(path, origin), { redirect: 'manual' });
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get('content-type'), /text\/html/, path);
  const html = await response.text();
  assert.equal(html.match(/<link rel="canonical" href="([^"]+)"/)?.[1], canonical, path);
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  assert.ok(title?.includes('Ozylix'), path);
  assert.ok(!titles.has(title), 'Each sitemap page needs a distinct title: ' + path);
  titles.add(title);
  assert.ok(html.match(/<meta name="description" content="([^"]+)"/)?.[1].length > 40, path);
  assert.match(html, /name="google-site-verification" content="GZiN7uXnrFdvm4xVDmHEq0NNPOaEXZEcd41taJMP_JA"/, path);
  const blocks = [...html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(blocks.length, 1, 'One initial graph per route: ' + path);
  const graph = JSON.parse(blocks[0][1]);
  assert.equal(graph['@context'], 'https://schema.org', path);
  const ids = graph['@graph'].map(node => node['@id']);
  assert.equal(new Set(ids).size, ids.length, path);
  const page = graph['@graph'].find(node => node['@type'] === 'WebPage');
  assert.equal(page.url, canonical, path);
  const organization = graph['@graph'].find(node => node.name === 'Ozylix' && node.logo);
  assert.equal(new URL(organization.logo).origin, 'https://www.ozylix.com', path);
  assert.ok(!JSON.stringify(graph).includes('World Health Organization'), path);
}
console.log(`PASS: ${urls.length} sitemap pages return 200 with unique titles, self canonicals, descriptions, preserved verification and valid brand graphs`);
