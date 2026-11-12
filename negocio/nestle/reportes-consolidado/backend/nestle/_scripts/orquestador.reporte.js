// orquestador.reporte.js — RETIRADO el 25-ago-2026. Ya no corre.
//
// 🔴 QUÉ ERA. «El camino corto»: de los JSON de fuentes al `Report_Resumen`, saltándose las hojas
//    de datos. Nació el 20-ago cuando Rick pidió modo ahorro, y el skill del orquestador lo
//    anunciaba como **el DEFAULT**.
//
// 🔴 POR QUÉ SE RETIRA. Lo destapó la validación adversarial de la cadena de skills (`S3-97`,
//    ataque A7: *«¿queda un camino que encadene scripts SIN pasar por la cadena?»*). Dos motivos, y
//    el segundo es el grave:
//
//      1 · Es un SEGUNDO RUNNER del corte. Rick cerró eso el 25-ago: «los scripts están contenidos
//          en los skills; el sistema plano anterior no se vuelve a usar». Un segundo runner es
//          exactamente un runner plano con otro nombre.
//
//      2 · 🔴 PRODUCÍA UN REPORTE DISTINTO. Encadenaba `orquestador.resumen.js`, que empareja cada fila con
//          su celda por IDENTIDAD. La cadena usa `resumen.regenerar.js`, que REGENERA desde la rejilla
//          justamente porque emparejar por identidad falla cuando una pieza se renombra —
//          «Espresso Con» → «Hackea tu café» dejó filas huérfanas. Así que este atajo y la cadena
//          daban dos reportes diferentes del mismo dato, y el que corría antes ganaba.
//          Un atajo que produce otro resultado no es un atajo: es una segunda verdad.
//
// 🔴 QUÉ HACER EN SU LUGAR. El camino corto ya existe dentro de la cadena, y es un flag:
//
//        node orquestador.orquestador.js --desde motor-calculo --escribir
//
//    Arranca en la etapa 11 (el motor) y sigue con resumen → insights → formato → PUERTA 2. Mismo
//    ahorro, un solo runner, y el reporte que produce es EL de la cadena.
//
// El archivo no se borra: se niega a correr. Borrarlo dejaría que cualquier script o nota que lo
// invoque falle con «no such file» —un error que se lee como un problema de instalación— en vez de
// decir lo que de verdad pasa.
console.log('');
console.log('  🔴 orquestador.reporte.js está RETIRADO (25-ago-2026).');
console.log('');
console.log('     Era un segundo runner del corte, y producía un reporte DISTINTO al de la cadena:');
console.log('     encadenaba `orquestador.resumen.js` (empareja por identidad) mientras la cadena usa');
console.log('     `resumen.regenerar.js` (regenera desde la rejilla). Dos verdades del mismo dato.');
console.log('');
console.log('     El camino corto ahora es un flag de la cadena de skills:');
console.log('');
console.log('        node orquestador.orquestador.js --desde motor-calculo --escribir');
console.log('');
console.log('     Arranca en la etapa 11 (motor) y sigue hasta la PUERTA 2.');
console.log('');
process.exit(1);
