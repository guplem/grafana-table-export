// Page script (classic, MAIN world): it shares one global scope with the other page scripts.
// The only file that knows Grafana's data shapes. Pure logic over plain objects, so Node tests it.

/**
 * One column of a Grafana DataFrame. Only the parts that the export reads.
 * @typedef {object} GrafanaField
 * @property {string} name
 * @property {string} [type] Such as `string`, `number` or `time`.
 * @property {unknown} values A plain array in Grafana 10 and later, an object with `toArray()` before.
 * @property {{ displayName?: string }} [config]
 * @property {{ displayName?: string } | null} [state]
 * @property {(value: unknown) => { text?: string, prefix?: string, suffix?: string }} [display]
 */

/**
 * The result of one query, as the Explore table holds it.
 * @typedef {object} GrafanaDataFrame
 * @property {GrafanaField[]} fields
 * @property {string} [refId]
 * @property {number} [length]
 * @property {{ executedQueryString?: string }} [meta]
 */

const GrafanaTableExportFrames = (() => {
  // The data frame sits a few components above the table element. The limit stops a walk to the root.
  const MAX_FIBER_DEPTH = 40;

  // Grafana 12.3 and earlier: Explore rendered its own table, with this label on it.
  const LABELLED_TABLE_SELECTOR = '[aria-label="Explore Table"]';
  // Grafana 12.4 and later: Explore renders the table panel, which draws a react-data-grid.
  const GRID_SELECTOR = '[role="grid"]';
  const TABLE_SELECTOR = `${LABELLED_TABLE_SELECTOR}, ${GRID_SELECTOR}`;
  // The table panel also runs in a dashboard. Only Explore gets an Export button.
  const EXPLORE_SELECTOR = '[data-testid="data-testid Explore"]';

  /**
   * @param {unknown} value
   * @returns {value is GrafanaDataFrame}
   */
  function isDataFrame(value) {
    return typeof value === 'object' && value !== null && Array.isArray(/** @type {{ fields?: unknown }} */ (value).fields);
  }

  /**
   * The DOM holds only the visible rows, so read the full frame from the React props of the table.
   * Match the prop shape, never a component name: Grafana minifies the names and they change in each build.
   * @param {object} tableElement The `[aria-label="Explore Table"]` element.
   * @returns {GrafanaDataFrame | null}
   */
  function findDataFrame(tableElement) {
    const fiberKey = Object.keys(tableElement).find((key) => key.startsWith('__reactFiber$'));
    /** @type {{ memoizedProps?: { data?: unknown }, return?: unknown } | undefined} */
    let fiber = fiberKey === undefined ? undefined : /** @type {Record<string, any>} */ (tableElement)[fiberKey];
    for (let depth = 0; fiber && depth < MAX_FIBER_DEPTH; depth++) {
      const data = fiber.memoizedProps?.data;
      if (isDataFrame(data)) return data;
      fiber = /** @type {typeof fiber} */ (fiber.return);
    }
    return null;
  }

  /**
   * @param {GrafanaField} field
   * @returns {unknown[]}
   */
  function valuesOf(field) {
    const values = /** @type {any} */ (field.values);
    if (Array.isArray(values)) return values;
    if (values && typeof values.toArray === 'function') return values.toArray();
    return Array.from(values ?? []);
  }

  /**
   * @param {GrafanaField} field
   * @returns {string}
   */
  function columnName(field) {
    return field.state?.displayName || field.config?.displayName || field.name;
  }

  /**
   * @param {GrafanaField} field
   * @param {unknown} value
   * @returns {string}
   */
  function rawText(field, value) {
    if (value === null || value === undefined) return '';
    if (field.type === 'time' && typeof value === 'number') return new Date(value).toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  /**
   * The value as the table shows it, with the unit and the date format of the panel.
   * @param {GrafanaField} field
   * @param {unknown} value
   * @returns {string}
   */
  function formattedText(field, value) {
    if (value === null || value === undefined) return '';
    if (typeof field.display !== 'function') return rawText(field, value);
    try {
      const shown = field.display(value);
      return (shown.prefix ?? '') + (shown.text ?? '') + (shown.suffix ?? '');
    } catch {
      return rawText(field, value);
    }
  }

  /**
   * @param {GrafanaDataFrame} frame
   * @param {boolean} formatted `true` for the values as shown, `false` for the raw values.
   * @returns {ExportTable}
   */
  function frameToTable(frame, formatted) {
    const columnValues = frame.fields.map(valuesOf);
    const length = frame.length ?? Math.max(0, ...columnValues.map((values) => values.length));
    const toText = formatted ? formattedText : rawText;
    /** @type {string[][]} */
    const rows = [];
    for (let row = 0; row < length; row++) {
      rows.push(frame.fields.map((field, column) => toText(field, columnValues[column]?.[row])));
    }
    return { columns: frame.fields.map(columnName), rows };
  }

  /**
   * @param {GrafanaDataFrame} frame
   * @returns {string} The query that produced the frame, or an empty string.
   */
  function executedQuery(frame) {
    return frame.meta?.executedQueryString ?? '';
  }

  /**
   * @param {GrafanaDataFrame} frame
   * @param {Date} now
   * @param {string} extension
   * @returns {string} Such as `grafana-A-2026-11-17T09-12-45.csv`.
   */
  function fileName(frame, now, extension) {
    const stamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const refId = (frame.refId || 'result').replace(/[^\w-]+/g, '_');
    return `grafana-${refId}-${stamp}.${extension}`;
  }

  /**
   * @param {Element} element An element that `TABLE_SELECTOR` matched.
   * @returns {boolean} `true` when the element is a result table of Explore.
   */
  function isResultTable(element) {
    // The label named Explore by itself. The grid does not, and a dashboard draws the same grid.
    if (!element.matches(LABELLED_TABLE_SELECTOR) && element.closest(EXPLORE_SELECTOR) === null) return false;
    // react-data-grid draws a second, hidden grid to measure the scrollbar. No React props stand behind it.
    return findDataFrame(element) !== null;
  }

  /**
   * The result tables inside `root`, one for each table that the person sees.
   * @param {ParentNode} root The document, or one element of it.
   * @returns {Element[]}
   */
  function findTables(root) {
    const tables = [...root.querySelectorAll(TABLE_SELECTOR)].filter(isResultTable);
    // One table can match twice, such as a labelled wrapper around a grid. Keep the outer element.
    return tables.filter((table) => !tables.some((other) => other !== table && other.contains(table)));
  }

  return { findTables, findDataFrame, frameToTable, executedQuery, fileName };
})();
