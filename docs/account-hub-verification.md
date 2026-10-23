# Ozylix account hub repair — 22 October 2026

Implemented on `fix/account-hub-responsive-repair`; intended for review before production deployment.

## Root causes and repair

| Cause | Repair | Files |
| --- | --- | --- |
| Competing rail, grid, toolbar and selector CSS across source, critical CSS and refinements | Removed account selectors from legacy sheets and critical blocks; one scoped layout with 264px sidebar, minmax main column and 24px gap | index.html; styles/account-refinements.css; styles/store-main.css; styles/store-account-mobile.css; styles/store-template-refresh.css |
| A stale generated mobile stylesheet could retain deleted rules after its source fell below the minification threshold | Rebuild existing generated siblings regardless of source size; retain CSS imports; skip the three source-only admin extensions | tools/build-assets.mjs; assets.manifest.json; generated siblings |
| Narrow mobile rail, hidden labels and fixed-size navigation competed with the existing selector | Full-width disclosure with labeled items, separate sign out, selected state, Escape/focus return and arrow/Home/End keys | index.html; scripts/account-page.js; account-refinements.css |
| Rigid greeting/stat layout, ellipsized identity and weak welcome contrast | Greeting above three equal summary cards; wrapping identity and values; explicit high-contrast colors | account-refinements.css |
| Long order histories and uneven card actions | 10-order client-side disclosure of already-fetched verified data; compact cards; 44px actions; wrapping mobile action grid; escaped dynamic text | scripts/account-page.js; account-refinements.css |
| Invoice mobile markup existed but conflicting layout/table rules undermined it | Desktop table and labeled mobile cards are mutually exclusive via display:none; amount and actions remain visible | account-refinements.css; scripts/account-page.js |
| Section state was not represented in history; focus did not reliably position the heading | section query parameter, guarded history updates, focused heading with instant scroll beneath header, account-aware popstate | scripts/account-page.js; scripts/auth-core.js |
| Profile labels lacked explicit associations; fields lacked grouped structure and save feedback | Contact/address fieldsets, associated labels, read-only email explanation, native PIN validation and local-save status | index.html; scripts/account-page.js |
| Privacy requests could remain loading and permit saving before preferences were loaded | Request timeout, disable Save while loading, busy status; deletion nonce/code/typed DELETE retained | scripts/account-privacy.js |
| Rewards history was a wide table; refresh failure was silent | Labeled mobile activity records; refreshing and stale-balance retry feedback; accessible progressbar; calculations unchanged | scripts/auth-core.js; account-refinements.css |
| Floating chat could obscure the account workflow | Account-only launcher placed in document flow; popup retains constrained geometry | account-refinements.css |
| Missing static account rewrite and incorrect skip target/headings | Add account rewrite; account skip target; h1 welcome and h2 panels | _redirects; index.html; account-page.js |

Shared selectors unrelated to the account were preserved. Authentication, API paths/payloads, server balances, invoice generation, return eligibility, profile storage semantics and deletion verification remain in place. Profile saving still stores details locally on the current device, as before; this repair does not claim server-side profile synchronization.

## Browser verification

The live signed-in account was inspected read-only. Before/after screenshots and responsive measurements use isolated, explicitly labeled synthetic fixtures generated from the original and repaired account markup/styles and original handlers. Production credentials and customer records are absent from those fixtures. The repaired served minified assets are used by the final after fixture.

The cloud browser exposed no viewport override, so each width was exercised as an actual iframe CSS viewport inside a browser QA wrapper. These are browser-rendered responsive checks, not eight physical-device tests. A 15px vertical scrollbar accounts for the difference between iframe width and document clientWidth.

