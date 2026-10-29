# Regenerates the PNG app icons in public/ (Windows, no extra dependencies):
#   powershell -ExecutionPolicy Bypass -File apps/web/scripts/render-icons.ps1 -OutDir apps/web/public
param([string]$OutDir)
Add-Type -AssemblyName System.Drawing

# Same geometry as public/favicon.svg (lucide "shopping-cart", 24-unit grid); tiny corner arcs become joins.
$path1 = @(@(2.05,2.05), @(3.149,2.022), @(4.157,2.837), @(6.847,17.184), @(7.83,18), @(18,18))
$path2 = @(@(4.563,5), @(20.998,5), @(21.979,6.204), @(20.953,12.43), @(18.962,14), @(6.25,14))

function Render([int]$size, [bool]$fullBleed, [string]$file) {
  $k = $size / 512.0
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $green = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#16A34A'))

  if ($fullBleed) {
    $g.FillRectangle($green, 0, 0, $size, $size)
    $scale = 11 * $k; $offset = 124 * $k
  } else {
    $r = 112 * $k; $d = 2 * $r
    $bg = New-Object System.Drawing.Drawing2D.GraphicsPath
    $bg.AddArc(0, 0, $d, $d, 180, 90)
    $bg.AddArc($size - $d, 0, $d, $d, 270, 90)
    $bg.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
    $bg.AddArc(0, $size - $d, $d, $d, 90, 90)
    $bg.CloseFigure()
    $g.FillPath($green, $bg)
    $scale = 14 * $k; $offset = 88 * $k
  }

  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), (2 * $scale)
  $pen.StartCap = 'Round'; $pen.EndCap = 'Round'; $pen.LineJoin = 'Round'
  foreach ($line in @($path1, $path2)) {
    $points = $line | ForEach-Object { New-Object System.Drawing.PointF ([float]($offset + $_[0] * $scale)), ([float]($offset + $_[1] * $scale)) }
    $g.DrawLines($pen, [System.Drawing.PointF[]]$points)
  }
  foreach ($cx in @(8, 18)) {
    $rr = 2 * $scale
    $g.DrawEllipse($pen, [float]($offset + $cx * $scale - $rr), [float]($offset + 20 * $scale - $rr), [float](2 * $rr), [float](2 * $rr))
  }

  $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

Render 192 $false (Join-Path $OutDir 'icons\icon-192.png')
Render 512 $false (Join-Path $OutDir 'icons\icon-512.png')
Render 512 $true  (Join-Path $OutDir 'icons\icon-maskable-512.png')
Render 180 $true  (Join-Path $OutDir 'icons\apple-touch-icon.png')
Render 32  $false (Join-Path $OutDir 'favicon-32.png')
