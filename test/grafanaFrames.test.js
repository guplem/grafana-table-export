import assert from 'node:assert/strict';
import { test } from 'node:test';

import { FakeElement } from './support/fakeDom.js';
import { loadPageScripts, plain } from './support/pageScripts.js';

const frames = loadPageScripts(['src/page/grafanaFrames.js'], 'GrafanaTableExportFrames');

/**
 * A Grafana DataFrame with a time, a number and a text column, as Explore holds it.
 * `display` adds a unit, the way a field config does.
 */
function sampleFrame() {
  return {
    refId: 'A',
    length: 2,
    meta: { executedQueryString: 'SELECT time, size, name FROM tables' },
    fields: [
      { name: 'time', type: 'time', values: [Date.UTC(2026, 10, 17, 9, 0, 0), null] },
      {
        name: 'size',
        type: 'number',
        config: { displayName: 'Size' },
        values: [2048, 512],
        display: (/** @type {number} */ value) => ({ text: String(value / 1024), suffix: ' KiB' }),
      },
      { name: 'name', type: 'string', state: { displayName: 'Table name' }, values: { toArray: () => ['revisions', { a: 1 }] } },
    ],
  };
}

test('findDataFrame walks up the React fiber tree to the first data frame prop', () => {
  const frame = sampleFrame();
  const fiber = {
    memoizedProps: { role: 'table' },
    return: { memoizedProps: { data: { other: true } }, return: { memoizedProps: { data: frame } } },
  };
  const element = { className: 'table', __reactFiber$abc123: fiber };
  assert.equal(frames.findDataFrame(element), frame);
});

test('findDataFrame returns null without a React fiber or without a frame', () => {
  assert.equal(frames.findDataFrame({}), null);
  assert.equal(frames.findDataFrame({ __reactFiber$x: { memoizedProps: {}, return: null } }), null);
});

test('frameToTable gives the formatted values, as the table shows them', () => {
  assert.deepEqual(plain(frames.frameToTable(sampleFrame(), true)), {
    columns: ['time', 'Size', 'Table name'],
    rows: [
      ['2026-11-17T09:00:00.000Z', '2 KiB', 'revisions'],
      ['', '0.5 KiB', '{"a":1}'],
    ],
  });
});

test('frameToTable gives the raw values, with times as ISO 8601 text', () => {
  assert.deepEqual(plain(frames.frameToTable(sampleFrame(), false).rows), [
    ['2026-11-17T09:00:00.000Z', '2048', 'revisions'],
    ['', '512', '{"a":1}'],
  ]);
});

test('frameToTable falls back to the raw value when display fails', () => {
  const frame = {
    fields: [
      {
        name: 'n',
        values: [7],
        display: () => {
          throw new Error('no display');
        },
      },
    ],
  };
  assert.deepEqual(plain(frames.frameToTable(frame, true)), { columns: ['n'], rows: [['7']] });
});

test('executedQuery and fileName read the frame', () => {
  assert.equal(frames.executedQuery(sampleFrame()), 'SELECT time, size, name FROM tables');
  assert.equal(frames.executedQuery({ fields: [] }), '');
  const now = new Date(Date.UTC(2026, 10, 17, 9, 12, 45));
  assert.equal(frames.fileName(sampleFrame(), now, 'csv'), 'grafana-A-2026-11-17T09-12-45.csv');
  assert.equal(frames.fileName({ fields: [], refId: 'a b' }, now, 'md'), 'grafana-a_b-2026-11-17T09-12-45.md');
  assert.equal(frames.fileName({ fields: [] }, now, 'md'), 'grafana-result-2026-11-17T09-12-45.md');
});

/**
 * The Explore page of Grafana 12.4 and later: the table panel holds a react-data-grid.
 * @param {object[]} paneFrames One frame for each pane. A pane with no frame renders no table.
 * @returns {FakeElement} The Explore container.
 */
function explorePage(paneFrames) {
  return new FakeElement({
    attributes: { 'data-testid': 'data-testid Explore' },
    children: paneFrames.map(
      (frame) =>
        new FakeElement({
          attributes: { 'data-testid': 'data-testid Panel header Table' },
          children: [
            new FakeElement({ attributes: { 'data-testid': 'data-testid header-container' }, text: 'Table' }),
            new FakeElement({
              attributes: { 'data-testid': 'data-testid panel content' },
              children: [
                new FakeElement({ attributes: { role: 'grid', 'aria-rowcount': '2' }, frame }),
                // react-data-grid renders a second, hidden grid to measure the scrollbar.
                new FakeElement({ attributes: { role: 'grid' } }),
              ],
            }),
          ],
        }),
    ),
  });
}

test('findTables finds the table of Grafana 12.4 and later, and skips the grid that measures', () => {
  const frame = sampleFrame();
  const found = frames.findTables(explorePage([frame]));
  assert.equal(found.length, 1);
  assert.equal(frames.findDataFrame(found[0]), frame);
});

