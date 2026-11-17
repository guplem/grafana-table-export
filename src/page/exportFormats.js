// Page script (classic, MAIN world): it shares one global scope with the other page scripts.
// Pure logic: it turns a table of strings into the text of each export format.

/**
 * A table where every cell is already a string.
 * @typedef {{ columns: string[], rows: string[][] }} ExportTable
 */

/**
 * @typedef {object} ExportFormat
 * @property {string} label The name in the menu.
 * @property {string} extension The file extension, without the dot.
 * @property {string} mimeType
 * @property {(table: ExportTable, query: string) => string} build `query` is the SQL to show, or an empty string.
 */

const GrafanaTableExportFormats = (() => {
  /**
   * @param {string} value
   * @returns {string}
   */
  function csvCell(value) {
    // RFC 4180: quote a cell with a comma, a quote or a line break. Also quote edge spaces, which some readers trim.
    const needsQuotes = /[",\r\n]/.test(value) || /^\s|\s$/.test(value);
    return needsQuotes ? `"${value.replace(/"/g, '""')}"` : value;
  }

  /** @type {ExportFormat['build']} */
  function toCsv(table) {
    return [table.columns, ...table.rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }

  /** @type {ExportFormat['build']} */
  function toTsv(table) {
    // A TSV cell cannot hold a tab or a line break.
    /** @param {string} value */
    const clean = (value) => value.replace(/[\t\r\n]+/g, ' ');
    return [table.columns, ...table.rows].map((row) => row.map(clean).join('\t')).join('\n') + '\n';
  }

  /**
   * @param {string} value
   * @returns {string}
   */
  function markdownCell(value) {
    return (
      value
        .replace(/\\/g, '\\\\')
        .replace(/\|/g, '\\|')
        .replace(/\r?\n/g, '<br>')
        // Markdown trims the edges of a cell, so leading spaces become non-breaking spaces.
        .replace(/^ +/, (spaces) => '&nbsp;'.repeat(spaces.length))
    );
  }

  /** @type {ExportFormat['build']} */
  function toMarkdown(table, query) {
    /** @type {string[]} */
    const lines = [];
    if (query.trim() !== '') lines.push('```sql', query.trim(), '```', '');
    const header = table.columns.map(markdownCell);
    lines.push(`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`);
    for (const row of table.rows) lines.push(`| ${row.map(markdownCell).join(' | ')} |`);
    return lines.join('\n') + '\n';
  }

  /** @type {ExportFormat['build']} */
  function toJson(table) {
    const objects = table.rows.map((row) => Object.fromEntries(table.columns.map((name, index) => [name, row[index] ?? ''])));
    return JSON.stringify(objects, null, 2) + '\n';
  }

  /** @type {ExportFormat['build']} */
  function toTextTable(table) {
    // A fixed-width table, as psql prints it. It keeps every space, which matters for EXPLAIN output.
    /** @param {string} value */
    const flat = (value) => value.replace(/\r?\n/g, ' ');
    const all = [table.columns, ...table.rows].map((row) => row.map(flat));
    const widths = table.columns.map((_, column) => Math.max(...all.map((row) => (row[column] ?? '').length)));
    /** @param {string[]} row */
    const line = (row) =>
      widths
        .map((width, column) => (row[column] ?? '').padEnd(width))
        .join(' | ')
        .trimEnd();
    const separator = widths.map((width) => '-'.repeat(width)).join('-+-');
    return [line(all[0] ?? []), separator, ...all.slice(1).map(line)].join('\n') + '\n';
  }

  /** The menu shows the formats in this order. */
  /** @type {Readonly<Record<string, ExportFormat>>} */
  const FORMATS = {
    markdown: { label: 'Markdown table', extension: 'md', mimeType: 'text/markdown', build: toMarkdown },
    csv: { label: 'CSV', extension: 'csv', mimeType: 'text/csv', build: toCsv },
    tsv: { label: 'TSV (paste into Sheets / Excel)', extension: 'tsv', mimeType: 'text/tab-separated-values', build: toTsv },
    json: { label: 'JSON', extension: 'json', mimeType: 'application/json', build: toJson },
    text: { label: 'Plain-text table', extension: 'txt', mimeType: 'text/plain', build: toTextTable },
  };

  return { FORMATS, toCsv, toTsv, toMarkdown, toJson, toTextTable };
})();
