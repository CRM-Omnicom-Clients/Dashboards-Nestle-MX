process.env.NODE_PATH=require('os').homedir()+'/.claude/tools/node_modules';require('module').Module._initPaths();
var x=require('xlsx'),fs=require('fs');
var w=x.readFile(process.argv[2]);var iws=w.Sheets['Report_Insights'];
if(!iws){ fs.writeFileSync(require('os').homedir()+'/_ins_markers.json',JSON.stringify({head:[],spec:[],bloq:[],lastCol:0})); console.log('Report_Insights eliminado (23-jul-2026) -> markers vacios; los insights viven en Report_Insights_Operativo'); process.exit(0); }
var rng=x.utils.decode_range(iws['!ref']);
var head=[],spec=[],bloq=[];
for(var r=0;r<=rng.e.r;r++){var a=iws[x.utils.encode_cell({r:r,c:0})];var v=a?String(a.v):'';
  if(/QUINCENA:/.test(v))head.push(r+1); else if(/SPECS/.test(v))spec.push(r+1); else if(/^BLOQUE/.test(v))bloq.push(r+1);}
fs.writeFileSync(require('os').homedir()+'/_ins_markers.json',JSON.stringify({head:head,spec:spec,bloq:bloq,lastCol:rng.e.c}));
console.log('markers: head='+head.length+' spec='+spec.length+' bloq='+bloq.length);