test('findTables finds one table for each pane of a split view', () => {
  assert.equal(frames.findTables(explorePage([sampleFrame(), sampleFrame()])).length, 2);
});

test('findTables finds the table of Grafana 12.3 and earlier by its label', () => {
  const table = new FakeElement({ attributes: { role: 'table', 'aria-label': 'Explore Table' }, frame: sampleFrame() });
  const page = new FakeElement({ children: [table] });
  assert.equal(frames.findTables(page).at(0), table);
});

test('findTables keeps the outer element when a label holds a grid', () => {
  const grid = new FakeElement({ attributes: { role: 'grid' }, frame: sampleFrame() });
  const labelled = new FakeElement({ attributes: { 'aria-label': 'Explore Table' }, frame: sampleFrame(), children: [grid] });
  // Both elements are tables on their own: the grid sits in Explore, and the label needs no Explore.
  const page = new FakeElement({ attributes: { 'data-testid': 'data-testid Explore' }, children: [labelled] });
  const found = frames.findTables(page);
  assert.equal(found.length, 1);
  assert.equal(found.at(0), labelled);
});

test('findTables keeps a labelled table that carries no frame, so the export can report the error', () => {
  const table = new FakeElement({ attributes: { 'aria-label': 'Explore Table' } });
  const page = new FakeElement({ children: [table] });
  assert.equal(frames.findTables(page).at(0), table);
});

/**
 * A Grafana dashboard of 12.4 and later. Each panel is a section with a title bar and the menu
 * button of Grafana. A panel with no title keeps the section and gets the hover header instead.
 * @param {Array<{ frame?: object, title?: string }>} panels One entry for each panel.
 * @returns {FakeElement} The dashboard element.
 */
function dashboardPage(panels) {
  return new FakeElement({
    attributes: { 'data-testid': 'data-testid dashboard' },
    children: panels.map(({ frame, title = 'Orders' }) => {
      const titled = title !== '';
      return new FakeElement({
        attributes: { 'data-testid': `data-testid Panel header ${title}` },
        children: [
          new FakeElement({
            attributes: { 'data-testid': titled ? 'data-testid header-container' : 'data-testid hover-header-container' },
            text: title,
            children: [
              new FakeElement({
                attributes: { 'data-testid': titled ? `data-testid Panel menu ${title}` : 'panel-menu-button' },
              }),
            ],
          }),
          new FakeElement({
            attributes: { 'data-testid': 'data-testid panel content' },
            children: [
              new FakeElement({ attributes: { role: 'grid', 'aria-rowcount': '2' }, frame }),
              // react-data-grid renders a second, hidden grid to measure the scrollbar.
              new FakeElement({ attributes: { role: 'grid' } }),
            ],
          }),
        ],
      });
    }),
  });
}

test('findTables finds the table panel of a dashboard, one for each panel', () => {
  const page = dashboardPage([{ frame: sampleFrame(), title: 'Orders' }, { frame: sampleFrame(), title: '' }, {}]);
  const found = frames.findTables(page);
  // Two panels carry a frame. The third one carries none, and each panel holds a hidden second grid.
  assert.equal(found.length, 2);
  found.forEach((/** @type {object} */ table) => assert.notEqual(frames.findDataFrame(table), null));
});

test('findTables skips the table of the panel inspector, which sits outside every section', () => {
  const drawer = new FakeElement({
    attributes: { 'data-testid': 'data-testid Panel inspector Data content' },
    children: [new FakeElement({ attributes: { role: 'grid' }, frame: sampleFrame() })],
  });
  const page = new FakeElement({ attributes: { 'data-testid': 'data-testid dashboard' }, children: [drawer] });
  assert.equal(frames.findTables(page).length, 0);
});

test('showsButtonAtRest is true in Explore and false in a dashboard', () => {
  assert.equal(frames.showsButtonAtRest(frames.findTables(explorePage([sampleFrame()]))[0]), true);
  assert.equal(frames.showsButtonAtRest(frames.findTables(dashboardPage([{ frame: sampleFrame() }]))[0]), false);
});

test('showsButtonAtRest is true for the labelled table of Grafana 12.3, which needs no Explore above it', () => {
  const table = new FakeElement({ attributes: { 'aria-label': 'Explore Table' }, frame: sampleFrame() });
  new FakeElement({ attributes: { 'data-testid': 'data-testid dashboard' }, children: [table] });
  assert.equal(frames.showsButtonAtRest(table), true);
});

test('menuButtonOf finds the menu button of Grafana, with a title and without one', () => {
  for (const title of ['Orders', '']) {
    const page = dashboardPage([{ frame: sampleFrame(), title }]);
    const titleBar = frames.sectionOf(frames.findTables(page)[0]).children[0];
    assert.equal(frames.menuButtonOf(titleBar), titleBar.children[0]);
  }
});

