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

  return { findDataFrame, frameToTable, executedQuery, fileName };
})();