| Width | Seven content sections | Horizontal overflow | Nested panel scrolling | Inactive panels inert |
| --- | --- | --- | --- | --- |
| 320 | Pass | None | None | Pass |
| 360 | Pass | None | None | Pass |
| 390 | Pass | None | None | Pass |
| 430 | Pass | None | None | Pass |
| 768 | Pass | None | None | Pass |
| 1024 | Pass | None | None | Pass |
| 1280 | Pass | None | None | Pass |
| 1440 | Pass | None | None | Pass |

Additional observed results:

- Forty long-content checks passed across all eight widths for orders, invoices, profile, rewards and returns. Names, emails, order references and product descriptions were extended in fixtures.
- Empty, loading and error states inspected for orders, invoices, returns, rewards and privacy. Existing timeout-based loaders resolve to content or retry states; an intentionally unresolved fixture was used only to inspect loading appearance.
- At 320px, mobile invoice cards exposed reference/date/amount/payment and Download/Print; desktop invoice markup had no layout box. The selected panel heading measured approximately 120px below the viewport top after switching.
- End reaches the last navigation item; Escape closes navigation and restores the toggle focus. Inactive panels have inert and aria-hidden.
- Load more changed visible order count from 10 to 14 without changing totals or rewards.
- Blank tracking input showed inline validation; a synthetic AWB resolved to its order and original Shiprocket link.
- Mock profile saving reported success and retained the read-only email. Mock preference saving reported success. Lowercase `delete` was rejected by the unchanged typed-confirmation check.
- Browser Back restored Orders; Forward restored Profile. Mock Sign out called the sign-out handler.
- No real order, return, profile, consent, account deletion or sign-out was submitted during verification.

## Repository validation

Passed: `node tools/test-account-hub.cjs`, `node tools/test-account-isolation.cjs`, `node tools/test-cookie-session.mjs`, `node tools/test-consent-gates.cjs`, `node tools/test-position-restore.cjs`, source syntax checks, `node tools/build-assets.mjs`, `node tools/build-assets.mjs --check`, and `git diff --check`.

Existing browser scripts `test-feature-loading.cjs`, `test-responsive-device.cjs` and `test-vita-layout.cjs` could not start because their installed Playwright browser executable is absent. `test-auth-dialog.cjs` additionally lacks `@axe-core/playwright`. They are not reported as passing; browser inspection above used the provided browser connection instead.

## Remaining verification and release steps

- Native browser 200% zoom, physical iOS/Safari and Android testing remain unverified. Browser zoom shortcuts did not change the exposed zoom metrics in this environment.
- Full authenticated production PDF download/print and mutations need a designated test account/staging workflow; the original handlers are retained, with wiring and fixtures verified.
- Shop/checkout were not subjected to a full browser purchase regression. Account selectors were removed selectively, with unrelated shared selectors retained; existing consent/session/position regression checks passed.
- Merge/deploy the reviewed PR, then perform a production read-only smoke test and cache refresh. This report does not claim that the repair is already live.

Screenshots supplied separately: before/after desktop (1280px) and mobile (390px), all explicitly synthetic QA fixtures.

## Styling follow-up

Restored theme-derived account colours and raised/inset neumorphic surfaces while retaining the responsive repair. The shared liquid-glass button surface now has a visible rim, reflection, hover and pressed states, a softer overlay for light text, reduced-motion support and forced-colour fallback. Shared storefront/admin loading and the standalone FAQ entry include it. Dynamically rendered buttons receive the same non-interactive decorative layer; labels, dimensions and handlers are unchanged. Repeated all 56 section/width checks after this style adjustment: no overflow, and every native button in the account fixture carried the glass decoration.

## Original account colour correction

Restored the earlier account-specific burgundy (#8e2333), purple (#6c317f) and indigo (#4b4a99) welcome gradient from the repository history, with white text, translucent summary cards and the earlier green selected navigation. The previous theme-derived neutral banner did not restore these colours. Kept the responsive layout, neumorphic content surfaces and shared glass buttons. Desktop and mobile fixture previews verify the rendered gradient and white text; regression checks protect the palette from another neutral-theme substitution.