test('menuButtonOf gives null where Grafana draws no menu button, such as Explore', () => {
  const page = explorePage([sampleFrame()]);
  assert.equal(frames.menuButtonOf(frames.sectionOf(frames.findTables(page)[0])), null);
});

test('rightOffset leaves room for the menu button of Grafana', () => {
  // Explore draws no menu button, so the Export button keeps the edge of the panel.
  assert.equal(frames.rightOffset(287, null), 8);
  // A dashboard panel: the menu button ends 9 pixels from the right edge, and is 20 wide.
  assert.equal(frames.rightOffset(287, { left: 258, width: 20 }), 35);
  // Grafana hides the menu button of a panel with no title, and a hidden box can measure zero.
  assert.equal(frames.rightOffset(287, { left: 0, width: 0 }), 34);
  // A menu button at the right edge of the host, or past it, still leaves the smallest gap.
  assert.equal(frames.rightOffset(287, { left: 290, width: 20 }), 8);
});

test('findTables finds nothing on a page with no result', () => {
  assert.equal(frames.findTables(explorePage([])).length, 0);
});

test('titleBarOf takes the title bar of the panel of this table, not of the panel above it', () => {
  const graphTitle = new FakeElement({ attributes: { 'data-testid': 'data-testid header-container' }, text: 'Graph' });
  const graph = new FakeElement({ attributes: { 'data-testid': 'data-testid panel content' } });
  const tableTitle = new FakeElement({ attributes: { 'data-testid': 'data-testid header-container' }, text: 'Table' });
  const table = new FakeElement({ attributes: { 'data-testid': 'data-testid panel content' } });
  const pane = new FakeElement({ children: [graphTitle, graph, tableTitle, table] });
  assert.equal(frames.titleBarOf(pane, table), tableTitle);
});

test('titleBarOf takes the nearest title bar when every title is translated', () => {
  const graphTitle = new FakeElement({ attributes: { 'data-testid': 'data-testid header-container' }, text: 'Gráfico' });
  const graph = new FakeElement({ attributes: { 'data-testid': 'data-testid panel content' } });
  const tableTitle = new FakeElement({ attributes: { 'data-testid': 'data-testid header-container' }, text: 'Tabla' });
  const table = new FakeElement({ attributes: { 'data-testid': 'data-testid panel content' } });
  const pane = new FakeElement({ children: [graphTitle, graph, tableTitle, table] });
  assert.equal(frames.titleBarOf(pane, table), tableTitle);
});

test('titleBarOf takes the title bar by its test id when the title is translated', () => {
  const title = new FakeElement({ attributes: { 'data-testid': 'header-container' }, text: 'Tabla' });
  const content = new FakeElement({ attributes: { 'data-testid': 'data-testid panel content' } });
  const section = new FakeElement({ children: [title, content] });
  assert.equal(frames.titleBarOf(section, content), title);
});

test('titleBarOf reads the text of the elements below the sibling', () => {
  const title = new FakeElement({ children: [new FakeElement({ text: 'Table - orders' })] });
  const content = new FakeElement({});
  const section = new FakeElement({ children: [title, content] });
  assert.equal(frames.titleBarOf(section, content), title);
});

test('tablesOfOtherSections gives the table of the other pane of a split view', () => {
  const page = explorePage([sampleFrame(), sampleFrame()]);
  const [first, second] = frames.findTables(page);
  assert.equal(frames.tablesOfOtherSections(first, [first, second]).at(0), second);
});

test('tablesOfOtherSections ignores a second table of the same section', () => {
  const page = explorePage([sampleFrame()]);
  const table = frames.findTables(page).at(0);
  // A second grid of the same section, such as one that a later Grafana draws beside the first.
  const twin = new FakeElement({ attributes: { role: 'grid' }, frame: sampleFrame() });
  twin.parentElement = table.parentElement;
  table.parentElement.children.push(twin);
  assert.equal(frames.tablesOfOtherSections(table, [table, twin]).length, 0);
});

test('tablesOfOtherSections counts every other table when the page has no section', () => {
  const first = new FakeElement({ attributes: { 'aria-label': 'Explore Table' } });
  const second = new FakeElement({ attributes: { 'aria-label': 'Explore Table' } });
  new FakeElement({ children: [first, second] });
  assert.equal(frames.tablesOfOtherSections(first, [first, second]).at(0), second);
});

test('titleBarOf gives null with no title bar, and looks at no sibling after the branch', () => {
  const content = new FakeElement({});
  const late = new FakeElement({ attributes: { 'data-testid': 'data-testid header-container' }, text: 'Table' });
  const section = new FakeElement({ children: [new FakeElement({ text: 'Graph' }), content, late] });
  assert.equal(frames.titleBarOf(section, content), null);
});
