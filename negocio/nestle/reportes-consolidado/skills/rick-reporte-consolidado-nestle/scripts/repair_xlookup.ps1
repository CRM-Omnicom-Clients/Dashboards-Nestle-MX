Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$src = "$env:USERPROFILE\_repair_tmp.xlsx"
$tmp = "$env:USERPROFILE\_repair_out.xlsx"
$enc = New-Object System.Text.UTF8Encoding($false)
if (Test-Path $tmp) { Remove-Item $tmp -Force }
$zin  = [System.IO.Compression.ZipFile]::OpenRead($src)
$zout = [System.IO.Compression.ZipFile]::Open($tmp, [System.IO.Compression.ZipArchiveMode]::Create)
$count = 0
foreach ($e in $zin.Entries) {
  $newEntry = $zout.CreateEntry($e.FullName)
  $inS = $e.Open()
  if (($e.FullName -like 'xl/*') -and ($e.FullName.EndsWith('.xml'))) {
    $sr = New-Object System.IO.StreamReader($inS, $enc)
    $content = $sr.ReadToEnd(); $sr.Dispose()
    if ($content.Contains('XLOOKUP')) {
      # Normalizar a _xlfn.XLOOKUP sin importar el estado (SheetJS escribe _xludf. o sin prefijo)
      $content = $content.Replace('_xlfn.XLOOKUP', 'XLOOKUP')
      $content = $content.Replace('_xludf.XLOOKUP', 'XLOOKUP')
      $content = $content.Replace('XLOOKUP', '_xlfn.XLOOKUP')
      $count++
    }
    $outS = $newEntry.Open()
    $sw = New-Object System.IO.StreamWriter($outS, $enc)
    $sw.Write($content); $sw.Dispose(); $outS.Dispose()
  } else {
    $outS = $newEntry.Open()
    $inS.CopyTo($outS)
    $outS.Dispose(); $inS.Dispose()
  }
}
$zin.Dispose(); $zout.Dispose()
Write-Output ("XMLs reparados (_xludf->_xlfn): " + $count)
