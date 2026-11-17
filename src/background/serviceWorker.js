// Keeps the registered page scripts equal to the sites that the user turned on.
// Chrome fires the permission events for a grant from the popup and for a removal in the Chrome settings.

import { PAGE_SCRIPT_FILES, PAGE_SCRIPT_ID, pageScriptRegistration, userSitePatterns } from '../shared/siteAccess.js';

async function syncPageScripts() {
  const { origins = [] } = await chrome.permissions.getAll();
  const registration = pageScriptRegistration(userSitePatterns(origins));
  const registered = await chrome.scripting.getRegisteredContentScripts({ ids: [PAGE_SCRIPT_ID] });
  if (registered.length > 0) await chrome.scripting.unregisterContentScripts({ ids: [PAGE_SCRIPT_ID] });
  if (registration !== null) await chrome.scripting.registerContentScripts([registration]);
}

/**
 * A registered script runs only on the next page load. Inject it now into the open tabs of a new site,
 * so the Export button shows with no reload.
 * @param {readonly string[]} patterns
 */
async function injectIntoOpenTabs(patterns) {
  if (patterns.length === 0) return;
  const tabs = await chrome.tabs.query({ url: [...patterns] });
  for (const tab of tabs) {
    if (tab.id === undefined) continue;
    const target = { tabId: tab.id };
    try {
      // A second copy of the page scripts would fail: each one declares a global constant.
      const [check] = await chrome.scripting.executeScript({
        target,
        world: 'MAIN',
        func: () => typeof GrafanaTableExportFormats !== 'undefined',
      });
      if (check?.result === true) continue;
      await chrome.scripting.executeScript({ target, world: 'MAIN', files: [...PAGE_SCRIPT_FILES] });
    } catch (error) {
      // A tab can close or move to another site while the loop runs.
      console.warn('Table Export: could not inject into a tab.', error);
    }
  }
}

chrome.runtime.onInstalled.addListener(() => void syncPageScripts());
chrome.permissions.onAdded.addListener(({ origins = [] }) => {
  void syncPageScripts().then(() => injectIntoOpenTabs(userSitePatterns(origins)));
});
chrome.permissions.onRemoved.addListener(() => void syncPageScripts());
