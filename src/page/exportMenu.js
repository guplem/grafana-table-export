// Page script (classic, MAIN world): it shares one global scope with the other page scripts.
// The Export button, its menu, and the copy and download actions. All DOM work lives here.

const GrafanaTableExportMenu = (() => {
  // The panel of the table. Grafana 12.3 and earlier named it `section-wrapper-Table`.
  const SECTION_SELECTOR = '[data-testid^="section-wrapper-Table"], [data-testid^="data-testid Panel header"]';
  // The title bar of the panel. Grafana 11 named it `header-container`, Grafana 12 and later `data-testid header-container`.
  const HEADER_SELECTOR = '[data-testid$="header-container"]';
  const BUTTON_MARK = 'data-grafana-table-export';
  /** How many levels above the table the title bar and the button can be. */
  const MAX_SECTION_DEPTH = 12;
  /** The mark of the button before version 0.1.0. */
  const LEGACY_BUTTON_MARK = 'data-gte-export';
  const PREFERENCES_KEY = 'grafanaTableExport.preferences';
  const FONT = '13px/1.4 Inter, Helvetica, Arial, sans-serif';

  /** @typedef {{ formatted: boolean, includeQuery: boolean }} Preferences */

  /** @type {Preferences} */
  const DEFAULT_PREFERENCES = { formatted: true, includeQuery: false };

  /** @returns {Preferences} */
  function loadPreferences() {
    try {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(localStorage.getItem(PREFERENCES_KEY) ?? '{}') };
    } catch {
      return { ...DEFAULT_PREFERENCES };
    }
  }

  /** @param {Preferences} preferences */
  function savePreferences(preferences) {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
    } catch {
      // A page can block storage. The defaults still work.
    }
  }

  /**
   * @param {string} message
   * @param {boolean} isError
   */
  function toast(message, isError) {
    const element = document.createElement('div');
    element.textContent = message;
    element.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'right:24px',
      'z-index:2147483647',
      'padding:8px 14px',
      'border-radius:4px',
      `font:${FONT}`,
      'color:#fff',
      `background:${isError ? '#c4314b' : '#1f7a3f'}`,
      'box-shadow:0 4px 12px rgba(0,0,0,.35)',
    ].join(';');
    document.body.appendChild(element);
    setTimeout(() => element.remove(), 2500);
  }

  /**
   * @param {string} text
   * @param {string} name
   * @param {string} mimeType
   */
  function download(text, name, mimeType) {
    const url = URL.createObjectURL(new Blob([text], { type: `${mimeType};charset=utf-8` }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  /**
   * @param {string} text
   * @returns {Promise<boolean>}
   */
  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Some pages block the Clipboard API. The old copy command still works there.
      const area = document.createElement('textarea');
      area.value = text;
      area.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand('copy');
      area.remove();
      return copied;
    }
  }

  /**
   * @param {Element} tableElement
   * @param {string} formatKey
   * @param {'copy' | 'download'} action
   */
  function runExport(tableElement, formatKey, action) {
    const frame = GrafanaTableExportFrames.findDataFrame(tableElement);
    const format = GrafanaTableExportFormats.FORMATS[formatKey];
    if (frame === null || format === undefined) {
      toast('Table Export: could not read the table data.', true);
      return;
    }
    const preferences = loadPreferences();
    const table = GrafanaTableExportFrames.frameToTable(frame, preferences.formatted);
    const query = preferences.includeQuery ? GrafanaTableExportFrames.executedQuery(frame) : '';
    const text = format.build(table, query);
    const rows = `${table.rows.length} row${table.rows.length === 1 ? '' : 's'}`;
    if (action === 'copy') {
      void copy(text).then((copied) => toast(copied ? `Copied ${rows} as ${format.label}` : 'Copy failed', !copied));
    } else {
      download(text, GrafanaTableExportFrames.fileName(frame, new Date(), format.extension), format.mimeType);
      toast(`Downloaded ${rows} as ${format.extension.toUpperCase()}`, false);
    }
  }

  /**
   * @param {string} text
   * @param {string} title
   * @returns {HTMLButtonElement}
   */
  function smallButton(text, title) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = text;
    button.title = title;
    button.style.cssText = [
      'cursor:pointer',
      'padding:2px 8px',
      'border-radius:3px',
      'font:inherit',
      'font-size:12px',
      'color:inherit',
      'background:rgba(128,128,128,.15)',
      'border:1px solid rgba(128,128,128,.4)',
    ].join(';');
    button.addEventListener('mouseenter', () => (button.style.background = 'rgba(128,128,128,.3)'));
    button.addEventListener('mouseleave', () => (button.style.background = 'rgba(128,128,128,.15)'));
    return button;
  }

  /**
   * @param {string} label
   * @param {boolean} checked
   * @param {(checked: boolean) => void} onChange
   * @returns {HTMLLabelElement}
   */
  function checkbox(label, checked, onChange) {
    const row = document.createElement('label');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;padding:2px 0';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    row.append(input, document.createTextNode(label));
    return row;
  }

  /**
   * @param {Element} tableElement
   * @param {() => void} close
   * @returns {HTMLDivElement}
   */
  function buildMenu(tableElement, close) {
    const bodyStyle = getComputedStyle(document.body);
    const menu = document.createElement('div');
    menu.style.cssText = [
      // Fixed on document.body: the table section clips its children (overflow: hidden).
      'position:fixed',
      'z-index:2147483646',
      'min-width:300px',
      'overflow-y:auto',
      'box-sizing:border-box',
      'padding:8px 10px',
      'border-radius:4px',
      `background:${bodyStyle.backgroundColor || '#181b1f'}`,
      `color:${bodyStyle.color || '#ccccdc'}`,
      'border:1px solid rgba(128,128,128,.4)',
      'box-shadow:0 8px 24px rgba(0,0,0,.4)',
      `font:${FONT}`,
    ].join(';');

    const preferences = loadPreferences();
    const options = document.createElement('div');
    options.style.cssText = 'padding-bottom:6px;margin-bottom:6px;border-bottom:1px solid rgba(128,128,128,.3)';
    options.append(
      checkbox('Formatted values (as shown in the table)', preferences.formatted, (checked) => {
        savePreferences({ ...loadPreferences(), formatted: checked });
      }),
      checkbox('Include the SQL query (Markdown only)', preferences.includeQuery, (checked) => {
        savePreferences({ ...loadPreferences(), includeQuery: checked });
      }),
    );
    menu.appendChild(options);

    for (const [key, format] of Object.entries(GrafanaTableExportFormats.FORMATS)) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;padding:3px 0';
      const name = document.createElement('span');
      name.textContent = format.label;
      const actions = document.createElement('span');
      actions.style.cssText = 'display:flex;gap:4px';
      const copyButton = smallButton('Copy', `Copy as ${format.label}`);
      const downloadButton = smallButton('Download', `Download a .${format.extension} file`);
      copyButton.addEventListener('click', () => {
        runExport(tableElement, key, 'copy');
        close();
      });
      downloadButton.addEventListener('click', () => {
        runExport(tableElement, key, 'download');
        close();
      });
      actions.append(copyButton, downloadButton);
      row.append(name, actions);
      menu.appendChild(row);
    }
    return menu;
  }

  /**
   * Finds the "Table" title bar above the table: walk up from the table, and at each level look at the
   * siblings before the branch that holds the table. The button goes in `host`, on the line of `header`.
   * @param {Element} tableElement
   * @returns {{ host: Element | null, header: Element | null }}
   */
  function findTitleBar(tableElement) {
    let child = tableElement;
    for (let depth = 0; depth < MAX_SECTION_DEPTH && child.parentElement; depth++) {
      const parent = child.parentElement;
      if (holdsOtherTable(parent, tableElement)) break;
      for (const sibling of parent.children) {
        if (sibling === child) break;
        // The test id also holds in a translated interface, where the title reads "Tabla" or "Tabelle".
        if (sibling.matches(HEADER_SELECTOR) || /^Table\b/.test((sibling.textContent ?? '').trim())) {
          return { host: parent, header: sibling };
        }
      }
      child = parent;
    }
    // `buttonsAround` must find the button on the next scan, so the fallback host holds no other table.
    const section = tableElement.closest(SECTION_SELECTOR);
    const host = section !== null && !holdsOtherTable(section, tableElement) ? section : tableElement.parentElement;
    return { host, header: null };
  }

  /**
   * Centers the button on the line of the title bar. Without a title bar, it uses the top-right corner.
   * @param {HTMLElement} container
   * @param {Element} host
   * @param {Element | null} header
   */
  function placeContainer(container, host, header) {
    if (header === null || !header.isConnected) {
      container.style.top = '6px';
      return;
    }
    const top = header.getBoundingClientRect().top - host.getBoundingClientRect().top;
    const height = header.getBoundingClientRect().height;
    container.style.top = `${Math.max(0, Math.round(top + height / 2 - container.offsetHeight / 2))}px`;
  }

  /**
   * Places the menu under the button. It opens upward when there is more room above.
   * @param {HTMLElement} menu
   * @param {HTMLElement} button
   */
  function placeMenu(menu, button) {
    const gap = 4;
    const margin = 8;
    const rect = button.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - gap - margin;
    const spaceAbove = rect.top - gap - margin;
    const openUp = menu.scrollHeight > spaceBelow && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, openUp ? spaceAbove : spaceBelow);
    menu.style.maxHeight = `${maxHeight}px`;
    const height = Math.min(menu.scrollHeight, maxHeight);
    menu.style.top = `${openUp ? rect.top - gap - height : rect.bottom + gap}px`;
    const left = Math.min(rect.right - menu.offsetWidth, window.innerWidth - menu.offsetWidth - margin);
    menu.style.left = `${Math.max(margin, left)}px`;
  }

  /**
   * @param {Element} level
   * @param {Element} tableElement
   * @returns {boolean} `true` when `level` also holds another Explore table, such as the other pane of a split view.
   */
  function holdsOtherTable(level, tableElement) {
    return GrafanaTableExportFrames.findTables(level).some((table) => table !== tableElement);
  }

  /**
   * Finds the buttons that a scan already put in the section of this table, at any level.
   * The title host can change between scans: Grafana can render the "Table" title after the first scan,
   * or render it again later. So look at every level of the section, not only in the current host.
   * The walk stops below a level that holds another table, so it never takes the button of another pane.
   * @param {Element} tableElement
   * @returns {HTMLElement[]}
   */
  function buttonsAround(tableElement) {
    /** @type {HTMLElement[]} */
    const found = [];
    let level = tableElement.parentElement;
    for (let depth = 0; level !== null && depth < MAX_SECTION_DEPTH; depth++, level = level.parentElement) {
      if (holdsOtherTable(level, tableElement)) break;
      for (const child of level.children) {
        if (child instanceof HTMLElement && (child.hasAttribute(BUTTON_MARK) || child.hasAttribute(LEGACY_BUTTON_MARK))) {
          found.push(child);
        }
      }
    }
    return found;
  }

  /** @param {HTMLElement} host */
  function prepareHost(host) {
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  }

  /**
   * Adds the Export button to the section of one table, once. A later call moves it to the title bar
   * when Grafana renders the title after the first call.
   * @param {Element} tableElement
   */
  function attachExportButton(tableElement) {
    const { host, header } = findTitleBar(tableElement);
    if (!(host instanceof HTMLElement)) return;
    const [kept, ...extra] = buttonsAround(tableElement).filter((button) => {
      // A tab that was open during an extension update can keep a button of an older version.
      if (button.hasAttribute(BUTTON_MARK)) return true;
      button.remove();
      return false;
    });
    extra.forEach((button) => button.remove());
    if (kept !== undefined) {
      // Move the button only to a title bar. Without a title, a fallback host is no better than where it is.
      if (header !== null && kept.parentElement !== host) {
        prepareHost(host);
        host.appendChild(kept);
      }
      placeContainer(kept, host, header);
      return;
    }
    prepareHost(host);

    const container = document.createElement('div');
    container.setAttribute(BUTTON_MARK, '');
    container.style.cssText = `position:absolute;top:6px;right:8px;z-index:20;font:${FONT}`;
    const button = smallButton('⤓ Export ▾', 'Export this table');
    button.style.padding = '3px 10px';
    container.appendChild(button);

    /** @type {HTMLElement | null} */
    let menu = null;
    /** @param {Event} event */
    const onOutside = (event) => {
      const target = /** @type {Node} */ (event.target);
      if (!container.contains(target) && !menu?.contains(target)) close();
    };
    /** @param {KeyboardEvent} event */
    const onKey = (event) => {
      if (event.key === 'Escape') close();
    };
    /** @param {Event} event */
    const onScroll = (event) => {
      // The menu has a fixed position, so a scroll of the page would leave it away from the button.
      if (!menu?.contains(/** @type {Node} */ (event.target))) close();
    };
    function close() {
      if (menu === null) return;
      menu.remove();
      menu = null;
      document.removeEventListener('mousedown', onOutside, true);
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    }

    button.addEventListener('click', () => {
      if (menu !== null) {
        close();
        return;
      }
      // Grafana renders the table again after each query, and a later scan can move the button to
      // another host. So look the table up at click time, from where the button is now.
      const currentHost = container.parentElement;
      const currentTable = (currentHost === null ? [] : GrafanaTableExportFrames.findTables(currentHost))[0] ?? tableElement;
      menu = buildMenu(currentTable, close);
      menu.style.visibility = 'hidden';
      document.body.appendChild(menu);
      placeMenu(menu, button);
      menu.style.visibility = '';
      document.addEventListener('mousedown', onOutside, true);
      document.addEventListener('keydown', onKey, true);
      document.addEventListener('scroll', onScroll, true);
      window.addEventListener('resize', close);
    });

    host.appendChild(container);
    placeContainer(container, host, header);
  }

  return { attachExportButton };
})();
