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
 * @param {object[]} frames One frame for each pane. A pane with no frame renders no table.
 * @returns {FakeElement} The Explore container.
 */
function explorePage(frames) {
  return new FakeElement({
    attributes: { 'data-testid': 'data-testid Explore' },
    children: frames.map(
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

test('findTables skips a table panel outside Explore, such as one in a dashboard', () => {
  const dashboard = new FakeElement({
    attributes: { 'data-testid': 'data-testid dashboard' },
    children: [new FakeElement({ attributes: { role: 'grid' }, frame: sampleFrame() })],
  });
  assert.equal(frames.findTables(dashboard).length, 0);
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

test('titleBarOf gives null with no title bar, and looks at no sibling after the branch', () => {
  const content = new FakeElement({});
  const late = new FakeElement({ attributes: { 'data-testid': 'data-testid header-container' }, text: 'Table' });
  const section = new FakeElement({ children: [new FakeElement({ text: 'Graph' }), content, late] });
  assert.equal(frames.titleBarOf(section, content), null);
});
