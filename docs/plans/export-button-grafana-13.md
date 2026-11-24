# Plan: find the Explore table in Grafana 12.4 and later

Closes #4.

## Motivation

The extension finds the result table with `[aria-label="Explore Table"]`. Grafana removed that label in
`v12.4.0`, when Explore moved to the table panel (`<PanelRenderer pluginId="table">`). On Grafana 13.3 the
scan matches nothing, so no Export button shows. The person sees a dead extension.

## Evidence

Checked on `play.grafana.org`, Grafana `13.4.0`, Explore with one query:

| Fact                                  | Value                                                           |
| ------------------------------------- | --------------------------------------------------------------- |
| `[aria-label="Explore Table"]`        | 0 matches                                                       |
| The table                             | `div[role="grid"]`, a react-data-grid, with `aria-rowcount`     |
| A second `div[role="grid"]`           | hidden, 100x100 px, no React fiber: it measures the scrollbar   |
| The panel                             | `section[data-testid="data-testid Panel header Table"]`         |
| The page                              | `[data-testid="data-testid Explore"]`                           |
| The title bar                         | `div[data-testid="data-testid header-container"]`, text `Table` |
| `findDataFrame` from the visible grid | finds the data frame 5 levels up                                |

## Decisions

Each one follows from the evidence, from `AGENTS.md`, or from the code. None needs the owner.

1. **A table is an element with the data behind it.** The scan takes `[aria-label="Explore Table"], [role="grid"]`,
   then keeps only the elements where `findDataFrame` finds a frame. The hidden grid has no fiber, so it drops out.
   Source: the rule "Match Grafana's data by shape, never by a component name" in `AGENTS.md`.
2. **The scan stays in Explore.** The table panel also runs in dashboards. A `role="grid"` match must sit under
   `[data-testid="data-testid Explore"]`. The old label needs no such test, so Grafana 11 and 12 keep working.
   Source: `README.md` and `store/listing.md` describe an Explore tool. A wider scope needs the owner.
3. **One table gives one button.** When a match holds another match, such as an old label around the new grid,
   the scan keeps the outer element only.
4. **The decision moves to `grafanaFrames.js`,** as `findTables(root)`. It is the only file that knows Grafana's
   shapes, and `exportMenu.js` is a thin adapter with no unit test. Source: `AGENTS.md`.
5. **The title bar also matches by test id,** `[data-testid$="header-container"]`, beside the `Table` text. Grafana 11
   used `header-container`, Grafana 12 and later use `data-testid header-container`. The text test alone fails in a
   translated interface.
6. **The fallback host grows with the panel section,** `[data-testid^="data-testid Panel header"]`, beside the old
   `section-wrapper-Table`.
7. **A fake DOM lives in `test/support/fakeDom.js`.** The tests run in `node:vm` with no DOM, and the project adds no
   dependency for one. The fake reads attributes and holds a small selector matcher, enough for these selectors.
8. **The version is a patch, `fix:`.** The extension keeps its features. Nothing stored changes, so the change breaks
   nothing. Source: the release rules in `AGENTS.md`.

## Gaps

None left open.

## Steps

1. `test/support/fakeDom.js`: a fake element tree with `querySelectorAll`, `matches`, `closest` and `contains`.
2. `test/grafanaFrames.test.js`: failing tests for `findTables`.
3. `src/page/grafanaFrames.js`: the selectors and `findTables`.
4. `src/page/exportMenu.js` and `src/page/pageEntry.js`: use `findTables`, and find the title bar by test id.
5. Check by hand on `play.grafana.org`: inject the page scripts, press Export, read the rows.
6. `README.md`: name the Grafana versions that work.
