# Table Export for Grafana privacy policy

Last updated: 17 November 2026.

Table Export for Grafana is a Chrome extension that exports the result tables of Grafana Explore as Markdown, CSV, TSV, JSON or plain text.

## What the extension handles

- **The result of one table.** The extension reads it from the Grafana page only when you press Copy or Download. It turns it into the format that you pick, and puts it on your clipboard or in a file on your computer.
- **The address of the current tab.** The popup reads it when you click the extension icon, to show whether the extension runs on that site.
- **Whether the current page is Grafana.** When you open the popup on a site that is off, the extension checks the page once for Grafana. It reads nothing else from the page.
- **Two export options.** The page keeps "Formatted values" and "Include the SQL query" in its own `localStorage`, on your computer.

## Where it is stored

Only on your computer: the files that you download, your clipboard, and the two options above. The list of sites that you turned on is a Chrome permission, which Chrome keeps.

## What the extension does not do

- It does not send any data to the developer or to any other server.
- It runs on Grafana Cloud (`*.grafana.net`) and on each site that you turn on. It runs on no other site.
- It does not use analytics, advertising, or tracking.
- It does not sell or transfer your data to anyone.

## Removing your data

Delete the files that you downloaded. To stop the extension on a site, open the popup there and press "Turn off for this site". To remove everything, remove the extension at `chrome://extensions`.

## Contact

Open an issue in this repository: https://github.com/guplem/grafana-table-export/issues
