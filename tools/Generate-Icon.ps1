Add-Type -AssemblyName System.Drawing
$assetDirectory = Join-Path (Split-Path $PSScriptRoot -Parent) 'Assets'
[System.IO.Directory]::CreateDirectory($assetDirectory) | Out-Null
$sizes = @(16, 20, 24, 32, 48, 64, 128, 256)
$images = @()
foreach ($size in @($sizes + 1024)) {
    $bitmap = New-Object System.Drawing.Bitmap($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.ScaleTransform(($size / 256.0), ($size / 256.0))
    $background = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#087FCE'))
    $shape = New-Object System.Drawing.Drawing2D.GraphicsPath
    $shape.AddArc(8, 8, 64, 64, 180, 90)
    $shape.AddArc(184, 8, 64, 64, 270, 90)
    $shape.AddArc(184, 184, 64, 64, 0, 90)
    $shape.AddArc(8, 184, 64, 64, 90, 90)
    $shape.CloseFigure()
    $graphics.FillPath($background, $shape)
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255, 158, 232, 255), 12)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    foreach ($corner in @(@(58,94,58,58,94,58), @(162,58,198,58,198,94), @(198,162,198,198,162,198), @(94,198,58,198,58,162))) {
        $graphics.DrawLines($pen, [System.Drawing.PointF[]]@(
            [System.Drawing.PointF]::new($corner[0], $corner[1]),
            [System.Drawing.PointF]::new($corner[2], $corner[3]),
            [System.Drawing.PointF]::new($corner[4], $corner[5])))
    }
    $graphics.FillPolygon([System.Drawing.Brushes]::White, [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(143,54),
        [System.Drawing.PointF]::new(87,137),
        [System.Drawing.PointF]::new(123,137),
        [System.Drawing.PointF]::new(110,202),
        [System.Drawing.PointF]::new(173,111),
        [System.Drawing.PointF]::new(136,111)))
    $stream = New-Object System.IO.MemoryStream
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    if ($size -le 256) { $images += ,($stream.ToArray()) }
    if ($size -eq 1024) { $bitmap.Save((Join-Path $assetDirectory 'MinhaCaptura.png'), [System.Drawing.Imaging.ImageFormat]::Png) }
    $stream.Dispose()
    $pen.Dispose()
    $shape.Dispose()
    $background.Dispose()
    $graphics.Dispose()
    $bitmap.Dispose()
}
$file = [System.IO.File]::Create((Join-Path $assetDirectory 'MinhaCaptura.ico'))
$writer = New-Object System.IO.BinaryWriter($file)
try {
    $writer.Write([uint16]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]$sizes.Count)
    $offset = 6 + 16 * $sizes.Count
    for ($index = 0; $index -lt $sizes.Count; $index++) {
        $dimension = $sizes[$index] % 256
        $writer.Write([byte]$dimension)
        $writer.Write([byte]$dimension)
        $writer.Write([byte]0)
        $writer.Write([byte]0)
        $writer.Write([uint16]1)
        $writer.Write([uint16]32)
        $writer.Write([uint32]$images[$index].Length)
        $writer.Write([uint32]$offset)
        $offset += $images[$index].Length
    }
    foreach ($bytes in $images) { $writer.Write([byte[]]$bytes) }
}
finally { $writer.Dispose(); $file.Dispose() }
