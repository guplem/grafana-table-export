# Table Export for Grafana: Chrome Web Store listing

Everything to paste into the Developer Dashboard, in the order that the dashboard asks for it. Keep it true: when a feature, the site access, or the size changes, update this file and the images in the same change.

- The upload zip: download it from the latest GitHub release, which the release workflow builds after each merge. On Windows, `scripts/packageExtension.ps1` also builds it into `dist/`.
- The images: `store/images/`. Their sources are the HTML pages in `store/graphics/`. Render them again with `scripts/renderStoreImages.ps1`.
- `store/graphics/screenshots/explore.png` is a capture of `store/graphics/demo/explore.html`: a made-up Explore page with made-up data, which loads the real page scripts. The render script captures it first.

---

## 0. Before you start

- Status: not submitted yet. After the first submission, write the store page address and the item ID here.
- Dashboard: https://chrome.google.com/webstore/devconsole
- Upload file: `grafana-table-export-<version>.zip`
- Google account: the one that owns the other extensions. It needs 2-Step Verification.

---

## 1. Package (upload)

Press **New item** and choose the zip. For an update, open the item, go to **Package**, and upload the new zip.

The dashboard reads the name, the version, the summary, and the icon from the zip.

---

## 2. Store listing tab

### Name (comes from the zip)

Table Export for Grafana

The name puts "Grafana" after "for", as "Image Viewer for GitHub" does with "GitHub". The store accepts a brand name that describes what the extension works with, but not a name that looks like the brand's own product.

### Summary (comes from the zip: the `description` in `manifest.json`, at most 132 characters)

Export the full result table of Grafana Explore as Markdown, CSV, TSV, JSON or plain text. Copy it or download a file.

### Description (paste this whole block)

Export the whole result of a Grafana Explore query in one click.

Grafana Explore shows a query result as a table, but it renders only the rows on screen. To share a result in a pull request, a doc or a chat, you end up with screenshots or with hand-copied rows. Table Export for Grafana adds an Export button above the table. It reads the full result, every row, and gives it to you in the format that you need.

HOW IT WORKS

1. Run a query in Grafana Explore.
2. Press Export at the top right of the table.
3. Pick a format, then Copy or Download.

FORMATS
• Markdown table: paste it into GitHub, Notion or any doc. It can add the SQL query above the table.
• CSV, with correct quoting for commas, quotes and line breaks.
• TSV: paste it straight into Google Sheets or Excel.
• JSON: one object per row.
• Plain-text table: fixed-width columns, like psql. It keeps every space, so EXPLAIN plans stay readable.

FEATURES
• The full result, not only the visible rows.
• Formatted values, as the table shows them with units and dates, or the raw values.
• Works with every data source that Explore shows as a table.
• Works with Grafana's fast page changes, new queries and the split view.

TURN IT ON FOR YOUR GRAFANA
Grafana Cloud (grafana.net) works right after the install. For a self-hosted Grafana, click the extension icon on your Grafana page and press "Turn on". Chrome asks you once to allow that one site. The extension runs on no other site.

PRIVATE BY DESIGN
• The export happens in your browser. It sends nothing to any server.
• No account, no analytics, no ads, and no tracking.
• The whole extension is about 25 KB.

Not made by, or affiliated with, Grafana Labs. Grafana is a trademark of Grafana Labs.

Open source: https://github.com/guplem/grafana-table-export

### Category

Developer Tools

### Language

English

### Graphic assets

| Field (files in `store/images/`) | File                                              |
| -------------------------------- | ------------------------------------------------- |
| Store icon (128×128)             | Comes from the zip. If asked: `icons/icon128.png` |
| Screenshot 1                     | `1-export-the-whole-table.png`                    |
| Screenshot 2                     | `2-five-formats.png`                              |
| Screenshot 3                     | `3-turn-it-on.png`                                |
| Screenshot 4                     | `4-light-fast-private.png`                        |
| Small promo tile (440×280)       | `small-promo-tile-440x280.png`                    |
| Marquee promo tile (1400×560)    | Leave empty. It is optional.                      |
| Promo video                      | Leave empty. It is optional.                      |

### Additional fields

| Field          | Value                                                 |
| -------------- | ----------------------------------------------------- |
| Official URL   | Leave "None" (it needs a verified domain)             |
| Homepage URL   | https://github.com/guplem/grafana-table-export        |
| Support URL    | https://github.com/guplem/grafana-table-export/issues |
| Mature content | No                                                    |

---

## 3. Privacy tab

### Single purpose description

Table Export for Grafana exports the result table of a Grafana Explore query as Markdown, CSV, TSV, JSON or plain text, to the clipboard or to a file.

### Permission justifications

**activeTab**
When the user clicks the extension icon, the popup checks the current tab once: it reads the tab address and whether the page defines Grafana's `grafanaBootData` object. With this, the popup shows "Turn on" only on Grafana pages. It needs no access to any site before the click.

**scripting**
The extension runs its export scripts on the Grafana sites that the user turned on. It registers them with `chrome.scripting.registerContentScripts`, and injects them into the open tabs of a site right after the user turns it on.

**Optional host permissions (`https://*/*`, `http://*/*`)**
A self-hosted Grafana can live at any address, so the extension cannot list the sites in advance. The extension never asks for all sites. It asks for one site only, when the user presses "Turn on for <site>" in the popup on that site, and Chrome shows its own prompt. The user can turn a site off in the popup or in the Chrome settings.

**Host permission for the content script on `https://*.grafana.net/*`**
Grafana Cloud uses this domain. The content script runs there from the install, so Grafana Cloud users need no extra step. It only adds the Export button above the result tables of Explore, and reads a table only when the user presses Copy or Download.

### Remote code

Select: **No, I am not using remote code.**

Justification (if asked): All JavaScript ships inside the package. The extension loads no external script.

### Data usage

Tick only:

- **Website content** (the result table of a Grafana query, read only when the user presses Copy or Download, and put only on the user's clipboard or in a file on the user's computer)

Leave every other category unticked (personally identifiable information, health, financial, authentication, personal communications, location, web history, user activity).

Tick all three certifications:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

### Privacy policy URL

https://github.com/guplem/grafana-table-export/blob/main/PRIVACY.md

---

## 4. Distribution tab

| Field      | Value                                                            |
| ---------- | ---------------------------------------------------------------- |
| Payments   | Free                                                             |
| Visibility | Public. Pick Unlisted instead to share it only by link at first. |
| Regions    | All regions                                                      |

---

## 5. Submit

Press **Submit for review**. Leave "Publish automatically after review" on, unless you want to press Publish yourself.

Google sends an email when the review is done. It usually takes a few days. Optional host permissions and a content script on a whole domain can make the review take longer.
