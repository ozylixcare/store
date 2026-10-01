# OZYLIX progress

Updated 2026-10-01. Work is sequential: implement one issue, test, open PR, merge, then proceed.

## Google login — CODE FIX MERGED; LIVE ACCEPTANCE PENDING

Changed: scripts/auth-core.js, scripts/auth-core.min.js, storefront HTML script references, sw.js, assets.manifest.json, tools/test-google-session.cjs.

Desktop fallback now requests an authorization code for server exchange. Login success requires a backend session; invalid responses remain signed out. Redirect exchange uses the shared API base. Pages and the service-worker cache use the rebuilt canonical script.

Validation: new Google-session regression test and all nine pre-existing storefront regression tests pass; source/minified syntax checks pass. Real Google account acceptance, refresh/reopen and deployed-page checks remain unverified because authenticated runtime access is unavailable.

PR #5 merged: https://github.com/ozylixcare/store/pull/5. Cloudflare branch build succeeded. No claim of real-account acceptance.

## Checkout login return — IN PROGRESS

Changed: login gate and redirect resume in scripts/auth-core.js, rebuilt minified sibling, HTML asset versions, sw.js, manifest and checkout-return regression tests.

The selected COD/prepaid method is persisted before Google redirect. COD resumes COD; prepaid resumes prepaid. Checkout from a cart no longer requires a current product ID. Existing server COD confirmation remains separate from gateway calls.

Validation: checkout-return tests cover both payment methods from product/cart pages, missing sessions and unrelated return contexts. Existing checkout failure/double-tap and Google-session tests pass. Actual COD persistence, delivery eligibility, gateway success/failure and confirmation emails remain unverified without authenticated staging access. PR pending.

## Remaining issues

| Issue | Status | Next validation |
|---|---|---|
| COD and prepaid checkout | IN PROGRESS | Return-flow fix tested; actual order outcomes still need staging |
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
