// Fixed upstreams only. Client-supplied URLs can never select a destination.
const BACKEND = 'https://backend-s7ih.onrender.com';
const MARKETING = 'https://marketing-automation-rmcb.onrender.com';
const TRACK_PATHS = new Set(['/api/track']);
const METHODS = new Set(['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS']);

export function isApiRequest(path) {
  return path.startsWith('/api/') || path.startsWith('/telemetry/');
}

export function publicMedia(value) {
  if (typeof value === 'string') return value.replace(/https:\/\/back\.ozylix\.com(?=\/cdn-storage\/)/g, '').replace(/https:\/\/syayxfxyqnnvmvrjoxyw\.supabase\.co\/storage\/v1\/object\/public\/ozylix(?:%20| )store\//g, '/cdn-storage/ozylix%20store/');
  if (Array.isArray(value)) return value.map(publicMedia);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, publicMedia(item)]));
  return value;
}

export async function handleApiRequest(request) {
  const url = new URL(request.url);
  const tracking = url.pathname.startsWith('/telemetry/');
  const path = tracking ? url.pathname.slice('/telemetry'.length) : url.pathname;
  const privateResponse = (message, status) => new Response(JSON.stringify({error:message}), {status, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  if (!METHODS.has(request.method)) return privateResponse('Method not allowed',405);
  if (/[\\\x00-\x1f]/.test(path) || /%(?:2f|5c|2e)/i.test(path)) return privateResponse('Invalid path',400);
  if (tracking && (!TRACK_PATHS.has(path) || !['POST','OPTIONS'].includes(request.method))) return privateResponse('Not found',404);
  // Admin APIs are available only on the existing admin host and still require
  // the backend's own authentication, role checks and rate limits.
  if (!tracking && path.startsWith('/api/admin') && url.hostname !== 'back.ozylix.com') return privateResponse('Not found',404);
  if (!['GET','HEAD','OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('Origin');
    if (origin && origin !== url.origin) return privateResponse('Origin not allowed',403);
    if (request.headers.get('Sec-Fetch-Site') === 'cross-site') return privateResponse('Origin not allowed',403);
  }
  const headers = new Headers();
  for (const name of ['Accept','Content-Type','Authorization','Range','If-Range','X-Session-Id','X-Device-Id','X-Idempotency-Key','X-Payment-Session','X-Security-Version','X-Request-Id']) {
    if (request.headers.has(name)) headers.set(name,request.headers.get(name));
  }
  headers.set('Origin',url.origin);
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) headers.set('X-Forwarded-For',ip);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(),25000);
  try {
    const upstream = await fetch((tracking ? MARKETING : BACKEND) + path + url.search, {
      method:request.method,headers,redirect:'manual',signal:controller.signal,
      ...(!['GET','HEAD'].includes(request.method) ? {body:request.body,duplex:'half'} : {}),
    });
    const responseHeaders = new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
    for (const name of ['Content-Type','Content-Disposition','Content-Range','Accept-Ranges','Retry-After','RateLimit','RateLimit-Policy']) {
      if (upstream.headers.has(name)) responseHeaders.set(name,upstream.headers.get(name));
    }
    if (upstream.headers.has('Location')) {
      const location = upstream.headers.get('Location');
      responseHeaders.set('Location',location.startsWith(BACKEND + '/') ? url.origin + location.slice(BACKEND.length) : location);
    }
    if (request.method === 'HEAD' || [204,304].includes(upstream.status)) return new Response(null,{status:upstream.status,headers:responseHeaders});
    // Keep all customer/auth/order responses uncached. Redact storage origins
    // in public catalogue/content JSON without changing the data contract.
    if (upstream.headers.get('Content-Type')?.includes('application/json')) {
      const payload = publicMedia(await upstream.json());
      return new Response(JSON.stringify(payload),{status:upstream.status,headers:responseHeaders});
    }
    return new Response(upstream.body,{status:upstream.status,headers:responseHeaders});
  } catch {
    return privateResponse('Service temporarily unavailable. Please retry.',502);
  } finally { clearTimeout(timeout); }
}
