# Ozylix performance workflow

## Implemented and verified, 10 October 2026

The Cloudflare site-media handler now collapses concurrent cold/expired cache
requests into one sanitized public origin response. In the deterministic test,
100 simultaneous requests triggered 100 origin calls before the fix and one
after it. Cache freshness remains 60 seconds, measured from successful fetch
completion. Failed fetches are not cached; each caller gets an independent body.
No new service, paid plan, or environment variable is required.

Backend public catalogue/config response caching already exists. Its existing
test passed for coalescing, query isolation, credential bypass, error recovery
and invalidation races. Do not add a second cache for customer accounts, carts,
orders, payments or loyalty balances. Checkout must revalidate price and stock.

## Baseline and verification

Run before and after cache/worker changes:

```sh
node tools/test-site-media-cache.mjs
node tools/test-media-worker.mjs
node tools/test-api-proxy.mjs
node tools/test-service-worker.mjs
node tools/test-private-assets.mjs
node tools/test-load-harness.mjs
```

In the backend checkout, run `node scripts/test-response-cache.js` and required
repository checks before changing public-cache routes. Each performance fix
belongs in its own commit. To undo the cache fix, revert that commit; no database
rollback or environment changes are required.

Manual check: open a product on a phone, confirm banners/images load, then edit
a site image in admin and confirm the storefront reflects it after the freshness
window. Sign in as two test customers separately and verify their orders/points
remain isolated. Automated cache tests do not replace these account checks.

## Staging load test

Node 22+; no dependencies. Stage counts default to 20, 50, 100, then 20 users.
Each visitor reads home, shop, catalogue JSON and site-media JSON with pauses.
No login, checkout, email, payment or order writes are generated. This measures
public browsing only. Validate purchase workflows separately with sandbox accounts
and mocked third-party integrations.

```sh
STAGING_URL=https://staging.example.com STAGE_SECONDS=30 node tools/load-test.mjs
```

Only localhost and HTTPS hostnames starting with `staging.` or `staging-` are
accepted. Production and redirects are blocked. Use a staging database with fake
data. Thresholds are p95 below 500ms and failures below 1% per stage. Results
describe the tested deployment, routes, rate and duration only; they do not
prove tenfold traffic capacity. The local harness validates the tool against a
fixture and must not be presented as live Ozylix performance.

## Database indexes

The connected Supabase account currently exposes project `frwsjgrrtzhjfflcdjjs`,
whereas the storefront's image routing references `syayxfxyqnnvmvrjoxyw`.
The current backend database target has not been verified. No live SQL or schema
change was executed. No environment values or customer rows were inspected.

Run `tools/database-index-audit.sql` on the verified current staging database.
It reads table/index statistics only. Compare the catalogue query's active and
deleted filters plus sort_order/id ordering, public review filters, and order
ownership/date queries with actual plans. Indexes help only when supported by
query plans and data volume; small catalogues can legitimately use table scans.
Start with plain EXPLAIN. Use EXPLAIN ANALYZE for bounded read-only queries with
a timeout on staging; SELECT functions can still have side effects. Record
before/after timings. Generate a reviewed migration and rollback only after
confirming existing indexes and measured benefit. Concurrent index builds must
run outside a transaction and be checked for invalid indexes after failure.

## Hosting and scaling

Confirmed backend: `ozylixcare/backend`, main branch, Render Singapore,
one Starter instance. On 10 October 2026, the sampled last-hour metrics showed
a 0.5 CPU limit and 512 MiB memory limit, approximately 80.5 MiB used and low CPU.
HTTP latency samples were unavailable. These low-traffic samples do not prove
capacity during a launch. No hosting plan or instance count was changed.

Check CPU, memory, latency, error rate and database connections during the staging
test before spending on scaling. The marketing service is a separate free-plan
instance; storefront telemetry can have its own reliability limits. Before adding
backend replicas, audit process-local rate limits, scheduled notifications/jobs,
session state and cache invalidation. Process-local public caches are expendable,
but correctness must not depend on them surviving a restart or being shared.
Persist sessions/uploads and important state in the verified database/storage.
Use the Supabase Data API's existing pooling for supabase-js; transaction-pooler
port advice applies to direct PostgreSQL clients, not the HTTPS API.

Keep the current architecture until measurements justify a paid change. Costs
and capacity must be checked against the selected workspace/current plan before
an upgrade. Kubernetes is not required for this implementation.
