# Overlay post-format: A19 (Report_Campana+Qcart) azul oscuro como producción + bandas Insights (📅 header, 📐 SPECS, BLOQUE).
$tmp="$env:USERPROFILE\_overlay_tmp.xlsx"
$mk=$null; if(Test-Path "$env:USERPROFILE\_ins_markers.json"){ $mk=Get-Content "$env:USERPROFILE\_ins_markers.json" -Raw | ConvertFrom-Json }
Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[System.IO.Compression.ZipFile]::Open($tmp,'Update')
try{
 function GetE($z,$p){$e=$z.GetEntry($p);$r=New-Object System.IO.StreamReader($e.Open());$t=$r.ReadToEnd();$r.Close();$t}
 function PutE($z,$p,$c){$e=$z.GetEntry($p);$e.Delete();$n=$z.CreateEntry($p);$w=New-Object System.IO.StreamWriter($n.Open());$w.Write($c);$w.Close()}
 $st=GetE $zip 'xl/styles.xml'
 $fontsN=[int]([regex]::Match($st,'<fonts count="(\d+)"').Groups[1].Value)
 $fillsN=[int]([regex]::Match($st,'<fills count="(\d+)"').Groups[1].Value)
 $xfB=[int]([regex]::Match($st,'<cellXfs count="(\d+)"').Groups[1].Value)
 $bold=$fontsN
 $st=$st.Replace('</fonts>','<font><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><b/></font></fonts>')
 $st=$st -replace '<fonts count="\d+"',('<fonts count="'+($fontsN+1)+'"')
 $fx=''
 foreach($h in @('17375E','6A4C93','EFEAF6','595F6E')){ $fx+=('<fill><patternFill patternType="solid"><fgColor rgb="FF'+$h+'"/><bgColor indexed="64"/></patternFill></fill>') }
 $st=$st.Replace('</fills>',($fx+'</fills>')); $st=$st -replace '<fills count="\d+"',('<fills count="'+($fillsN+4)+'"')
 $fDark=$fillsN; $fIndS=$fillsN+1; $fIndL=$fillsN+2; $fSlate=$fillsN+3
 $xl=''
 $xl+=('<xf numFmtId="0" fontId="'+$bold+'" fillId="'+$fDark+'" borderId="0" xfId="0" applyFont="1" applyFill="1"/>')   # xDark
 $xl+=('<xf numFmtId="0" fontId="'+$bold+'" fillId="'+$fIndS+'" borderId="0" xfId="0" applyFont="1" applyFill="1"/>')   # xIndH
 $xl+=('<xf numFmtId="0" fontId="0" fillId="'+$fIndL+'" borderId="0" xfId="0" applyFill="1"/>')                          # xSpec
 $xl+=('<xf numFmtId="0" fontId="'+$bold+'" fillId="'+$fSlate+'" borderId="0" xfId="0" applyFont="1" applyFill="1"/>')  # xBloq
 $st=$st.Replace('</cellXfs>',($xl+'</cellXfs>')); $st=$st -replace '<cellXfs count="\d+"',('<cellXfs count="'+($xfB+4)+'"')
 PutE $zip 'xl/styles.xml' $st
 $xDark=$xfB; $xIndH=$xfB+1; $xSpec=$xfB+2; $xBloq=$xfB+3
 # mapa hoja -> sheetN.xml
 $wb=GetE $zip 'xl/workbook.xml'; $rel=GetE $zip 'xl/_rels/workbook.xml.rels'
 $rels=@{}; foreach($m in [regex]::Matches($rel,'Id="(rId\d+)"[^>]*Target="([^"]+)"')){$rels[$m.Groups[1].Value]=$m.Groups[2].Value}
 $sp=@{}; foreach($m in [regex]::Matches($wb,'<sheet[^>]*?name="([^"]+)"[^>]*?r:id="(rId\d+)"')){ $sp[$m.Groups[1].Value]='xl/'+($rels[$m.Groups[2].Value] -replace '^/','') }
 function SetRow($xml,$row,$xf){ return [regex]::Replace($xml,'<c r="([A-Z]{1,3})'+$row+'"(\s+s="\d+")?',('<c r="${1}'+$row+'" s="'+$xf+'"')) }
 # Insights — Report_Insights ELIMINADO 23-jul-2026 (redundante con Report_Insights_Operativo, que formatea format_all/format_operativo). Bloque INERTE salvo que la hoja reaparezca.
 if($mk -and $sp.ContainsKey('Report_Insights')){
   $ip=$sp['Report_Insights']; $ix=GetE $zip $ip
   foreach($r in $mk.head){ $ix=SetRow $ix $r $xIndH }
   foreach($r in $mk.spec){ $ix=SetRow $ix $r $xSpec }
   foreach($r in $mk.bloq){ $ix=SetRow $ix $r $xBloq }
   PutE $zip $ip $ix
 }
 # Insights Semanal (mismo tratamiento, markers propios)
 if(Test-Path "$env:USERPROFILE\_ins_sem_markers.json"){
   $mks=Get-Content "$env:USERPROFILE\_ins_sem_markers.json" -Raw | ConvertFrom-Json
   if($sp.ContainsKey('Report_Insights_Semanal')){ $ips=$sp['Report_Insights_Semanal']; $ixs=GetE $zip $ips
     foreach($r in $mks.head){ $ixs=SetRow $ixs $r $xIndH }
     foreach($r in $mks.spec){ $ixs=SetRow $ixs $r $xSpec }
     foreach($r in $mks.bloq){ $ixs=SetRow $ixs $r $xBloq }
     PutE $zip $ips $ixs
     Write-Host ("Overlay Insights_Semanal: "+$mks.head.Count+" headers") }
 }
 # Report_Campana+Qcart A19
 $cp=$sp['Report_Campana+Qcart']; $cx=GetE $zip $cp
 $cx=[regex]::Replace($cx,'<c r="A22"(\s+s="\d+")?',('<c r="A22" s="'+$xDark+'"'))
 PutE $zip $cp $cx
 Write-Host ("Overlay OK: A22 azul" + $(if($mk){" + Insights "+$mk.head.Count+"/"+$mk.spec.Count+"/"+$mk.bloq.Count}else{" (Report_Insights eliminado 23-jul-2026)"}))
} finally { $zip.Dispose() }
