# Formatea Report_Insights_Operativo (matriz): título, headers, columna quincena, celdas con wrapText.
# Corre DESPUÉS de format_all (que no toca esta hoja). Agrega sus propios fonts/fills/border/xfs.
$tmp="$env:USERPROFILE\_fmtop_tmp.xlsx"
Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[System.IO.Compression.ZipFile]::Open($tmp,'Update')
try{
 function GetE($z,$p){$e=$z.GetEntry($p);$r=New-Object System.IO.StreamReader($e.Open());$t=$r.ReadToEnd();$r.Close();$t}
 function PutE($z,$p,$c){$e=$z.GetEntry($p);$e.Delete();$n=$z.CreateEntry($p);$w=New-Object System.IO.StreamWriter($n.Open());$w.Write($c);$w.Close()}
 $st=GetE $zip 'xl/styles.xml'
 $fontsN=[int]([regex]::Match($st,'<fonts count="(\d+)"').Groups[1].Value)
 $fillsN=[int]([regex]::Match($st,'<fills count="(\d+)"').Groups[1].Value)
 $bordN =[int]([regex]::Match($st,'<borders count="(\d+)"').Groups[1].Value)
 $xfN   =[int]([regex]::Match($st,'<cellXfs count="(\d+)"').Groups[1].Value)
 $fname=[regex]::Match($st,'<name val="([^"]+)"').Groups[1].Value; if(-not $fname){$fname='Calibri'}
 # fonts: boldWhite, boldDark
 $bWhite=$fontsN; $bDark=$fontsN+1
 $st=$st.Replace('</fonts>',('<font><sz val="11"/><color rgb="FFFFFFFF"/><name val="'+$fname+'"/><b/></font><font><sz val="11"/><color rgb="FF2C2C2A"/><name val="'+$fname+'"/><b/></font></fonts>'))
 $st=$st -replace '<fonts count="\d+"',('<fonts count="'+($fontsN+2)+'"')
 # fills: title indigo, header slate, label slate-light
 $fTitle=$fillsN; $fHead=$fillsN+1; $fLabel=$fillsN+2
 $fx='<fill><patternFill patternType="solid"><fgColor rgb="FF6A4C93"/><bgColor indexed="64"/></patternFill></fill>'
 $fx+='<fill><patternFill patternType="solid"><fgColor rgb="FF595F6E"/><bgColor indexed="64"/></patternFill></fill>'
 $fx+='<fill><patternFill patternType="solid"><fgColor rgb="FFE2E4E8"/><bgColor indexed="64"/></patternFill></fill>'
 $st=$st.Replace('</fills>',($fx+'</fills>')); $st=$st -replace '<fills count="\d+"',('<fills count="'+($fillsN+3)+'"')
 # border: hairline gris en las 4 caras
 $bThin=$bordN
 $st=$st.Replace('</borders>','<border><left style="thin"><color rgb="FFD3D1C7"/></left><right style="thin"><color rgb="FFD3D1C7"/></right><top style="thin"><color rgb="FFD3D1C7"/></top><bottom style="thin"><color rgb="FFD3D1C7"/></bottom></border></borders>')
 $st=$st -replace '<borders count="\d+"',('<borders count="'+($bordN+1)+'"')
 # cellXfs: title, header, label, body
 $xTitle=$xfN; $xHead=$xfN+1; $xLabel=$xfN+2; $xBody=$xfN+3
 $xl=''
 $xl+='<xf numFmtId="0" fontId="'+$bWhite+'" fillId="'+$fTitle+'" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>'
 $xl+='<xf numFmtId="0" fontId="'+$bWhite+'" fillId="'+$fHead+'" borderId="'+$bThin+'" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
 $xl+='<xf numFmtId="0" fontId="'+$bDark+'" fillId="'+$fLabel+'" borderId="'+$bThin+'" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'
 $xl+='<xf numFmtId="0" fontId="0" fillId="0" borderId="'+$bThin+'" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="top" wrapText="1"/></xf>'
 $st=$st.Replace('</cellXfs>',($xl+'</cellXfs>')); $st=$st -replace '<cellXfs count="\d+"',('<cellXfs count="'+($xfN+4)+'"')
 PutE $zip 'xl/styles.xml' $st
 # localizar la hoja
 $wb=GetE $zip 'xl/workbook.xml'; $rel=GetE $zip 'xl/_rels/workbook.xml.rels'
 $rels=@{}; foreach($m in [regex]::Matches($rel,'Id="(rId\d+)"[^>]*Target="([^"]+)"')){$rels[$m.Groups[1].Value]=$m.Groups[2].Value}
 $path=$null; foreach($m in [regex]::Matches($wb,'<sheet[^>]*?name="([^"]+)"[^>]*?r:id="(rId\d+)"')){ if($m.Groups[1].Value -eq 'Report_Insights_Operativo'){ $path='xl/'+($rels[$m.Groups[2].Value] -replace '^/','') } }
 if(-not $path){ throw 'no Report_Insights_Operativo' }
 $xml=GetE $zip $path
 # asignar s= por región. cols: A(0)=quincena; B..G(1..6)=campañas
 $ncol=6
 $ev=[System.Text.RegularExpressions.MatchEvaluator]{ param($mm)
   $col=$mm.Groups[1].Value; $row=[int]$mm.Groups[2].Value
   $ci=0; foreach($ch in $col.ToCharArray()){ $ci=$ci*26+([int][char]$ch-64) }; $ci--
   $s=$null
   if($row -eq 1){ if($ci -eq 0){$s=$script:XT} }
   elseif($row -eq 2){ $s=$script:XH }
   elseif($ci -eq 0){ $s=$script:XL }
   else{ $s=$script:XB }
   if($null -eq $s){ return $mm.Value }
   return ('<c r="'+$col+$row+'" s="'+$s+'"')
 }
 $script:XT=$xTitle;$script:XH=$xHead;$script:XL=$xLabel;$script:XB=$xBody
 $xml=[regex]::Replace($xml,'<c r="([A-Z]{1,3})(\d+)"(\s+s="\d+")?',$ev)
 # merge del título A1:G1
 if($xml -notmatch '<mergeCells'){ $endcol=[char]([int][char]'A'+$ncol); $mc='<mergeCells count="1"><mergeCell ref="A1:'+$endcol+'1"/></mergeCells>'
   $xml=[regex]::Replace($xml,'(</sheetData>)',('$1'+$mc)) }
 PutE $zip $path $xml
 Write-Host ('Report_Insights_Operativo formateada: título+headers+labels+body wrap. xfs '+$xTitle+'-'+$xBody)
} finally { $zip.Dispose() }
