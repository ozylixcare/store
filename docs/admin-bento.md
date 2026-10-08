# Admin bento workspace

Reference: Code & Chill's bento dashboard reel, https://www.instagram.com/reel/Dd7AalkTZPY/.
The shared admin layer adds warm neutral surfaces, yellow active navigation,
rounded cards, staggered page entry and modal transitions. Existing page IDs,
data loaders, role checks, forms and actions remain in their original modules.
Navigation uses consistent inline vector icons and supports Enter/Space.
Closed drawers no longer cast a dark shadow over the screen. Page changes start
at the destination heading rather than retaining the previous page's scroll.
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
and run
`node tools/test-admin-bento.cjs`. The test serves the repository automatically.
`ADMIN_PREVIEW_URL` may point to an existing local preview instead;
`CHROMIUM_EXECUTABLE` may select an installed Chromium executable.

The test intercepts all backend reads with synthetic, empty fixtures and blocks
all other external requests. It does not test production integrations or create
real orders, payments, messages or shipments. It checks every admin page,
desktop and mobile widths, persisted preferences, reduced motion, and the
absence of backend writes from appearance controls. Generated screenshots are
local QA outputs under `docs/admin-bento/`, not evidence of live business data.

Validated on 8 October 2026: all 29 page destinations; 1440px, 768px and 390px
viewports; mobile menu opening and closing; keyboard navigation; saved style
and motion preferences; OS reduced motion; counter final values; closed drawer
visibility; and no backend writes. Existing session, media and upload checks
also passed.
