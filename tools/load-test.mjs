// Read-only browser journey. Node 22+, no packages or paid third-party calls.
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';

export function stagingTarget(value) {
  const url = new URL(value);
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (!local && !(url.protocol === 'https:' && /^staging[.-]/i.test(url.hostname))) {
    throw new Error('Use localhost or an HTTPS hostname starting with staging. Production targets are blocked.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Provide only the staging origin, without credentials, path or query.');
  }
  return url.origin;
}

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function runLoad({ target, users = [20, 50, 100, 20], seconds = 30 }) {
  const base = stagingTarget(target);
  if (!Number.isFinite(seconds) || seconds < 1 || seconds > 120) throw new Error('Stage duration must be 1–120 seconds');
  if (!users.length || users.length > 8 || users.some(n => !Number.isInteger(n) || n < 1 || n > 100)) throw new Error('Use 1–100 users per stage, at most 8 stages');
  const stages = [];
  for (const concurrency of users) {
    const start = performance.now(), deadline = start + seconds * 1000;
    let failed = 0, count = 0;
    const timings = [];
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (performance.now() < deadline) {
        for (const path of ['/', '/shop', '/api/products', '/api/site-media']) {
          if (performance.now() >= deadline) break;
          const began = performance.now();
          try {
            const response = await fetch(base + path, { redirect: 'error', signal: AbortSignal.timeout(10000) });
            // No cookies/tokens, redirects, writes or third-party destinations.
            if (!response.ok) throw Error('HTTP ' + response.status);
            if (path.startsWith('/api/')) {
              if (!(response.headers.get('Content-Type') || '').includes('json')) throw Error('Expected JSON');
              await response.json();
            } else await response.arrayBuffer();
          } catch { failed++; }
          count++;
          // Bounded sampling memory: keep the newest 100,000 requests.
          if (timings.length === 100000) timings.shift();
          timings.push(performance.now() - began);
          await pause(100 + Math.random() * 200);
        }
      }
    }));
    timings.sort((a, b) => a - b);
    const p95 = timings[Math.max(0, Math.ceil(timings.length * .95) - 1)] || 0;
    const result = { users: concurrency, requests: count, failures: failed, failureRate: count ? failed / count : 1, p95Ms: Math.round(p95), elapsedSeconds: Number(((performance.now() - start) / 1000).toFixed(2)) };
    result.pass = result.requests > 0 && result.failureRate < .01 && result.p95Ms < 500;
    stages.push(result);
    console.log(JSON.stringify(result));
  }
  return stages;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const stages = await runLoad({ target: process.env.STAGING_URL, users: (process.env.LOAD_USERS || '20,50,100,20').split(',').map(Number), seconds: Number(process.env.STAGE_SECONDS || 30) });
    if (stages.some(stage => !stage.pass)) process.exitCode = 1;
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
