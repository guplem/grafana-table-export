import js from '@eslint/js';
import globals from 'globals';

// The page scripts share one global scope, so each one sees the constants that the earlier ones declare.
const PAGE_SCRIPT_GLOBALS = {
  GrafanaTableExportFormats: 'readonly',
  GrafanaTableExportFrames: 'readonly',
  GrafanaTableExportMenu: 'readonly',
};

export default [
  { ignores: ['node_modules/', 'coverage/', 'dist/', '.claude/'] },
  js.configs.recommended,
  {
    files: ['src/page/**/*.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser, ...PAGE_SCRIPT_GLOBALS } },
    // A page script declares its API as a global constant that only the later page scripts read.
    rules: { 'no-unused-vars': ['error', { varsIgnorePattern: '^GrafanaTableExport' }], 'no-redeclare': 'off' },
  },
  {
    files: ['src/popup/**/*.js', 'src/background/**/*.js', 'src/shared/**/*.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.browser, chrome: 'readonly', ...PAGE_SCRIPT_GLOBALS } },
  },
  {
    files: ['scripts/**/*.js', 'test/**/*.js', '*.js'],
    languageOptions: { sourceType: 'module', globals: globals.node },
  },
];
