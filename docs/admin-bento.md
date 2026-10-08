# Admin bento workspace

Reference: Code & Chill's bento dashboard reel, https://www.instagram.com/reel/Dd7AalkTZPY/.
The shared admin layer adds warm neutral surfaces, yellow active navigation,
rounded cards, staggered page entry and modal transitions. Existing page IDs,
data loaders, role checks, forms and actions remain in their original modules.
The public storefront is outside this change.

Settings → Interface Settings → Workspace appearance lets each browser choose
Bento or Existing theme, and Smooth or Reduced motion. Choosing an existing
palette or dashboard style switches to Existing theme. OS reduced motion takes
priority. Preferences are stored locally, never sent to a backend endpoint.

`scripts/admin-bento.js` observes existing page changes, including mobile and
keyboard navigation. At most 24 visible card entries start in one frame, with
stagger capped at 175ms. Page changes cancel the previous page's animations.
Numbers retain the data module's final values and formatters. Reducing motion
finishes any active number animation immediately.

## Verification

Run existing session, media and upload checks with Node. For the browser test,
install Playwright in a temporary QA environment, install its Chromium browser,
serve the repository root on http://127.0.0.1:8765 and run
`node tools/test-admin-bento.cjs`. `ADMIN_PREVIEW_URL` may override the origin;
`CHROMIUM_EXECUTABLE` may select an installed Chromium executable.

The test intercepts all backend reads with synthetic, empty fixtures and blocks
all other external requests. It does not test production integrations or create
real orders, payments, messages or shipments. It checks every admin page,
desktop and mobile widths, persisted preferences, reduced motion, and the
absence of backend writes from appearance controls. Generated screenshots are
local QA outputs under `docs/admin-bento/`, not evidence of live business data.
