import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  BUILT_IN_SITE_PATTERNS,
  PAGE_SCRIPT_FILES,
  PAGE_SCRIPT_ID,
  pageScriptRegistration,
  patternMatchesUrl,
  sitePatternOf,
  siteState,
  userSitePatterns,
} from '../src/shared/siteAccess.js';

const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));

test('the manifest loads the same page scripts on the same built-in sites', () => {
  const [contentScript] = manifest.content_scripts;
  assert.deepEqual(contentScript.js, [...PAGE_SCRIPT_FILES]);
  assert.deepEqual(contentScript.matches, [...BUILT_IN_SITE_PATTERNS]);
  assert.equal(contentScript.world, 'MAIN');
});

test('the manifest summary fits the 132 characters of the Chrome Web Store', () => {
  assert.ok(manifest.description.length <= 132, `${manifest.description.length} characters`);
});

test('sitePatternOf covers the whole host of a web page', () => {
  assert.equal(sitePatternOf('https://grafana.example.com:3000/explore?x=1'), 'https://grafana.example.com/*');
  assert.equal(sitePatternOf('http://localhost:3000/'), 'http://localhost/*');
  assert.equal(sitePatternOf('chrome://extensions'), null);
  assert.equal(sitePatternOf('not a url'), null);
  assert.equal(sitePatternOf(undefined), null);
});

test('patternMatchesUrl follows the Chrome match pattern rules for hosts', () => {
  assert.equal(patternMatchesUrl('https://*.grafana.net/*', 'https://team.grafana.net/explore'), true);
  assert.equal(patternMatchesUrl('https://*.grafana.net/*', 'https://grafana.net/'), true);
  assert.equal(patternMatchesUrl('https://*.grafana.net/*', 'https://evilgrafana.net/'), false);
  assert.equal(patternMatchesUrl('https://*.grafana.net/*', 'http://team.grafana.net/'), false);
  assert.equal(patternMatchesUrl('*://*/*', 'http://a.b/'), true);
  assert.equal(patternMatchesUrl('https://a.example/*', 'https://a.example/x'), true);
  assert.equal(patternMatchesUrl('bad pattern', 'https://a.example/x'), false);
});

test('userSitePatterns keeps only the single sites that the user turned on', () => {
  assert.deepEqual(userSitePatterns(['https://*.grafana.net/*', 'https://grafana.example.com/*', 'https://*/*', '<all_urls>']), [
    'https://grafana.example.com/*',
  ]);
});

test('siteState tells the popup what to show', () => {
  const granted = ['https://grafana.example.com/*'];
  assert.equal(siteState({ url: 'chrome://newtab', grantedOrigins: granted }), 'unsupported');
  assert.equal(siteState({ url: 'https://team.grafana.net/explore', grantedOrigins: [] }), 'built-in');
  assert.equal(siteState({ url: 'https://grafana.example.com/explore', grantedOrigins: granted }), 'enabled');
  assert.equal(siteState({ url: 'https://other.example.com/', grantedOrigins: granted }), 'disabled');
});

test('pageScriptRegistration runs the page scripts in the page world on the given sites', () => {
  assert.equal(pageScriptRegistration([]), null);
  assert.deepEqual(pageScriptRegistration(['https://grafana.example.com/*']), {
    id: PAGE_SCRIPT_ID,
    matches: ['https://grafana.example.com/*'],
    js: [...PAGE_SCRIPT_FILES],
    runAt: 'document_idle',
    world: 'MAIN',
    persistAcrossSessions: true,
  });
});
