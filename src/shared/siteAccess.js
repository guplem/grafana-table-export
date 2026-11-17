/**
 * Which sites run the page scripts. Pure logic: no `chrome.*` and no DOM, so Node tests it.
 *
 * Grafana Cloud (`*.grafana.net`) works from the install, through the static content script in
 * `manifest.json`. Any other Grafana works after the user turns it on in the popup: Chrome grants an
 * optional host permission for that site, and the service worker registers the page scripts for it.
 */

/** The id of the registered content script that runs on the sites that the user turned on. */
export const PAGE_SCRIPT_ID = 'grafana-table-export-page';

/** The page scripts, in load order. `manifest.json` lists the same files for the built-in sites. */
export const PAGE_SCRIPT_FILES = Object.freeze([
  'src/page/exportFormats.js',
  'src/page/grafanaFrames.js',
  'src/page/exportMenu.js',
  'src/page/pageEntry.js',
]);

/** The sites where the extension works with no extra step. `manifest.json` matches the same sites. */
export const BUILT_IN_SITE_PATTERNS = Object.freeze(['https://*.grafana.net/*']);

/** @typedef {'unsupported' | 'built-in' | 'enabled' | 'disabled'} SiteState */

/**
 * @param {string | undefined} url
 * @returns {URL | null} The address when it is an `http` or `https` page, else `null`.
 */
function webAddress(url) {
  if (url === undefined) return null;
  try {
    const address = new URL(url);
    return address.protocol === 'https:' || address.protocol === 'http:' ? address : null;
  } catch {
    return null;
  }
}

/**
 * @param {string | undefined} url
 * @returns {string | null} The match pattern for the whole site, such as `https://grafana.example.com/*`.
 *   A match pattern has no port, so it covers every port of the host.
 */
export function sitePatternOf(url) {
  const address = webAddress(url);
  return address === null ? null : `${address.protocol}//${address.hostname}/*`;
}

/**
 * @param {string} pattern A site pattern, such as `https://*.grafana.net/*`.
 * @param {string | undefined} url
 * @returns {boolean}
 */
export function patternMatchesUrl(pattern, url) {
  const address = webAddress(url);
  const parts = /^(https?|\*):\/\/([^/]+)\/\*$/.exec(pattern);
  if (address === null || parts === null) return false;
  const [, scheme = '', host = ''] = parts;
  if (scheme !== '*' && `${scheme}:` !== address.protocol) return false;
  if (host === '*') return true;
  if (host.startsWith('*.')) {
    const domain = host.slice(2);
    return address.hostname === domain || address.hostname.endsWith(`.${domain}`);
  }
  return address.hostname === host;
}

/**
 * @param {readonly string[]} origins The granted host permissions, from `chrome.permissions.getAll()`.
 * @returns {string[]} The sites that the user turned on, without the built-in sites.
 */
export function userSitePatterns(origins) {
  return origins.filter((origin) => /^https?:\/\/[^*/]+\/\*$/.test(origin) && !BUILT_IN_SITE_PATTERNS.includes(origin));
}

/**
 * @param {{ url: string | undefined, grantedOrigins: readonly string[] }} inputs
 * @returns {SiteState}
 */
export function siteState({ url, grantedOrigins }) {
  const pattern = sitePatternOf(url);
  if (pattern === null) return 'unsupported';
  if (BUILT_IN_SITE_PATTERNS.some((builtIn) => patternMatchesUrl(builtIn, url))) return 'built-in';
  return grantedOrigins.includes(pattern) ? 'enabled' : 'disabled';
}

/**
 * @param {readonly string[]} patterns The sites that the user turned on.
 * @returns {chrome.scripting.RegisteredContentScript | null} `null` when there is no site to register.
 */
export function pageScriptRegistration(patterns) {
  if (patterns.length === 0) return null;
  return {
    id: PAGE_SCRIPT_ID,
    matches: [...patterns],
    js: [...PAGE_SCRIPT_FILES],
    runAt: 'document_idle',
    world: 'MAIN',
    persistAcrossSessions: true,
  };
}
