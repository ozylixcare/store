// Public domains are on Pages; the admin-only Worker route cannot redirect
// the apex or serve the public media endpoints. Reuse that tested router here.
import storefront, { PUBLIC_CSP } from '../worker/index.js';

export async function onRequest(context) {
  const url = new URL(context.request.url);
  // Do not expose deployment sources or the admin document through Pages.
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path === '/ops-console-8f3d2c.html' || /^\/(?:worker|functions|tools|docs)(?:\/|$)/.test(path) || /^\/scripts\/admin/.test(path) || /^\/scripts\/(?:store-core|auth-core|banners|ozy-track|theme-builder)\.js$/.test(path) || /^\/scripts\/store-core-\d/.test(path) || /(?:^|\/)(?:wrangler\.jsonc|assets\.manifest\.json|PROGRESS\.md|SECURITY\.md|[^/]+\.map)$/.test(path)) {
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const response = await storefront.fetch(context.request, context.env, {
    waitUntil: promise => context.waitUntil(promise),
  });
  if (!response.headers.get('Content-Type')?.includes('text/html')) return response;

  // Older static route copies contain a different meta CSP. The HTTP policy
  // is authoritative; mirror it in every document so policies never conflict.
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', PUBLIC_CSP);
  headers.set('Cache-Control', 'no-cache');
  const html = new Response(response.body, { status: response.status, headers });
  if (context.request.method === 'HEAD') return html;
  return new HTMLRewriter().on('meta[http-equiv="Content-Security-Policy"]', {
    element(element) {
      // frame-ancestors is enforced only in the HTTP header.
      element.setAttribute('content', PUBLIC_CSP.replace(/frame-ancestors[^;]*;?/, '').trim());
    },
  }).transform(html);
}
