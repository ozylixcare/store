# Customizable admin dashboard

The Dashboard now has responsive card layouts, cursor/touch chart inspection,
keyboard chart inspection, chart data tables, series toggles, and shallow 3D
bar/donut depth. Order-value distribution and current inventory health are new
charts. The fulfilment pipeline shows current status counts rather than implying
that prepaid and COD orders pass through the same payment sequence.

Choose **Arrange widgets**, then drag a card's grip or use its arrow buttons.
Grip arrow keys reorder cards too. Width choices are Small, Medium, Wide, and
Full; phone layouts always fit one chart per row. Comfortable/Compact spacing,
3D depth, widget order, and widths persist locally in this browser. Reset layout
restores defaults. Storage contains only widget IDs and appearance choices.
These controls do not send API requests or change business records.

Existing loaders, permissions, sessions, exports, and source DOM IDs are retained.
Dashboard-specific chart adapters leave other admin chart pages alone. Existing
OS and browser reduced-motion preferences still apply. Native canvas rendering
adds no external dependency, SDK, or backend service.

Cards and charts use the same inclusive local-calendar date range. Hourly orders
respect that range; paid-revenue chart totals match the plotted values. First-time
buyers use first purchases in the loaded order history, not customer names or
account registrations. All-time charts include the loaded history and use month
or year buckets for long histories. They are limited to the existing loader's
order dataset (currently up to 2,000 orders), not a full database aggregation.
The separate 30-day order-value chart and 7-day projection remain explicitly
labelled; the projection is a simple estimate, not a promised outcome.

The tablet breakpoint also gives the main area its full grid row once the
desktop sidebar is hidden, avoiding a narrow blank sidebar column.

Verification:

```sh
CHROMIUM_EXECUTABLE=/path/to/chromium node tools/test-admin-workspace.cjs
CHROMIUM_EXECUTABLE=/path/to/chromium node tools/test-admin-bento.cjs
node tools/test-admin-session.cjs
node tools/test-admin-upload.cjs
```

The workspace test serves local files, stubs reads with synthetic orders/products,
blocks external traffic and server writes, and checks paid totals, inclusive date
boundaries, all-time history, buyer history, pointer/keyboard/button reordering,
saved preferences, widths from 360 to 1,920px, crisp resized canvases, and reduced
motion. Screenshots are temporary QA artifacts, not live customer data.
