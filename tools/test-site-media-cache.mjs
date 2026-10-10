import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const originalFetch = globalThis.fetch;
const originalNow = Date.now;
let now = 100000;
let calls = 0;
let release;
Date.now = () => now;
globalThis.fetch = async () => {
  calls++;
  await new Promise(resolve => { release = resolve; });
  return Response.json({ hero: '/assets/banner.webp' });
};
const request = () => worker.fetch(new Request('https://www.ozylix.com/api/site-media'), {}, {});
try {
  const burst = Array.from({length: 100}, request);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1, '100 cold visitors must share one origin request');
  release();
  const responses = await Promise.all(burst);
  for (const response of responses) assert.deepEqual(await response.json(), {hero: '/assets/banner.webp'});
  assert.deepEqual(await (await request()).json(), {hero: '/assets/banner.webp'});
  assert.equal(calls, 1, 'warm requests must avoid the origin');
  now += 61000;
  const refresh = Array.from({length: 100}, request);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 2, 'expired cache burst must share one refresh');
  release();
  await Promise.all(refresh);
  now += 61000;
  globalThis.fetch = async () => { calls++; throw Error('origin failed'); };
  const failed = await request();
  assert.equal(failed.status, 502);
  assert.equal(failed.headers.get('Cache-Control'), 'no-store');
  globalThis.fetch = async () => { calls++; return Response.json({hero: '/assets/new.webp'}); };
  assert.deepEqual(await (await request()).json(), {hero: '/assets/new.webp'}, 'failure must not poison future refreshes');
  console.log('PASS site-media cache: cold/expired bursts, independent response bodies, warm hits and error recovery');
} finally { globalThis.fetch = originalFetch; Date.now = originalNow; }
