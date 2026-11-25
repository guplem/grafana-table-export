// Page script (classic, MAIN world): the last of the page scripts, so the others exist when it runs.
// Wiring only: watch the single-page app and give each result table an Export button.

(() => {
  // The service worker can inject the page scripts into a tab that already has them. Start once only.
  const started = '__grafanaTableExportStarted';
  const pageWindow = /** @type {Window & { [started]?: boolean }} */ (window);
  if (pageWindow[started]) return;
  pageWindow[started] = true;

  function scan() {
    // A page change can drop the button of an open menu, and leave no table behind to find.
    GrafanaTableExportMenu.closeOrphanMenu();
    const tables = GrafanaTableExportFrames.findTables(document);
    tables.forEach((table) => GrafanaTableExportMenu.attachExportButton(table, tables));
  }

  // Grafana is a single-page app: a query, a page change, a split view or a dashboard refresh
  // renders a new table.
  let pending = false;
  new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      scan();
    });
  }).observe(document.body, { childList: true, subtree: true });

  scan();
})();
