# Draws the extension icons.
# Run from the project root:  powershell -ExecutionPolicy Bypass -File scripts/makeIcons.ps1
# The artwork is a table with an orange header row, and an orange download arrow in front of it,
# on a dark rounded square.

Add-Type -AssemblyName System.Drawing

$source = 512
$bitmap = New-Object System.Drawing.Bitmap($source, $source)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

function New-RoundedRectangle([float]$left, [float]$top, [float]$right, [float]$bottom, [float]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2
  $path.AddArc($left, $top, $diameter, $diameter, 180, 90)
  $path.AddArc($right - $diameter, $top, $diameter, $diameter, 270, 90)
  $path.AddArc($right - $diameter, $bottom - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($left, $bottom - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-Color([int]$red, [int]$green, [int]$blue) {
  return [System.Drawing.Color]::FromArgb(255, $red, $green, $blue)
}

$dark = New-Color 24 27 31
$light = New-Color 236 238 242
$orange = New-Color 244 104 0

# Dark rounded square background.
$graphics.FillPath((New-Object System.Drawing.SolidBrush $dark), (New-RoundedRectangle 0 0 $source $source ([int]($source * 0.22))))

# The table: a light card with an orange header row, three columns and three body rows.
$left = 84; $top = 92; $right = 428; $bottom = 392
$graphics.FillPath((New-Object System.Drawing.SolidBrush $light), (New-RoundedRectangle $left $top $right $bottom 26))
$headerPath = New-RoundedRectangle $left $top $right ($top + 120) 26
$graphics.SetClip((New-Object System.Drawing.RectangleF($left, $top, ($right - $left), 78)))
$graphics.FillPath((New-Object System.Drawing.SolidBrush $orange), $headerPath)
$graphics.ResetClip()

$gridPen = New-Object System.Drawing.Pen ((New-Color 168 174 184)), 10
foreach ($y in 176, 248, 320) { $graphics.DrawLine($gridPen, $left, $y, $right, $y) }
foreach ($x in 199, 314) { $graphics.DrawLine($gridPen, $x, ($top + 78), $x, $bottom) }

# The download arrow: an orange disc with a dark ring, so it stays clear over the table at 16 px.
$graphics.FillEllipse((New-Object System.Drawing.SolidBrush $dark), 276, 268, 212, 212)
$graphics.FillEllipse((New-Object System.Drawing.SolidBrush $orange), 294, 286, 176, 176)
$arrowPen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), 30
$arrowPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$arrowPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$arrowPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
$graphics.DrawLine($arrowPen, 382, 324, 382, 414)
$graphics.DrawLines($arrowPen, [System.Drawing.Point[]]@((New-Object System.Drawing.Point(340, 376)), (New-Object System.Drawing.Point(382, 418)), (New-Object System.Drawing.Point(424, 376))))

$outputDirectory = Join-Path (Split-Path -Parent $PSScriptRoot) 'icons'
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

foreach ($size in 16, 32, 48, 128) {
  $scaled = New-Object System.Drawing.Bitmap($size, $size)
  $scaledGraphics = [System.Drawing.Graphics]::FromImage($scaled)
  $scaledGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $scaledGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $scaledGraphics.DrawImage($bitmap, 0, 0, $size, $size)
  $scaled.Save((Join-Path $outputDirectory "icon$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $scaledGraphics.Dispose()
  $scaled.Dispose()
  Write-Host "wrote icon$size.png"
}

$graphics.Dispose()
$bitmap.Dispose()
