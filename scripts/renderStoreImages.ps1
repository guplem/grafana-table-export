# Renders the Chrome Web Store images from the HTML sources in store/graphics/.
# Run from the project root:  powershell -ExecutionPolicy Bypass -File scripts/renderStoreImages.ps1
# Needs Google Chrome installed. Writes 24-bit PNG files (no alpha) to store/images/,
# because the Web Store refuses a screenshot with an alpha channel.
#
# The first entry captures the demo Explore page with the real page scripts. The store images then
# show that capture, so they render after it.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$projectRoot = (Resolve-Path (Split-Path -Parent $PSScriptRoot)).Path
$graphicsDirectory = Join-Path $projectRoot 'store/graphics'
$imagesDirectory = Join-Path $projectRoot 'store/images'
$screenshotsDirectory = Join-Path $graphicsDirectory 'screenshots'

# Source page, output file, and the exact size the store asks for.
$storeImages = @(
  @{ Source = 'demo/explore.html'; Output = (Join-Path $screenshotsDirectory 'explore.png'); Width = 1280; Height = 800 },
  @{ Source = '01-exportTable.html'; Output = (Join-Path $imagesDirectory '1-export-the-whole-table.png'); Width = 1280; Height = 800 },
  @{ Source = '02-formats.html'; Output = (Join-Path $imagesDirectory '2-five-formats.png'); Width = 1280; Height = 800 },
  @{ Source = '03-turnOn.html'; Output = (Join-Path $imagesDirectory '3-turn-it-on.png'); Width = 1280; Height = 800 },
  @{ Source = '04-private.html'; Output = (Join-Path $imagesDirectory '4-light-fast-private.png'); Width = 1280; Height = 800 },
  @{ Source = 'promoTile.html'; Output = (Join-Path $imagesDirectory 'small-promo-tile-440x280.png'); Width = 440; Height = 280 }
)

$chromeCandidates = @(
  (Join-Path $env:ProgramFiles 'Google/Chrome/Application/chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Google/Chrome/Application/chrome.exe'),
  (Join-Path $env:LOCALAPPDATA 'Google/Chrome/Application/chrome.exe')
)
$chrome = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) { throw 'Google Chrome was not found.' }

# A separate profile keeps the headless run away from the user's own Chrome profile.
$workDirectory = Join-Path ([System.IO.Path]::GetTempPath()) 'grafana-table-export-store-render'
New-Item -ItemType Directory -Force -Path $workDirectory, $imagesDirectory, $screenshotsDirectory | Out-Null

foreach ($image in $storeImages) {
  $sourceUrl = 'file:///' + (Join-Path $graphicsDirectory $image.Source).Replace('\', '/')
  $rawPath = Join-Path $workDirectory 'raw.png'
  if (Test-Path $rawPath) { Remove-Item $rawPath }
  $chromeArguments = @(
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    '--allow-file-access-from-files',
    "--user-data-dir=$(Join-Path $workDirectory 'profile')",
    "--window-size=$($image.Width),$($image.Height)", "--screenshot=$rawPath", $sourceUrl
  )
  Start-Process -FilePath $chrome -ArgumentList $chromeArguments -Wait -WindowStyle Hidden
  if (-not (Test-Path $rawPath)) { throw "Chrome did not render $($image.Source)" }

  # Redraw on a 24-bit canvas to drop the alpha channel.
  $raw = [System.Drawing.Image]::FromFile($rawPath)
  $flat = New-Object System.Drawing.Bitmap($image.Width, $image.Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $graphics = [System.Drawing.Graphics]::FromImage($flat)
  $graphics.DrawImage($raw, 0, 0, $image.Width, $image.Height)
  $flat.Save($image.Output, [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $flat.Dispose(); $raw.Dispose()
  Write-Host "wrote $($image.Output.Substring($projectRoot.Length + 1))"
}
