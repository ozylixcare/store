# OZYLIX progress

Updated 2026-10-01. Work is sequential: implement one issue, test, open PR, merge, then proceed.

## Google login — IN PROGRESS

Changed: scripts/auth-core.js, scripts/auth-core.min.js, storefront HTML script references, sw.js, assets.manifest.json, tools/test-google-session.cjs.

Desktop fallback now requests an authorization code for server exchange. Login success requires a backend session; invalid responses remain signed out. Redirect exchange uses the shared API base. Pages and the service-worker cache use the rebuilt canonical script.

Validation: new Google-session regression test and all nine pre-existing storefront regression tests pass; source/minified syntax checks pass. Real Google account acceptance, refresh/reopen and deployed-page checks remain unverified because authenticated runtime access is unavailable.

PR/merge: pending. No claim of live deployment verification.

## Remaining issues

| Issue | Status | Next validation |
|---|---|---|
| COD and prepaid checkout | TODO | Trace independent payment paths and test order outcomes |
| Database/server consistency | BLOCKED | Applied schema and private staging configuration needed |
| End-to-end data and product controls | TODO | Test admin edits, inactive products and checkout rejection |
| Admin email OTP | TODO | Test delivery, expiry, attempts, reuse and server authorization |
| Media upload/delete | TODO | Test storage and reference consistency |
| Customer behavior and invoices | TODO | Validate metrics, customer isolation and generated invoices |
| Analytics | TODO | Verify consent, payloads and once-per-order events |
| Homepage reference layout | TODO | Compare screenshots at desktop/mobile widths |
| Performance | TODO | Measure baseline and final results |
| Dead code cleanup | TODO | Search references before each removal |
| Security and final journeys | TODO | Complete review and realistic acceptance tests |

Detailed audit is retained locally; it is not included in this public progress document.
