# Deduplica <numFmt> por numFmtId dentro de <numFmts> (SheetJS+format_all pueden dejar 180-184 dos veces).
# Reconstruye el zip (patrón repair_xlookup). No toca cellXfs (siguen apuntando al id único) ni XLOOKUP.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$src = "$env:USERPROFILE\_dnf_tmp.xlsx"
$out = "$env:USERPROFILE\_dnf_out.xlsx"
$enc = New-Object System.Text.UTF8Encoding($false)
if (Test-Path $out) { Remove-Item $out -Force }
$zin  = [System.IO.Compression.ZipFile]::OpenRead($src)
$zout = [System.IO.Compression.ZipFile]::Open($out, [System.IO.Compression.ZipArchiveMode]::Create)
$before = 0; $after = 0
foreach ($e in $zin.Entries) {
  $ne = $zout.CreateEntry($e.FullName)
  $ins = $e.Open()
  if ($e.FullName -eq 'xl/styles.xml') {
    $sr = New-Object System.IO.StreamReader($ins, $enc); $c = $sr.ReadToEnd(); $sr.Dispose()
    $m = [regex]::Match($c, '<numFmts count="\d+">(.*?)</numFmts>')
    if ($m.Success) {
      $entries = [regex]::Matches($m.Groups[1].Value, '<numFmt [^>]*/>')
      $before = $entries.Count
      $seen = @{}; $keep = @()
      foreach ($en in $entries) {
        $id = [regex]::Match($en.Value, 'numFmtId="(\d+)"').Groups[1].Value
        if (-not $seen.ContainsKey($id)) { $seen[$id] = $true; $keep += $en.Value }
      }
      $after = $keep.Count
      $newBlock = '<numFmts count="' + $after + '">' + ($keep -join '') + '</numFmts>'
      $c = $c.Substring(0, $m.Index) + $newBlock + $c.Substring($m.Index + $m.Length)
    }
    $os = $ne.Open(); $sw = New-Object System.IO.StreamWriter($os, $enc); $sw.Write($c); $sw.Dispose(); $os.Dispose()
  } else {
    $os = $ne.Open(); $ins.CopyTo($os); $os.Dispose(); $ins.Dispose()
  }
}
$zin.Dispose(); $zout.Dispose()
Write-Output ("numFmts: " + $before + " -> " + $after + " (deduplicado)")
