// The toolbar popup: it shows whether the extension runs on the site of the current tab, and turns it
// on or off. The `activeTab` permission lets it look at the page once, to tell whether it is Grafana.

import { sitePatternOf, siteState } from '../shared/siteAccess.js';

const statusElement = /** @type {HTMLElement} */ (document.getElementById('status'));
const detailElement = /** @type {HTMLElement} */ (document.getElementById('detail'));
const actionButton = /** @type {HTMLButtonElement} */ (document.getElementById('action'));

/**
 * @param {string} status
 * @param {string} detail
 * @param {boolean} ok
 */
function show(status, detail, ok) {
  statusElement.textContent = status;
  statusElement.classList.toggle('ok', ok);
  detailElement.textContent = detail;
  actionButton.hidden = true;
}

/**
 * @param {string} label
 * @param {boolean} secondary
 * @param {() => Promise<void>} onClick
 */
function offer(label, secondary, onClick) {
  actionButton.textContent = label;
  actionButton.classList.toggle('secondary', secondary);
  actionButton.hidden = false;
  actionButton.onclick = () => void onClick();
}

/**
 * @param {number} tabId
 * @returns {Promise<boolean | null>} `null` when Chrome does not let the extension look at the page.
 */
async function looksLikeGrafana(tabId) {
  try {
    const [check] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      // Every Grafana page sets this global before its app starts.
      func: () => typeof (/** @type {any} */ (window).grafanaBootData) === 'object',
    });
    return check?.result === true;
  } catch {
    return null;
  }
}

async function render() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const { origins = [] } = await chrome.permissions.getAll();
  const url = tab?.url;
  const pattern = sitePatternOf(url);
  const host = url === undefined || pattern === null ? '' : new URL(url).hostname;

  switch (siteState({ url, grantedOrigins: origins })) {
    case 'unsupported':
      show('Open a Grafana page first.', 'Then click this icon again to turn the extension on for that site.', false);
      return;
    case 'built-in':
      show('✓ Works on this site.', 'Run a query in Explore, then press Export above the result table.', true);
      return;
    case 'enabled':
      show(`✓ On for ${host}`, 'Run a query in Explore, then press Export above the result table.', true);
      offer('Turn off for this site', true, async () => {
        await chrome.permissions.remove({ origins: [/** @type {string} */ (pattern)] });
        await render();
      });
      return;
    case 'disabled': {
      const grafana = tab?.id === undefined ? null : await looksLikeGrafana(tab.id);
      show(
        grafana === true
          ? 'This page is Grafana.'
          : grafana === false
            ? 'This page does not look like Grafana.'
            : `Off for ${host}`,
        'Chrome asks you once to allow the extension on this site. It reads the result tables there, and nothing else.',
        false,
      );
      offer(grafana === false ? `Turn on for ${host} anyway` : `Turn on for ${host}`, grafana === false, async () => {
        const granted = await chrome.permissions.request({ origins: [/** @type {string} */ (pattern)] });
        if (granted) {
          show(`✓ On for ${host}`, 'The Export button shows above each result table in Explore.', true);
        }
      });
    }
  }
}

void render();
