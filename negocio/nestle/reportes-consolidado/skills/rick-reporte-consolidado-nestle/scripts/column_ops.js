/*
 * column_ops.js — mover / insertar columnas en un .xlsx SIN romper fórmulas.
 * ─────────────────────────────────────────────────────────────────────────
 * POR QUÉ EXISTE: editamos el XML del .xlsx por fuera de Excel (COM cae seguido).
 * Excel, al insertar/mover una columna por su UI, reescribe TODAS las referencias
 * automáticamente; al editar el XML a mano eso NO pasa y las fórmulas quedan
 * apuntando a la columna equivocada → "reporte roto". Este módulo replica esa
 * reescritura de forma verificada.
 *
 * REGLA DE ORO: dentro de una fórmula sólo se recorren las referencias
 * WITHIN-SHEET (a la propia hoja). Las cross-sheet (Data_Email!$T:$T) y los
 * strings entre comillas ("Walmart") se PROTEGEN y NO se tocan.
 *
 * USO (siempre sobre copia ASCII en HOME; ver reglas de rutas con acento):
 *   const {moveColumn, insertColumns} = require('.../scripts/column_ops.js');
 *   let xml = zip.readAsText('xl/worksheets/sheet2.xml');
 *   xml = moveColumn(xml, 36, 4);      // mover col AJ(36) -> D(4)  (rotación)
 *   xml = insertColumns(xml, 11, 2);   // insertar 2 cols en K(11) (shift +2)
 *   zip.updateFile('xl/worksheets/sheet2.xml', Buffer.from(xml,'utf8'));
 *   // ...luego inyectar celdas nuevas (header + fórmulas) en las cols liberadas.
 *
 * ⚠️ DESPUÉS SIEMPRE VERIFICAR (sin Excel disponible):
 *   1) estructural: 0 t="shared", 0 #REF, celdas en orden ascendente por fila,
 *      _xlfn.XLOOKUP/MINIFS presentes (no _xludf), SheetJS abre las 22 hojas.
 *   2) semántico: RECOMPUTAR en JS los SUMIFS/MINIFS contra la fuente y comparar
 *      con el <v> cacheado (que NO cambia al mover). Si empatan, las refs quedaron
 *      bien. Ver _verify_move.js / _verify_dates.js como plantilla.
 *   Las celdas sólo-fórmula (sin <v>) dan .f undefined en SheetJS → leer XML crudo.
 */
function c2n(l){var n=0;for(var i=0;i<l.length;i++)n=n*26+(l.charCodeAt(i)-64);return n;}
function n2c(n){var s='';while(n>0){var m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=(n-m-1)/26;}return s;}

// remapea las refs within-sheet de una fórmula usando newcol(colNum)->colNum
function xformFormula(f,newcol){
  var store=[],i=0;
  // 1) proteger cross-sheet:  Hoja!ref  (Data_Email!$AN:$AN, 'Mi Hoja'!$A1, etc.)
  f=f.replace(/((?:'[^']+'|[A-Za-z_][A-Za-z0-9_]*)!)(\$?[A-Z]{1,3}\$?\d*(?::\$?[A-Z]{1,3}\$?\d*)?)/g,function(m){store.push(m);return '\x00'+(i++)+'\x00';});
  // 2) proteger strings entre comillas ("...", ya XML-escapadas &quot;...&quot;)
  f=f.replace(/&quot;(?:(?!&quot;)[\s\S])*&quot;/g,function(m){store.push(m);return '\x00'+(i++)+'\x00';});
  f=f.replace(/"(?:[^"])*"/g,function(m){store.push(m);return '\x00'+(i++)+'\x00';});
  // 3) recorrer refs de celda within-sheet ($?COL$?ROW)
  f=f.replace(/(\$?)([A-Z]{1,3})(\$?)(\d+)/g,function(m,d1,col,d2,row){return d1+n2c(newcol(c2n(col)))+d2+row;});
  // 4) restaurar
  f=f.replace(/\x00(\d+)\x00/g,function(_,k){return store[+k];});
  return f;
}

// aplica una función newcol(colNum)->colNum a TODA la hoja (celdas + fórmulas + reordena)
function applyNewcol(xml,newcol){
  return xml.replace(/<row\b([^>]*)>([\s\S]*?)<\/row>/g,function(whole,attrs,body){
    var cells=body.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g)||[];
    if(!cells.length)return whole;
    var out=cells.map(function(cell){
      var mref=cell.match(/\br="([A-Z]+)(\d+)"/);if(!mref)return {c:1e9,xml:cell};
      var nc=newcol(c2n(mref[1]));
      var ncell=cell.replace(/\br="[A-Z]+\d+"/,'r="'+n2c(nc)+mref[2]+'"')
                    .replace(/(<f\b[^>]*>)([\s\S]*?)(<\/f>)/,function(_,a,fx,b){return a+xformFormula(fx,newcol)+b;});
      return {c:nc,xml:ncell};
    });
    out.sort(function(a,b){return a.c-b.c;});
    return '<row'+attrs+'>'+out.map(function(o){return o.xml;}).join('')+'</row>';
  });
}

// MOVER una columna (rotación). from y to en número (A=1). Ej: mover AJ(36) a D(4).
function moveColumn(xml,from,to){
  var newcol=function(c){
    if(c===from)return to;
    if(to<from){ if(c>=to&&c<from)return c+1; } // mover a la izquierda
    else       { if(c>from&&c<=to)return c-1; } // mover a la derecha
    return c;
  };
  return applyNewcol(xml,newcol);
}
// INSERTAR `count` columnas vacías en la posición `at` (todo lo >= at se corre +count).
function insertColumns(xml,at,count){
  return applyNewcol(xml,function(c){return c>=at?c+count:c;});
}
// util para actualizar <dimension>
function bumpDimension(xml,extraCols){return xml.replace(/<dimension ref="A1:([A-Z]+)(\d+)"/,function(_,col,row){return '<dimension ref="A1:'+n2c(c2n(col)+extraCols)+row+'"';});}

module.exports={c2n:c2n,n2c:n2c,xformFormula:xformFormula,applyNewcol:applyNewcol,moveColumn:moveColumn,insertColumns:insertColumns,bumpDimension:bumpDimension};
