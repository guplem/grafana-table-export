import assert from 'node:assert/strict';
import { test } from 'node:test';

import { loadPageScripts } from './support/pageScripts.js';

const formats = loadPageScripts(['src/page/exportFormats.js'], 'GrafanaTableExportFormats');

/** An EXPLAIN ANALYZE result: one text column whose leading spaces carry the plan tree. */
const plan = {
  columns: ['QUERY PLAN'],
  rows: [['Aggregate (cost=1..2 rows=1)'], ['  ->  Sort (cost=3..4)'], ['        Sort Key: a, "b"']],
};
const tricky = {
  columns: ['name', 'note'],
  rows: [
    ['a|b', 'line1\nline2'],
    ['x,y', 'say "hi"'],
  ],
};

test('the menu lists Markdown first', () => {
  assert.equal(Object.keys(formats.FORMATS)[0], 'markdown');
});

test('CSV quotes commas, quotes, line breaks and edge spaces', () => {
  assert.equal(formats.toCsv(tricky, ''), 'name,note\r\na|b,"line1\nline2"\r\n"x,y","say ""hi"""\r\n');
  assert.match(formats.toCsv(plan, ''), /\r\n" {2}-> {2}Sort \(cost=3\.\.4\)"\r\n/);
});

test('TSV turns tabs and line breaks into spaces', () => {
  assert.equal(formats.toTsv(tricky, ''), 'name\tnote\na|b\tline1 line2\nx,y\tsay "hi"\n');
});

test('Markdown escapes pipes, keeps line breaks and leading spaces', () => {
  assert.match(formats.toMarkdown(tricky, ''), /\| a\\\|b \| line1<br>line2 \|/);
  assert.match(formats.toMarkdown(plan, ''), /\| &nbsp;&nbsp;-> {2}Sort/);
});

test('Markdown puts the query in a sql block only when one is given', () => {
  assert.match(formats.toMarkdown(plan, ' SELECT 1 '), /^```sql\nSELECT 1\n```\n\n\| QUERY PLAN \|/);
  assert.match(formats.toMarkdown(plan, '  '), /^\| QUERY PLAN \|/);
});

test('JSON is an array of row objects', () => {
  assert.deepEqual(JSON.parse(formats.toJson(tricky, '')), [
    { name: 'a|b', note: 'line1\nline2' },
    { name: 'x,y', note: 'say "hi"' },
  ]);
});

test('the plain-text table aligns the columns and keeps every space', () => {
  const lines = formats.toTextTable(plan, '').trimEnd().split('\n');
  assert.equal(lines[0], 'QUERY PLAN');
  assert.equal(lines[3], '  ->  Sort (cost=3..4)');
  assert.equal(formats.toTextTable({ columns: ['a', 'bbb'], rows: [['xxxx', 'y']] }, ''), 'a    | bbb\n-----+----\nxxxx | y\n');
});

test('every format handles a table with no rows', () => {
  const empty = { columns: ['count'], rows: [] };
  assert.equal(formats.toCsv(empty, ''), 'count\r\n');
  assert.equal(formats.toTsv(empty, ''), 'count\n');
  assert.equal(formats.toMarkdown(empty, ''), '| count |\n| --- |\n');
  assert.equal(formats.toJson(empty, ''), '[]\n');
  assert.equal(formats.toTextTable(empty, ''), 'count\n-----\n');
});
