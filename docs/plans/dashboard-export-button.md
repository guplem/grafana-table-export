# Export button on the table panels of a dashboard

Issue: #6

## Goal

A table panel of a Grafana dashboard gets the same Export button that Explore has. In a dashboard the
button shows only while the mouse is over the panel, or while the keyboard focus is inside it. Explore
keeps the button always visible.

## What the code does today

- `isResultTable` in `src/page/grafanaFrames.js` keeps a `[role="grid"]` only when it sits inside
  `[data-testid="data-testid Explore"]` and carries a data frame. A dashboard grid fails that test.
- A `[aria-label="Explore Table"]` element counts by itself, with no frame and no Explore above it.
  Grafana 12.3 and earlier use that label. Keep this path as it is.
- `findTitleBar` in `src/page/exportMenu.js` walks up to 12 levels. It stops only below a level that
  holds the table of another section.
- The button container sits at `right: 8px` in the host, and is always visible.

## Design

### 1. Which tables count (`grafanaFrames.js`)

A grid counts when it carries a data frame **and** sits in a panel section or in the Explore container.

```js
return (sectionOf(element) !== null || element.closest(EXPLORE_SELECTOR) !== null) && findDataFrame(element) !== null;
```

The Explore test stays as a second chance, so a Grafana that drops the panel section in Explore keeps
its button. The panel inspector renders its table in a drawer outside every section and outside the
Explore container, so it gets no button.

### 2. Who shows the button at rest (`grafanaFrames.js`)

One pure function answers it, because `exportMenu.js` has no unit test:

- `showsButtonAtRest(tableElement)`: `true` inside the Explore container, `false` anywhere else.

### 3. Where the button sits (`grafanaFrames.js`)

The panel of a dashboard holds its own menu button at the right of the title bar. Two more pure
functions keep that measurement out of `exportMenu.js`:

- `menuButtonOf(host)`: the panel menu button inside the host, by
  `[data-testid^="data-testid Panel menu"]` or `[data-testid="panel-menu-button"]`. Never by the
  `aria-label`: Grafana translates it.
- `rightOffset(menuButtonWidth)`: `8` with no menu button, `8 + width + 6` with one.

### 4. The walk up stops at the section (`exportMenu.js`)

A panel with no title has no title bar, so the walk up escapes the panel and the button lands in the
corner of the dashboard. `findTitleBar` and `buttonsAround` stop at the section of the table.

### 5. Hover and focus (`exportMenu.js`)

The container starts `visibility: hidden` when `showsButtonAtRest` is `false`. It shows while any of
these is true: the mouse is over the section, the focus is inside the section, the menu is open.
`pointerover`, `pointerout`, `focusin` and `focusout` on the section drive it, and each handler reads
the live state (`section.matches(':hover')`, `section.contains(document.activeElement)`), so a missed
event cannot leave the button stuck.

`visibility: hidden` takes no click and no focus, so the Tab key skips the hidden button.

### 6. Texts that say Explore

Each one below states something that stops being true:

- `manifest.json` `description` (the store summary, 132 characters at most, 118 today)
- `package.json` `description`
- `PRIVACY.md` first line and date
- `src/popup/popup.js`, three messages
- `store/listing.md`: summary, description, features, single purpose, permission justification
- `store/graphics/01-exportTable.html`, then `scripts/renderStoreImages.ps1`
- `AGENTS.md` first line and the traps that name Explore
- `README.md` first line, the steps, the troubleshooting note
- `test/grafanaFrames.test.js`, the test that asserts a dashboard gets no button

## Gaps, answered

Measured on `play.grafana.org`, Grafana 13.4, dashboard `/d/OhR1ID6Mk/table` and Explore.

1. **The panel inspector sits outside every section.** Its grid is in
   `[data-testid="data-testid Panel inspector Data content"]`, with a data frame and no panel section
   above it. The section test keeps it out, in a dashboard and in Explore.
2. **The menu button sits inside the title bar.** `[data-testid^="data-testid Panel menu"]`, 20 by 24
   pixels, inside `[data-testid="data-testid header-container"]`, 8 pixels from the right edge of the
   section. `getComputedStyle` reports `visibility: hidden` and `opacity: 0` at rest.
3. **A panel with no title keeps the section, with an empty name:** `data-testid Panel header `. Its
   header is `[data-testid="data-testid hover-header-container"]`, which `TITLE_BAR_SELECTOR` already
   matches, because that selector ends with `header-container`.
4. **Explore has no menu button.** `menuButtonOf` returns `null` there, so `rightOffset` gives 8 and
   the button keeps its place of today.
5. **The hover ends when the pointer reaches the menu**, because the menu sits on `document.body`.
   The "menu is open" state covers it.
6. **The Explore table of Grafana 12.4 and later sits in a panel section too**
   (`data-testid Panel header Table`), inside the Explore container.

## Open points that the implementation must answer

- **The listeners follow the button.** `attachExportButton` can move a kept button to another host.
  The listeners must follow the section of the table, and must not pile up on each scan.
- **The scan must stay fast.** The issue asks for one scan under 10 ms with ten table panels.

## Steps

1. Tests and code for `isResultTable`, `showsButtonAtRest`, `menuButtonOf` and `rightOffset`.
2. The walk up stops at the section.
3. Hover and focus in `exportMenu.js`.
4. The texts, then the store images.
5. A check by hand on a real Grafana 13 dashboard.
