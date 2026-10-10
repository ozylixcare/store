import assert from 'node:assert/strict';
import http from 'node:http';
import { stagingTarget, runLoad } from './load-test.mjs';
for (const target of ['https://www.ozylix.com', 'https://backend-s7ih.onrender.com', 'https://example.com', 'https://staging.example.com/path', 'https://user:password@staging.example.com']) assert.throws(() => stagingTarget(target));
assert.equal(stagingTarget('https://staging.example.com'), 'https://staging.example.com');
const paths = new Set();
const server = http.createServer((req, res) => {
  assert.equal(req.method, 'GET');
  paths.add(req.url);
  res.setHeader('Content-Type', req.url.startsWith('/api/') ? 'application/json' : 'text/html');
  res.end(req.url.startsWith('/api/') ? '{"data":[]}' : '<html>Local fixture</html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const result = await runLoad({ target: `http://127.0.0.1:${server.address().port}`, users: [20, 50, 100, 20], seconds: 1 });
  assert.ok(result.every(stage => stage.pass));
  assert.deepEqual([...paths].sort(), ['/', '/api/products', '/api/site-media', '/shop']);
  console.log('PASS local fixture: ramp up/down, public GET journey, JSON validation, thresholds and production guards. This is not a production capacity measurement.');
} finally { await new Promise(resolve => server.close(resolve)); }
