Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$src="$env:USERPROFILE\_int.xlsx"; $out="$env:USERPROFILE\_int_out.xlsx"
$enc=New-Object System.Text.UTF8Encoding($false)
$sd=Get-Content "$env:USERPROFILE\_allbus_sheetdata.xml" -Raw -Encoding UTF8
$cols=Get-Content "$env:USERPROFILE\_allbus_cols.xml" -Raw -Encoding UTF8
$dim=(Get-Content "$env:USERPROFILE\_allbus_meta.txt" -Raw).Trim()
if(Test-Path $out){Remove-Item $out -Force}
function FindEntry($z,$p){
  $e=$z.GetEntry($p); if($e){return $e}
  $e=$z.GetEntry($p.Replace('/','\')); if($e){return $e}
  foreach($x in $z.Entries){ if($x.FullName.Replace('\','/') -eq $p.Replace('\','/')){ return $x } }
  return $null }
function ReadE($z,$p){ $e=FindEntry $z $p; if(-not $e){return $null}; $r=New-Object System.IO.StreamReader($e.Open()); $t=$r.ReadToEnd(); $r.Close(); $t }
$zr=[System.IO.Compression.ZipFile]::OpenRead($src)
$wb=ReadE $zr 'xl/workbook.xml'; $rel=ReadE $zr 'xl/_rels/workbook.xml.rels'
$rels=@{}; foreach($m in [regex]::Matches($rel,'Id="(rId\d+)"[^>]*?Target="([^"]+)"')){$rels[$m.Groups[1].Value]=$m.Groups[2].Value}
$target=$null; $found=''
foreach($m in [regex]::Matches($wb,'<sheet[^>]*/>')){
  $nm=[regex]::Match($m.Value,'name="([^"]+)"').Groups[1].Value
  $id=[regex]::Match($m.Value,'r:id="(rId\d+)"').Groups[1].Value
  if($nm.Trim() -eq 'All BUs CRM'){ $found=$nm; $target=('xl/'+($rels[$id] -replace '^/','')) } }
$zr.Dispose()
if(-not $target){ Write-Error 'no se encontro All BUs CRM'; exit 1 }
Write-Host ("  hoja: '"+$found+"' -> "+$target)
Copy-Item $src $out
$zip=[System.IO.Compression.ZipFile]::Open($out,'Update')
try{
  $e=FindEntry $zip $target; $realName=$e.FullName
  $r=New-Object System.IO.StreamReader($e.Open()); $xml=$r.ReadToEnd(); $r.Close()
  $xml=[regex]::Replace($xml,'<dimension ref="[^"]*"/>',('<dimension ref="'+$dim+'"/>'),1)
  if($xml -match '<cols>'){ $xml=[regex]::Replace($xml,'<cols>.*?</cols>',{param($m) $cols},1) }
  else { $xml=[regex]::Replace($xml,'<sheetData',{param($m) $cols+'<sheetData'},1) }
  if($xml -match '<sheetData/>'){ $xml=$xml.Replace('<sheetData/>',$sd) }
  else { $xml=[regex]::Replace($xml,'<sheetData>.*?</sheetData>',{param($m) $sd},1) }
  $xml=[regex]::Replace($xml,'<autoFilter[^>]*/>','')
  $xml=[regex]::Replace($xml,'<autoFilter[^>]*>.*?</autoFilter>','')
  $xml=[regex]::Replace($xml,'(<sheetData>)',{param($m) $m.Groups[1].Value},1)
  $e.Delete(); $n=$zip.CreateEntry($realName)
  $w=New-Object System.IO.StreamWriter($n.Open(),$enc); $w.Write($xml); $w.Close()
  Write-Host ("  OK -> "+$realName)
} finally { $zip.Dispose() }
