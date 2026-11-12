# Aplica color de PESTAÑA a cada hoja segun prefijo de nombre, manipulando el XML directamente.
# Opera sobre copia ASCII para evitar corrupcion de rutas acentuadas en PS 5.1.
$tmp = "$env:USERPROFILE\_tabcolor_tmp.xlsx"
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

function Color-For($name){
  if($name -like 'Protocol_IA_*'){return 'FF808080'}      # gris
  if($name -eq 'Data_Qcart_Legacy'){return 'FFFF0000'}    # rojo (temporal, a eliminar)
  if($name -like 'Data_*'){return 'FF0070C0'}             # azul
  if($name -like 'Catalog_*'){return 'FF00B050'}          # verde
  if($name -like 'Report_*'){return 'FFFFC000'}           # amarillo
  if($name -like 'Control_IA_*'){return 'FF7030A0'}       # morado
  if($name -like 'Soporte_IA_*'){return 'FFBFBFBF'}       # gris claro
  return $null
}

$zip = [System.IO.Compression.ZipFile]::Open($tmp,'Update')
try {
  # leer workbook.xml -> name + r:id
  $wbEntry = $zip.GetEntry('xl/workbook.xml')
  $sr = New-Object System.IO.StreamReader($wbEntry.Open())
  $wbXml = $sr.ReadToEnd(); $sr.Close()
  # leer rels -> r:id -> target
  $relEntry = $zip.GetEntry('xl/_rels/workbook.xml.rels')
  $sr2 = New-Object System.IO.StreamReader($relEntry.Open())
  $relXml = $sr2.ReadToEnd(); $sr2.Close()

  $rels = @{}
  foreach($m in [regex]::Matches($relXml,'Id="(rId\d+)"[^>]*Target="([^"]+)"')){
    $rels[$m.Groups[1].Value] = $m.Groups[2].Value
  }
  # tambien Target antes de Id (orden variable)
  foreach($m in [regex]::Matches($relXml,'Target="([^"]+)"[^>]*Id="(rId\d+)"')){
    if(-not $rels.ContainsKey($m.Groups[2].Value)){ $rels[$m.Groups[2].Value] = $m.Groups[1].Value }
  }

  $applied = 0
  foreach($m in [regex]::Matches($wbXml,'<sheet[^>]*?name="([^"]+)"[^>]*?r:id="(rId\d+)"')){
    $name = $m.Groups[1].Value; $rid = $m.Groups[2].Value
    $color = Color-For $name
    if(-not $color){ continue }
    $target = $rels[$rid]
    if(-not $target){ continue }
    $path = 'xl/' + ($target -replace '^/','')
    $we = $zip.GetEntry($path)
    if(-not $we){ continue }
    $r = New-Object System.IO.StreamReader($we.Open())
    $xml = $r.ReadToEnd(); $r.Close()
    $tab = '<sheetPr><tabColor rgb="' + $color + '"/></sheetPr>'
    if($xml -match '<sheetPr/>'){
      $xml = $xml -replace '<sheetPr/>', ('<sheetPr><tabColor rgb="' + $color + '"/></sheetPr>')
    } elseif($xml -match '<sheetPr[ >]'){
      # insertar tabColor como primer hijo de sheetPr existente
      $xml = [regex]::Replace($xml, '(<sheetPr[^>]*>)', ('$1<tabColor rgb="' + $color + '"/>'), 1)
    } else {
      # insertar sheetPr completo tras <worksheet ...>
      $xml = [regex]::Replace($xml, '(<worksheet[^>]*>)', ('$1' + $tab), 1)
    }
    # reescribir entry
    $we.Delete()
    $ne = $zip.CreateEntry($path)
    $w = New-Object System.IO.StreamWriter($ne.Open())
    $w.Write($xml); $w.Close()
    $applied++
    Write-Host ("  " + $name + " -> " + $color)
  }
  Write-Host ("Hojas coloreadas: " + $applied)
} finally {
  $zip.Dispose()
}
