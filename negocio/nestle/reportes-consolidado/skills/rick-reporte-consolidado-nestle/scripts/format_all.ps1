# Formato COMPLETO en un solo paso dinámico: apartados (tab) + doc + banner para las 17 hojas visibles.
# Reusa numFmt 166=$,167=%,3=int; agrega 173="0.00" (ratio para AS/AQ). Índices calculados dinámicamente.
$tmp="$env:USERPROFILE\_fmtall_tmp.xlsx"
Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip=[System.IO.Compression.ZipFile]::Open($tmp,'Update')
try{
 function GetE($z,$p){$e=$z.GetEntry($p);$r=New-Object System.IO.StreamReader($e.Open());$t=$r.ReadToEnd();$r.Close();$t}
 function PutE($z,$p,$c){$e=$z.GetEntry($p);$e.Delete();$n=$z.CreateEntry($p);$w=New-Object System.IO.StreamWriter($n.Open());$w.Write($c);$w.Close()}
 $st=GetE $zip 'xl/styles.xml'
 $fontsCount=[int]([regex]::Match($st,'<fonts count="(\d+)"').Groups[1].Value)
 $fillsCount=[int]([regex]::Match($st,'<fills count="(\d+)"').Groups[1].Value)
 $xfBase=[int]([regex]::Match($st,'<cellXfs count="(\d+)"').Groups[1].Value)
 $fname=[regex]::Match($st,'<name val="([^"]+)"').Groups[1].Value; if(-not $fname){$fname='Calibri'}
 # xfNum base (para banner preserve): numFmtId por índice de xf EXISTENTE
 $xfBlock=[regex]::Match($st,'<cellXfs count="\d+">(.*?)</cellXfs>').Groups[1].Value
 $XFNUM=@(); foreach($m in [regex]::Matches($xfBlock,'<xf\b[^>]*?numFmtId="(\d+)"')){ $XFNUM += [int]$m.Groups[1].Value }
 # font bold blanco
 $boldFont=$fontsCount
 $st=$st.Replace('</fonts>',('<font><sz val="11"/><color rgb="FFFFFFFF"/><name val="'+$fname+'"/><b/></font></fonts>'))
 $st=$st -replace '<fonts count="\d+"',('<fonts count="'+($fontsCount+1)+'"')
 # numFmts PROPIOS deterministas (SheetJS renumera los existentes → no depender de ellos): 180=$ 181=% 182=int 183=ratio
 # OJO: usar .Replace() (literal), NUNCA -replace, por el "$" del formato de moneda (el $& se interpreta como backref en -replace)
 $nf='<numFmt numFmtId="180" formatCode="&quot;$&quot;#,##0"/><numFmt numFmtId="181" formatCode="0.0%"/><numFmt numFmtId="182" formatCode="#,##0"/><numFmt numFmtId="183" formatCode="0.00"/><numFmt numFmtId="184" formatCode="dd/mm/yyyy"/>'
 if($st -match '<numFmts count="(\d+)"'){ $nc=[int]$Matches[1]; $st=$st.Replace('</numFmts>',$nf+'</numFmts>'); $st=$st -replace '<numFmts count="\d+"',('<numFmts count="'+($nc+5)+'"') }
 else { $st=$st.Replace('<fonts ',('<numFmts count="5">'+$nf+'</numFmts><fonts ')) }
 # hues
 $hues=@{ slate=@{h='595F6E';a='F1F2F4';b='E2E4E8'}; blue=@{h='2E6DB4';a='EAF1FB';b='D6E4F5'};
  teal=@{h='2A9187';a='E8F4F2';b='CFE8E4'}; indigo=@{h='6A4C93';a='EFEAF6';b='DFD5EC'};
  amber=@{h='C77F0A';a='FBF1E1';b='F6E4C6'}; green=@{h='4C9A2A';a='EDF6E6';b='D8EDCB'};
  olive=@{h='7A8B1E';a='F2F4E2';b='E6EAC4'}; rose=@{h='B0436A';a='F9EAEF';b='F2D5DF'}; }
 $hueOrder=@('slate','blue','teal','indigo','amber','green','olive','rose')
 # fills (24)
 $fi=$fillsCount; $fH=@{};$fA=@{};$fB=@{}; $fx=''
 foreach($hn in $hueOrder){ $h=$hues[$hn]
   $fx+=('<fill><patternFill patternType="solid"><fgColor rgb="FF'+$h.h+'"/><bgColor indexed="64"/></patternFill></fill>'); $fH[$hn]=$fi;$fi++
   $fx+=('<fill><patternFill patternType="solid"><fgColor rgb="FF'+$h.a+'"/><bgColor indexed="64"/></patternFill></fill>'); $fA[$hn]=$fi;$fi++
   $fx+=('<fill><patternFill patternType="solid"><fgColor rgb="FF'+$h.b+'"/><bgColor indexed="64"/></patternFill></fill>'); $fB[$hn]=$fi;$fi++ }
 $st=$st.Replace('</fills>',($fx+'</fills>')); $st=$st -replace '<fills count="\d+"',('<fills count="'+$fi+'"')
 # xfs: header(8)+body(64)+ratio(2)
 $XF=@{}; $idx=$xfBase; $xl=''
 foreach($hn in $hueOrder){ $xl+=('<xf numFmtId="0" fontId="'+$boldFont+'" fillId="'+$fH[$hn]+'" borderId="0" xfId="0" applyFont="1" applyFill="1"/>'); $XF['H_'+$hn]=$idx;$idx++ }
 foreach($hn in $hueOrder){ foreach($par in @('a','b')){ $fl= if($par -eq 'a'){$fA[$hn]}else{$fB[$hn]}
   foreach($p in @(@('text','0'),@('cur','180'),@('pct','181'),@('int','182'),@('date','184'))){ $xl+=('<xf numFmtId="'+$p[1]+'" fontId="0" fillId="'+$fl+'" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>'); $XF[$hn+'_'+$par+'_'+$p[0]]=$idx;$idx++ } } }
 $XF['ratio_a']=$idx; $xl+=('<xf numFmtId="183" fontId="0" fillId="'+$fA['green']+'" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>'); $idx++
 $XF['ratio_b']=$idx; $xl+=('<xf numFmtId="183" fontId="0" fillId="'+$fB['green']+'" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>'); $idx++
 # banner preserve: pre-crear band xfs (numFmt original + tinte slate)
 $CACHE=@{}; $bxl=''
 $wb=GetE $zip 'xl/workbook.xml'; $rel=GetE $zip 'xl/_rels/workbook.xml.rels'
 $rels=@{}; foreach($m in [regex]::Matches($rel,'Id="(rId\d+)"[^>]*Target="([^"]+)"')){$rels[$m.Groups[1].Value]=$m.Groups[2].Value}
 $sheetPath=@{}; foreach($m in [regex]::Matches($wb,'<sheet[^>]*?name="([^"]+)"[^>]*?r:id="(rId\d+)"')){ $sheetPath[$m.Groups[1].Value]='xl/'+($rels[$m.Groups[2].Value] -replace '^/','') }
 foreach($bs in @('Report_Insights','Report_Insights_Semanal','Control_IA_Auditoria')){ if(-not $sheetPath.ContainsKey($bs)){continue}; $xml=GetE $zip $sheetPath[$bs]
   foreach($m in [regex]::Matches($xml,'<c r="[A-Z]{1,3}(\d+)"(\s+s="(\d+)")?')){ $row=[int]$m.Groups[1].Value; if($row -lt 2){continue}; $s= if($m.Groups[3].Success){[int]$m.Groups[3].Value}else{0}; $nf2= if($s -lt $XFNUM.Count){$XFNUM[$s]}else{0}
     foreach($par in @('a','b')){ $k="$nf2`_$par"; if(-not $CACHE.ContainsKey($k)){ $fl2= if($par -eq 'a'){$fA['slate']}else{$fB['slate']}; $bxl+=('<xf numFmtId="'+$nf2+'" fontId="0" fillId="'+$fl2+'" borderId="0" xfId="0" applyNumberFormat="1" applyFill="1"/>'); $CACHE[$k]=$idx; $idx++ } } } }
 $st=$st.Replace('</cellXfs>',($xl+$bxl+'</cellXfs>')); $st=$st -replace '<cellXfs count="\d+"',('<cellXfs count="'+$idx+'"')
 PutE $zip 'xl/styles.xml' $st
 # ---- config por hoja ----
 $cfg=@{
  'Report_Resumen_Campana'=@{mode='tab';secs=@(@(0,7,'slate'),@(8,11,'blue'),@(12,15,'teal'),@(16,18,'indigo'),@(19,25,'amber'));cur=@('W','X','Z');pct=@('K','L','O','P','R','S','Y');int=@('J','N','Q','T','U','V');ratio=@()};
  'Report_Campana+Qcart'=@{mode='tab';secs=@(@(0,8,'slate'),@(9,15,'blue'),@(16,20,'teal'),@(21,25,'indigo'),@(26,30,'amber'),@(31,34,'rose'));cur=@('V','W','Y','Z','AA','AB');pct=@('N','O','P','X','AE','AG');int=@('J','K','L','M','Q','R','S','T','U');ratio=@(28,29)};
  'Catalog_Benchmarks_BAU'=@{mode='tab';secs=@(@(0,1,'slate'),@(2,3,'blue'),@(4,6,'teal'));cur=@('F');pct=@('C','D');int=@('E');ratio=@()};
  'Report_Mensual'=@{mode='tab';secs=@(@(0,4,'slate'),@(5,8,'blue'),@(9,11,'green'),@(12,12,'slate'));cur=@();pct=@('J','K','L');int=@('F','G','H','I');ratio=@()};
  'Report_Semanal'=@{mode='tab';secs=@(@(0,6,'slate'),@(7,13,'blue'),@(14,20,'teal'),@(21,22,'slate'));cur=@();pct=@('M','N','T','U');int=@('I','J','K','L','P','Q','R','S');ratio=@()};
  'Data_Email'=@{mode='tab';secs=@(@(0,10,'slate'),@(11,18,'indigo'),@(19,23,'blue'),@(24,28,'green'),@(29,31,'rose'),@(32,34,'slate'));cur=@();pct=@('Y','Z','AA','AB','AC');int=@('T','U','V','W','X');ratio=@();date=@('L','M')};
  'Data_Qcart'=@{mode='tab';secs=@(@(0,5,'slate'),@(6,10,'indigo'),@(11,12,'blue'),@(13,16,'green'),@(17,21,'olive'),@(22,24,'rose'));cur=@('N','O','P','Q');pct=@('U');int=@('L','M','S','T','V');ratio=@()};
  'Catalog_Campanas'=@{mode='tab';secs=@(@(0,3,'slate'),@(4,6,'indigo'),@(7,8,'green'),@(9,10,'slate'));cur=@();pct=@();int=@();ratio=@();date=@('H')};
  'Catalog_Recetas_Qcart'=@{mode='tab';secs=@(@(0,10,'slate'),@(11,12,'indigo'),@(13,22,'green'));cur=@('O','S');pct=@('T');int=@('N','P','Q','R');ratio=@();date=@('K')};
  'Catalog_Productos_Nestle'=@{mode='tab';secs=@(@(0,1,'slate'),@(2,3,'indigo'),@(4,5,'green'),@(6,6,'slate'));cur=@();pct=@();int=@();ratio=@()};
  'Control_IA_Bitacora'=@{mode='tab';secs=@(@(0,1,'slate'),@(2,5,'blue'),@(6,7,'green'));cur=@();pct=@();int=@();ratio=@();date=@('A')};
  'Protocol_IA_Email'=@{mode='doc'};'Protocol_IA_Reportes'=@{mode='doc'};'Protocol_IA_Qcart'=@{mode='doc'};'Protocol_IA_Auditoria'=@{mode='doc'};'Protocol_IA_Prompts'=@{mode='doc'};
  'Report_Insights'=@{mode='banner';banner='H_indigo'};'Report_Insights_Semanal'=@{mode='banner';banner='H_indigo'};'Control_IA_Auditoria'=@{mode='banner';banner='H_rose'};
 }
 $done=0
 foreach($name in $cfg.Keys){ if(-not $sheetPath.ContainsKey($name)){continue}
   $c=$cfg[$name]; $path=$sheetPath[$name]; $xml=GetE $zip $path
   $script:XFM=$XF; $script:MODE=$c.mode; $script:CACHE2=$CACHE; $script:XFNUM2=$XFNUM
   if($c.mode -eq 'tab'){ $script:SECS=$c.secs;$script:CUR=$c.cur;$script:PCT=$c.pct;$script:INT=$c.int;$script:RAT=$c.ratio; if($c.ContainsKey('date')){$script:DATE=$c.date}else{$script:DATE=@()} }
   if($c.mode -eq 'banner'){ $script:BAN=$XF[$c.banner] }
   $ev=[System.Text.RegularExpressions.MatchEvaluator]{ param($mm)
     $col=$mm.Groups[1].Value; $row=[int]$mm.Groups[2].Value
     $ci=0; foreach($ch in $col.ToCharArray()){ $ci=$ci*26+([int][char]$ch-64) }; $ci--
     if($script:MODE -eq 'tab'){
       $hue=$null; foreach($s in $script:SECS){ if($ci -ge $s[0] -and $ci -le $s[1]){$hue=$s[2];break} }
       if(-not $hue){ return $mm.Value }
       if($row -eq 1){ return ('<c r="'+$col+$row+'" s="'+$script:XFM['H_'+$hue]+'"') }
       $par= if($row % 2 -eq 0){'b'}else{'a'}
       if($script:RAT -contains $ci){ return ('<c r="'+$col+$row+'" s="'+$script:XFM['ratio_'+$par]+'"') }
       $t='text'; if($script:CUR -contains $col){$t='cur'}elseif($script:PCT -contains $col){$t='pct'}elseif($script:INT -contains $col){$t='int'}elseif($script:DATE -contains $col){$t='date'}
       return ('<c r="'+$col+$row+'" s="'+$script:XFM[$hue+'_'+$par+'_'+$t]+'"')
     } elseif($script:MODE -eq 'doc'){
       if($row -eq 1){ return ('<c r="'+$col+$row+'" s="'+$script:XFM['H_slate']+'"') }
       if($ci -eq 0){ return ('<c r="'+$col+$row+'" s="'+$script:XFM['indigo_b_text']+'"') }
       $par= if($row % 2 -eq 0){'b'}else{'a'}
       return ('<c r="'+$col+$row+'" s="'+$script:XFM['slate_'+$par+'_text']+'"')
     } else {
       if($row -eq 1){ return ('<c r="'+$col+$row+'" s="'+$script:BAN+'"') }
       $s= if($mm.Groups[3].Success){[int]([regex]::Match($mm.Groups[3].Value,'\d+').Value)}else{0}
       $nf3= if($s -lt $script:XFNUM2.Count){$script:XFNUM2[$s]}else{0}
       $par= if($row % 2 -eq 0){'b'}else{'a'}
       $i2=$script:CACHE2["$nf3`_$par"]; if($null -eq $i2){ return $mm.Value }
       return ('<c r="'+$col+$row+'" s="'+$i2+'"')
     }
   }
   $xml=[regex]::Replace($xml,'<c r="([A-Z]{1,3})(\d+)"(\s+s="\d+")?',$ev)
   PutE $zip $path $xml; $done++; Write-Host ('  '+$c.mode+': '+$name)
 }
 Write-Host ("Hojas formateadas: "+$done+" | cellXfs final: "+$idx)
} finally { $zip.Dispose() }
