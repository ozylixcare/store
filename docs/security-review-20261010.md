# Security review — 10 October 2026

## Confirmed code findings and prepared fixes

- Public product list/detail responses spread entire database rows. This is an
  excessive-field exposure risk: a future cost, supplier or internal column could
  become public automatically. No live secret or customer-row leak was observed.
  Backend public responses now use an explicit field contract, with nested
  media/offer projections. Admin product responses retain their existing contract.
- The public host served admin-only script/style bundles. It now returns 404 for
  those files; they remain available on the admin host for login/admin functions.
  Host separation reduces unnecessary exposure but is not authentication.
- The public-host API proxy blocked only the admin namespace. It now also blocks
  owner, upload, health, analytics and exact privileged aliases, including encoded
  namespace variants. Backend authentication and live permissions remain the real
  authorization boundary, including for direct backend requests.
- Three legacy bundles not referenced by the current HTML/service worker expose
  old infrastructure URLs. They are excluded from deployment and blocked by the
  Worker. Current storefront bundles already use same-origin API/media routing.

## Verification

Passed targeted public-product route tests: unknown future/internal columns and
extra nested media/tier fields are omitted; shopping fields and active/deleted
filters are retained. The new test is included in the backend check script.

Passed existing backend tests for customer ownership across returns, invoices
and tracking, return quantity bounds, live staff permissions, financial gates,
and audit credential redaction. These use fixtures, not live customer accounts.

Passed storefront tests for privileged path blocking, public/private asset
separation, authorization/payment-proof forwarding, same-origin request checks,
media MIME/path restrictions, public-media cache behavior and service-worker
private-data/cache protections. No production load test or paid transaction ran.

## Limits and outstanding checks

The production Supabase project `syayxfxyqnnvmvrjoxyw` denied this session's
security advisor request. The connected project's database is different and was
not queried or modified. Live RLS, table/function grants, storage policies and
backups therefore remain unverified. Existing SQL files are not proof they were
applied. Use the correct owning account for a read-only database audit first.

Codex Security is available but not connected in this session. No plugin scan
result or exhaustive vulnerability claim is made. Dependency scanning is handled
by existing backend CI; its result must be checked for this change.

The backend remains internet reachable. URLs, public catalogue/media and the
Google OAuth client ID are not secrets. Do not delete necessary public resources
to hide their names. Protect privileged routes with verified identities,
ownership, permissions, rate limits and private cache headers. Never ship service
keys, credentials or private customer data to browser bundles.

Two-user authenticated production checks, complete endpoint inventory coverage,
dependency/advisory results and the live database audit remain outstanding.
This is a focused code audit and hardening patch, not a security certification.

## Rollback

Revert the storefront security commit to restore host asset/API routing. Revert
the backend security commit to restore the previous catalogue projection. No
database migration, secret rotation or environment-variable change is included.
