// Page script (classic, MAIN world): it shares one global scope with the other page scripts.
// The only file that knows Grafana's shapes: the data frame, and the elements that hold it.
// It reads plain objects and plain elements, so Node tests it with the fake DOM of `test/support/`.

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
  // Explore and a dashboard draw the same table panel. Explore shows the Export button at all times,
  // a dashboard only while the mouse is over the panel.
  const EXPLORE_SELECTOR = '[data-testid="data-testid Explore"]';
  // The menu button that Grafana draws in the title bar of a dashboard panel. Never match it by its
  // `aria-label`: Grafana translates that label. A panel with no title gets the second test id.
  const MENU_BUTTON_SELECTOR = '[data-testid^="data-testid Panel menu"], [data-testid="panel-menu-button"]';
  // The Export button sits this far from the right edge of the section, and this far from the menu button.
  const EDGE_GAP = 8;
  const BUTTON_GAP = 6;
  // Grafana hides the menu button of a panel with no title, so it measures 0. Reserve its real size.
  const MENU_BUTTON_WIDTH = 20;
  // The section of the table. Grafana 12.3 and earlier named it `section-wrapper-Table`. Grafana 12.4
  // and later name it `data-testid Panel header <title>`.
  const SECTION_SELECTOR = '[data-testid^="section-wrapper-Table"], [data-testid^="data-testid Panel header"]';
  // The title bar of the section. Grafana 11 named it `header-container`. Grafana 12 and later name it
  // `data-testid header-container`.
  const TITLE_BAR_SELECTOR = '[data-testid$="header-container"]';
  // The title that Explore gives the panel: "Table", or "Table - <name>" with more than one frame.
  const TITLE_PATTERN = /^Table\b/;

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
   * @param {object} tableElement A table element that `findTables` returned.
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
   * @returns {boolean} `true` when the element is a result table that gets an Export button.
   */
  function isResultTable(element) {
    // The label named the result table of Explore by itself. Keep such a table even when it carries no
    // frame, so a change to the data shape shows the error of the export, not a button that never comes.
    if (element.matches(LABELLED_TABLE_SELECTOR)) return true;
    // The table of a panel, in Explore or in a dashboard. The panel inspector draws its own grid in a
    // drawer outside every section, so it gets no button. react-data-grid draws a second, hidden grid
    // to measure the scrollbar: it carries no React fiber, so the walk up finds no frame.
    const inPanel = sectionOf(element) !== null || element.closest(EXPLORE_SELECTOR) !== null;
    return inPanel && findDataFrame(element) !== null;
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

  /**
   * The title bar of the section, among the siblings before the branch that holds the table.
   * The text comes first: one level can hold the title bar of two sections, and only the text tells
   * them apart. The test id comes second, because a translated interface reads "Tabla" or "Tabelle".
   * Each rule takes the last match, which is the title bar nearest to the table.
   * @param {Element} level
   * @param {Element} branch The child of `level` that holds the table.
   * @returns {Element | null}
   */
  function titleBarOf(level, branch) {
    /** @type {Element | null} */
    let byText = null;
    /** @type {Element | null} */
    let byTestId = null;
    for (const sibling of level.children) {
      if (sibling === branch) break;
      if (TITLE_PATTERN.test((sibling.textContent ?? '').trim())) byText = sibling;
      else if (sibling.matches(TITLE_BAR_SELECTOR)) byTestId = sibling;
    }
    return byText ?? byTestId;
  }

  /**
   * @param {Element} tableElement
   * @returns {Element | null} The section of Grafana that holds the table, with its title bar.
   */
  function sectionOf(tableElement) {
    return tableElement.closest(SECTION_SELECTOR);
  }

  /**
   * The result tables that belong to another section. One pane of a split view is one section.
   * Two tables in one section share one Export button, so neither one stops the walk up of the other.
   * @param {Element} tableElement
   * @param {Element[]} tables Every result table of the page.
   * @returns {Element[]}
   */
  function tablesOfOtherSections(tableElement, tables) {
    const section = sectionOf(tableElement);
    return tables.filter((table) => table !== tableElement && (section === null || !section.contains(table)));
  }

  /**
   * Explore gives the table one job, so its button stays visible. A dashboard panel holds a chart as
   * often as a table, and Grafana hides its own controls there until the mouse is over the panel.
   * @param {Element} tableElement
   * @returns {boolean} `true` when the button shows with no mouse over the panel and no focus in it.
   */
  function showsButtonAtRest(tableElement) {
    return tableElement.closest(EXPLORE_SELECTOR) !== null;
  }

  /**
   * @param {Element} element The title bar of the section, or the section.
   * @returns {Element | null} The menu button that Grafana draws in the title bar.
   */
  function menuButtonOf(element) {
    return element.querySelectorAll(MENU_BUTTON_SELECTOR)[0] ?? null;
  }

  /**
   * The Export button must never cover the menu button of Grafana, whatever the padding of the host,
   * the zoom of the browser or the theme. So measure the two boxes, never trust a fixed size.
   * @param {number} hostRight The right edge of the host of the button, from `getBoundingClientRect`.
   * @param {{ left: number, width: number } | null} menuButton Its box, or `null` with no menu button.
   * @returns {number} The space in pixels between the Export button and the right edge of the host.
   */
  function rightOffset(hostRight, menuButton) {
    if (menuButton === null) return EDGE_GAP;
    // Grafana hides the menu button of a panel with no title, and a hidden box can measure zero.
    if (menuButton.width === 0) return EDGE_GAP + MENU_BUTTON_WIDTH + BUTTON_GAP;
    return Math.max(EDGE_GAP, Math.round(hostRight - menuButton.left) + BUTTON_GAP);
  }

  return {
    findTables,
    sectionOf,
    tablesOfOtherSections,
    titleBarOf,
    showsButtonAtRest,
    menuButtonOf,
    rightOffset,
    findDataFrame,
    frameToTable,
    executedQuery,
    fileName,
  };
})();
