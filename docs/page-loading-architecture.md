# Storefront page loading

The shared shell owns navigation, cart state, login and product pricing helpers.
`module-loader.js` contains the explicit feature registry. Feature loads share
one promise; failures are retryable. There is no arbitrary script URL input.

| Feature | Code loaded when | Data behavior |
| --- | --- | --- |
| Catalogue | Shared store boot | Existing concurrent request sharing; unchanged snapshots do not rebuild cards; refresh pauses when hidden |
| Product reviews | Shared store helpers; first product visit requests reviews | Restored on 13 October: load the complete public list in batches of 100, show three cards first, then page ten locally without further reads |
| Ratings | Shared public review response / complete product review list | Storefront totals use server summaries; product statistics use the complete loaded list, never only the visible cards |
| Blog | Blog page or article action | Article data and rendering are in `blog-page.js`; the shared shell retains only entry points |
| Checkout | Checkout entry, payment action or payment return | `payment-flow.js` owns orchestration; Cashfree SDK loads only for Cashfree; backend validates price, stock, identity and payment |
| Account Hub | Account entry or invoice action | `account-page.js` owns account views; selected panels request their own data; simultaneous order, invoice and summary readers share a single authenticated request |

## Invalidation and ownership

- A saved review forces a fresh complete read and confirms the saved row before
  clearing the draft. It expands the first review page; home review/ratings
  promises are also cleared. A purchase is not required for signed-in customers.
- Review responses have a per-product version so an older read cannot replace
  a newer confirmed save. Displayed pages clamp to the available review list.
- The homepage shared review feed requests up to 100 rows while retaining the
  server's full count and average. Only actual purchases receive the badge.
- Account order requests share only while in flight. There is no persistent
  private response cache. A token change resets account state and an outgoing
  session's response is rejected before rendering.
- Account refresh runs only on the visible account page and selected panel;
  navigation away clears the refresh interval.
- Cart and price calculations remain in the established shared helpers. Server
  validation is authoritative at checkout. Feature separation does not add a
  second pricing engine or cache payment decisions.

## Build and verification

Run `node tools/build-assets.mjs` after changing large source scripts and commit
their generated siblings plus `assets.manifest.json`. The new page scripts are
included automatically by the existing size-based asset builder.

Focused checks:

```sh
node tools/test-page-data-loading.cjs
node tools/test-review-save.cjs
node tools/test-shopping-consistency.cjs
node tools/test-checkout-login-return.cjs
node tools/test-checkout-recovery.cjs
node tools/test-visitor-analytics.cjs
node tools/test-feature-loading.cjs
node tools/test-responsive-device.cjs
```

Browser tests use mocked APIs and payment SDKs. They create no real orders or
payments and do not measure live Core Web Vitals or production capacity.

This is an incremental boundary refactor. Product rendering, cart calculation,
login and loyalty helpers still live in the shared shell and can be split further
after their remaining synchronous dependencies are removed.
