param([string]$file, [string]$theme)
Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem
$clean = Get-Content $theme -Raw -Encoding UTF8
$enc = New-Object System.Text.UTF8Encoding($false)
$zip = [System.IO.Compression.ZipFile]::Open($file,'Update')
try {
  $e = $zip.GetEntry('xl/theme/theme1.xml'); if($e){ $e.Delete() }
  $n = $zip.CreateEntry('xl/theme/theme1.xml')
  $w = New-Object System.IO.StreamWriter($n.Open(), $enc)
  $w.Write($clean); $w.Close()
  Write-Host "theme reemplazado"
} finally { $zip.Dispose() }
