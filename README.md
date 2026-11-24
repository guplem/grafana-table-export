# Table Export for Grafana

A Chrome extension for Grafana Explore. It adds an **Export** button above each result table. The button exports the full result, not only the rows on screen, as Markdown, CSV, TSV, JSON or a plain-text table. Copy it, or download a file. Nothing leaves your browser.

![the icon: a table with an orange header row and a download arrow](icons/icon128.png)

## Install

The extension is not in the Chrome Web Store yet. Load it unpacked. There is no build step, so the repository folder **is** the extension folder.

1. Get the files in one of two ways:
   - Download the zip of the [latest release](https://github.com/guplem/grafana-table-export/releases/latest), and unzip it into a folder that you keep.
   - Clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Press **Load unpacked** and pick the folder that holds `manifest.json`.

Chrome loads the extension from that folder each time, so do not delete it. After you pull or unzip a new version into it, press the reload arrow on the extension card, then reload the Grafana tab.

## Turn it on for your Grafana

- **Grafana Cloud** (an address that ends in `grafana.net`) works at once.
- **Any other Grafana** needs one step per site:
  1. Open your Grafana in a tab.
  2. Click the extension icon in the Chrome toolbar. Pin it first from the puzzle-piece menu, if you do not see it.
  3. The popup says whether the page is Grafana. Press **Turn on for &lt;your site&gt;**.
  4. Chrome asks to allow the extension on that site. Press **Allow**.

The Export button shows at once, with no reload. To turn it off, open the popup on that site and press **Turn off for this site**.

## How to use it

1. Run a query in Grafana Explore.
2. Press **⤓ Export ▾** at the top right of the table section.
3. Pick a format, then press **Copy** or **Download**.

| Format           | Use                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------- |
| Markdown table   | Paste into GitHub, Notion or docs. It can include the SQL query in a `sql` code block. |
| CSV              | A file for other tools. Follows RFC 4180 (the CSV standard).                           |
| TSV              | Paste into Google Sheets or Excel.                                                     |
| JSON             | An array with one object per row.                                                      |
| Plain-text table | A fixed-width table, like `psql` prints. Keeps every space, so `EXPLAIN` output works. |

The menu has two options. The extension remembers them for each Grafana site.

- **Formatted values**: export the values as the table shows them, with units and dates. Turn it off to export the raw values. A raw time becomes an ISO 8601 date.
- **Include the SQL query**: put the query that ran above the Markdown table.

## Troubleshooting

**The Export button does not show.**
Open the popup on that tab. If it says "Off", turn it on. If it says "On", run the query again, or reload the tab.

The extension knows the result table of Grafana 11 and later. Grafana 12.4 changed that table, and Grafana 13 keeps the new one. A newer Grafana can change it again: open an issue with your Grafana version.

**The export says "could not read the table data".**
A Grafana update can change how Grafana keeps the result. Open an issue with your Grafana version (in **Help**, the `?` icon).

**The Export button covers part of the table.**
Open an issue with a screenshot and your Grafana version.

## Privacy

- The extension runs on Grafana Cloud and on each site that you turn on. It runs nowhere else.
- It reads the result of the table only when you press Copy or Download.
- The export happens in your browser. It sends nothing to any server, and has no account and no analytics.

The full policy for the Chrome Web Store is in [`PRIVACY.md`](PRIVACY.md).

## Publish to the Chrome Web Store

Each merge to `main` that changes the extension makes a new [GitHub release](https://github.com/guplem/grafana-table-export/releases). The release holds the zip to upload, `grafana-table-export-<version>.zip`, with only the files that Chrome uses. The commit prefixes pick the version: `feat` raises the middle number, `fix` the last one, and `!` (such as `feat!:`) the first one. A change to the docs or the tests makes no release.

1. Download the zip of the latest release.
2. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
3. Press **New item** and upload the zip. For an update, open the item and upload the new zip in **Package**.
4. Fill in the **Store listing**, **Privacy**, and **Distribution** tabs. [`store/listing.md`](store/listing.md) holds every text to paste, field by field. The images to upload are in `store/images/`.
5. Submit for review.

On Windows, you can also build the zip yourself:

```bash
powershell -ExecutionPolicy Bypass -File scripts/packageExtension.ps1
```

The store images come from HTML pages in `store/graphics/`. After you change one, render them again (Windows, needs Google Chrome):

```bash
powershell -ExecutionPolicy Bypass -File scripts/renderStoreImages.ps1
```

## Development

Requires [Node.js](https://nodejs.org) 24. There is no build step.

```bash
npm install
```

```bash
npm run check
```

`npm run check` runs every check that CI runs. Contributor and architecture notes live in `AGENTS.md`.

## Licence

MIT. See `LICENSE`.
