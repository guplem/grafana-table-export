import assert from 'node:assert/strict';
import { test } from 'node:test';

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
