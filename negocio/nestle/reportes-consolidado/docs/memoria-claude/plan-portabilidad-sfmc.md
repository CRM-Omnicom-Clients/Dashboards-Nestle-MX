---
name: plan-portabilidad-sfmc
description: "CERRADO 2-oct-2026 (kit crm-reporte-mcp-nestle-sfmc entregado y verificado en vivo; validación adversarial cerrada el 6-oct con 407 pruebas; HEAD e76b333 y 449 pruebas desde el 22-oct, con un instalador opcional de CRM_Email_Links_Dia): hacer portable el pipeline de email SFMC de Nestlé. Plan de 7 etapas, decisiones, límites y pendientes de Rick (rotar secrets, migración EmailName-PK) — leerlo antes de retomar"
metadata:
  node_type: memory
  type: project
  originSessionId: 3fcc95e0-6a7f-416d-8815-86a488810f41
  modified: 2026-10-23T01:19:47.272Z
---

**Objetivo (Rick, 2-oct-2026):** que otras personas operen el pipeline de reporteo de email de
Nestlé (SFMC, BU NMX) con los mismos procesos. Pidió un skill con: cómo conectarse, la
arquitectura (DEs, queries, automation `CRM_Reporte_Diario`, catálogo), los procesos (agregar
pieza, refrescar, lag de propagación, reglas duras) y las restricciones de seguridad.

**Decisiones tomadas (no re-litigar):**
- El kit es un skill **autocontenido**: `~/.claude/skills/crm-reporte-mcp-nestle-sfmc/` (SKILL.md, docs/,
  lib/, scripts/, tests/, config/ con solo la plantilla). **Renombrado el 2-oct-2026 por pedido de Rick** de `crm-reporte-mcp-nestle-sfmc` a `crm-reporte-mcp-nestle-sfmc`:
  forma parte del sistema `crm-reporte-*` (el otro sistema cambió su prefijo `rick-reportes-` → `crm-reporte-` ese mismo día). Un skill con ese prefijo lo recorren sus
  herramientas: `orquestador.llevar-a-carpeta.js` copia las carpetas de los skills ENTERAS a SharePoint → por eso el estado local ya no vive en la carpeta del kit (ver abajo).
- Credenciales: env → `~/.claude.json` (mcpServers.sfmc-nestle.env) → `conexion.txt` SOLO LECTURA.
  Nada persiste fuera de eso. Ningún código del kit escribe/borra `conexion.txt`.
- La **migración a PK=EmailName NO se ejecuta** en este plan (toca DEs vivas + automation: pedir OK).
  El kit queda preparado (capa de llave ConfigKey|EmailName) y documentada.
- `scripts-nestle/` NO se borra: se marca deprecado y el kit pasa a ser la fuente de verdad.
- WhatsApp y Qcart fuera de alcance (solo email).
- Docs viejos a marcar como SUPERADOS: `_mcp-sfmc/docs/REPORTE-NESTLE-OPERAR.md` (3 queries, sin
  schedule, catálogo vía Excel) y `CONECTAR-Y-DESCONECTAR.md` (dice que el script borra el txt).

**Plan:** E0 línea base · E1 auditoría+diseño · E2 lib/ (paths, credenciales, cliente, DEs con
centinela `__FIN__`, config+descubrir, capa de llave) · E3 scripts (doctor, conectar, resolver,
agregar-pieza, refrescar-pieza, audiencias, snapshot) · E4 skill+docs · E5 empaquetado+commit ·
E6 prueba e2e "operador nuevo" + lectura en frío por subagente + auditoría de seguridad.

**Hechos medidos (2-oct-2026):**
- token SFMC dura **1080 s (18 min)**; los refrescos manuales rondan 15 min → hace falta auto-refresh.
- conexion.txt línea base: 1334 bytes, mtime 2026-09-08 17:13:58 -0600 (comparar en 6.3).
- 6 DEs (filas: Config 112 · Detalle 752 · Piezas 111 · Auditoría 112 · Links 980 · Audiencias 99),
  5 queries (Vol/Detalle=Update, Links/Piezas/Auditoría=Overwrite), automation Scheduled diaria 00:08
  Central (sin DST), 4 pasos: Vol+Links → Detalle → Piezas → Auditoría. Cero CRM_Tmp_* huérfanos.
- Foto cruda de la arquitectura: se copia a `tests/fixtures/` del kit en 1.2.

**Lecciones medidas EN VIVO (no estaban en ningún doc; mordieron al construir el kit):**
- SFMC rechaza nombres de CAMPO que empiezan con `_` (HTTP 400 "Field name cannot begin with an underscore"). El VALOR sí puede.
- `CRM_Reporte_Config`: `Notas` admite **200** chars, `Activo` 3, `Marca/Campana` 60, `Touchpoint` 40, `EmailName` 200, `ConfigKey` 50.
- Las 4 DEs de salida (Detalle/Piezas/Auditoría/Links) ya traen `EmailName` ⇒ contar la pieza por EmailName sirve antes y después de la migración.
- La BU tiene ~2038 queries (41 páginas) y ~784 automations: listar por nombre cuesta, pero es 1 vez.
- Una query temporal sin fila centinela NO distingue «0 filas» de «aún no termina»: el kit agrega `__FIN__`.
- Limpiar «todo lo registrado» en el finally de UNA consulta borra lo de otra en curso: cada una limpia solo lo suyo.
- Detector de secretos por FORMA (SFMC_ + mezcla + límite de palabra), no por palabra: `TD_SFMC_GLOBAL_IP…` es un nombre de DE.
- SFMC RECHAZA un comentario (`/* */` o `--`) dentro de una SUBCONSULTA (HTTP 400 "Incorrect syntax near the keyword 'SELECT'"); la creación de una
  query VALIDA la sintaxis al instante (sirve para bisecar sin ejecutar). `consultarTemp` envuelve el SQL en subconsulta ⇒ `quitarComentariosSql`.
- Una query "Overwrite" NO puede leer su propia DE destino ("Update Type must be 'Update' or the target data extension cannot appear in the
  query"): la Vol real es Update; las temporales de consultarTemp son Overwrite hacia una DE distinta.
- Las queries NO exponen estado por REST; la automation sí (statusId 3 = corriendo). Detalle tarda ~7 min; refresco completo ≈ 9 min.
- El catálogo (o cualquier objeto del reporte) no puede llamarse con el prefijo temporal `CRM_Tmp_` (config.validar): para probar con copias se usa otro `prefijoTemporales`.
- `os.homedir()` en Windows falla (ENOBUFS) si USERPROFILE pasa de ~260 chars.

**Avance (actualizado 2-oct-2026):** E0 ✅ · E1 ✅ · E2 ✅ (c221c54) · **E3 ✅ COMPLETA** (226 pruebas): doctor+conectar (06138ec),
resolver (a318b77), agregar-pieza (a3aea02), refrescar-pieza (1a0c11d), audiencias (81c317e), snapshot (4e52469). El kit vive en
~/.claude/skills/crm-reporte-mcp-nestle-sfmc/ (SIN SKILL.md hasta 4.1, a propósito). La config y las fotos son locales y desde el renombre viven FUERA de la carpeta del kit.
**E4 (2-oct-2026, tarde):** 4.1–4.6 ✅ commit ffb8d2c (246 pruebas): SKILL.md + docs CONEXION/ARQUITECTURA/PROCESOS/SEGURIDAD/MIGRACION-EMAILNAME-PK
(la guía es un PLAN, no ejecutado), `snapshot.js --con-datos` (respaldo de filas del catálogo+audiencias; 113 y 99 en vivo; fila perdida = estructural),
`lib/difsql.js` (el mapa de cambios de SQL de la guía son bloques ```diff-sql que el código aplica y las pruebas verifican contra la foto E0).
**E4 ✅ CERRADA (2-oct-2026):** commits 5600993 (INSTALAR.md + tests/docs.test.js, 261 pruebas, 27 mutaciones detectadas; el lint pide los --help sin credenciales y
atrapa tablas markdown rotas, flags inventados, permisos inventados, cifras que no coinciden con el código, rutas con usuario) y df711c2 en el repo `~/.claude/tools`
(banners SUPERADO en `_mcp-sfmc/docs/REPORTE-NESTLE-OPERAR.md` y `CONECTAR-Y-DESCONECTAR.md`).
**E5 ✅ CERRADA (2-oct-2026):** 31bcf68 (hallazgo del escaneo estático: `descubrir.js --out` y `snapshot.js --out` aceptaban CUALQUIER ruta → podían pisar conexion.txt o
~/.claude.json; ahora `paths.exigirEscrituraSegura` + `errorDeArchivoSeguro` (un error de lectura de JSON ya no repite el contenido del archivo) + tests/escritura-segura.test.js y
tests/sin-secretos.test.js (escaneo de secretos de todo lo versionable; el kit solo escribe en lib/config.js y lib/snapshot.js, nunca borra, no lanza procesos, solo habla con
marketingcloudapis.com); 290 pruebas, 52 mutaciones detectadas) · 9adbe39 en `~/.claude/tools` (README de scripts-nestle DEPRECADO con tabla de equivalencias) · memorias
`pipeline-reporte-nestle`, `migracion-emailname-pk`, `identidad-emailname-regla-dura` reescritas/corregidas (apuntan al skill; sin pasos viejos).
**E6 EN CURSO (2-oct-2026 tarde):** 6.1 línea base ✅ (conexion.txt 1334 B / mtime 2026-09-08 17:13:58 intacto; catálogo 113 filas huella 7d317a8de2f09fe3; audiencias 99 filas
huella 5f08aaa5f2b21c73; Vol SQL f31444ea…; automation Scheduled, próxima 00:08; 0 temporales) · 6.2 copia limpia ✅ (zip de `git archive` = 63 archivos, byte-idéntico al kit; hizo falta
`.gitattributes` eol=lf: el zip salía con CRLF por autocrlf) · 6.3 operador nuevo ✅ (HOME vacío; variante A solo env: node --test 290/290, conectar con MID descubierto, descubrir, doctor
"sin fallas", resolver, snapshot y cruce contra el kit real: estructura idéntica; variante B solo conexion.txt señuelo: ok y el archivo quedó byte a byte igual y sin escribir). HALLAZGOS
arreglados (commit 21d6060): `descubrir` no agregaba a una config vieja los campos nuevos de la plantilla (ahora `completarConEjemplo`); el resolver tarda 30-90 s (no 30-40) · 6.4 caso
nuevo ✅: desde la copia limpia, alta de ERIT1 rechazada (exit 3 aun con --escribir), alta SIMULADA de ERIT2 (nombre real de _Job aún no registrado) válida sin tocar el catálogo, y
`refrescar-pieza.js` REAL de ERIT1: aterrizó en todo (18 min; Detalle necesitó 2 intentos = **el lag de propagación verificado en vivo**, una pieza registrada ~2 h antes igual
necesitó una 2ª corrida). Verificación independiente antes/después: Piezas 111→112, Auditoría 112→113 (ERIT1 Estado OK), Detalle 752→754 (nada perdido; ERIT1 2 filas, 4,102 envíos = el
conteo de `_Sent`), Links 980→983; las otras piezas solo cambiaron en métricas vivas de hoy.
**6.5/6.6 ✅ (2-oct-2026 tarde; commit 710271f; 350 pruebas):** 2 lecturas en frío por subagentes (operador nuevo / revisor de seguridad) → hallazgos corregidos, cada uno con prueba y mutación
detectada: URLs fijadas al tenant (las credenciales no viajan a otro dominio), registro de secretos y redactar ANTES de recortar, guardia (query temporal solo hacia DE temporal; Vol no se
re-apunta; isSendable; PUT), refresco fail-closed (automation o fecha ilegible BLOQUEA; re-verifica antes de iniciar CADA query; salida 3), consultarTemp con relecturas estables, limpiar-tmp
validado y sin tocar objetos del reporte, rutas de escritura (sin UNC ni dentro del kit) y **F8 texto ajeno** (`lib/textoseguro.js`: lo invisible sale como \uXXXX en terminal y --json, `$(…)`
no se pega en comandos sugeridos; probado con bash y PowerShell REALES; quitó 5 BOM reales incrustados en el código; prueba Trojan Source). Mutaciones: 41 (controles de seguridad) + 41 (texto
ajeno) detectadas; 2 sobrevivientes del segundo lote (sinBom, salidaJson) → pruebas reforzadas y re-verificadas. La suite tarda ~23 s (antes 10): dos pruebas arrancan bash/PowerShell de verdad.
**6.7 ✅ (2-oct-2026 ~18:00; HEAD 2cc9882 = 710271f + docs):** instalación limpia reconstruida con `git archive` (65 archivos = git ls-files, idéntica byte a byte), HOME vacío: variante A (solo env: 350 pruebas en 25 s,
conectar con MID descubierto, descubrir con config IDÉNTICA a la del kit real, doctor "sin fallas", resolver ERIT1, snapshot con estructura idéntica) · caso nuevo SIN escribir (ERIT1 duplicada rechazada con exit 3 aun con
--escribir; ERIT2 —EmailName real aún no registrado— válido en simulacro; `refrescar-pieza --dry-run` leyó la automation viva con el código fail-closed nuevo) · texto hostil en vivo (comilla, %, [, ", $(...), ESC y RLO contra el
motor SQL real: negativo REAL exit 2, sin ESC/RLO en la salida, JSON idéntico al parsearlo, nada ejecutado, catálogo intacto) · variante B (solo conexion.txt: conectar/doctor/descubrir ok; archivo byte a byte igual y señuelo borrado).
**6.8 ✅ auditoría (2-oct):** conexion.txt intacto (1334 B, mtime y huella iguales) · catálogo 113 filas huella 7d317a8de2f09fe3 · SQL de Vol igual · automation Scheduled, próxima 00:08, 4 pasos, última corrida la de la madrugada
(nadie la corrió a mano) · 0 CRM_Tmp_* y 0 ZZSbx_* · las 4 tablas de salida idénticas a como quedaron en 6.4 · CRM_Audiencias: 99 filas, 0 cambios en columnas no volátiles; solo `LastRefresh` de las 99 (lo movió el paso Vol del refresco
real de 6.4; Audience_Volume no cambió en ninguna) · secretos: 0 en el kit, los 3 repos (toda su historia), la memoria, la copia limpia y los archivos del scratchpad; el secret ACTUAL y el de agosto SOLO están en la transcripción
local de la sesión (el de agosto también en `~/.claude.json.backup`) → ver sfmc-nestle-mcp. Se borraron de %TEMP% la copia limpia y 50 directorios sueltos de pruebas.
**Veredicto:** objetivo cumplido y verificado en vivo para la BU NMX en Windows con Node 24 (350 pruebas; 82 mutaciones de seguridad detectadas en E6). NO verificado: UI de SFMC (pasos de CONEXION.md solo de la doc oficial), Mac/Linux, Node 18,
otra BU/tenant, cmd.exe, bloqueo con la automation corriendo (solo simulador), refresco REAL completo tras el endurecimiento. Pendientes de Rick: rotar secrets, OK/fecha de la migración EmailName-PK, piezas sin registrar (ERIT2…).
**Posterior (6-oct-2026):** validación adversarial cerrada por Rick (HEAD 6228905, 407 pruebas, árbol limpio); `parseArgs` ahora RECHAZA opciones desconocidas (la ayuda es `--help`, no `--ayuda`). ERIT2 y las demás piezas
de la lista de Rick ya se dieron de alta con el kit: ver [[altas-validacion-real-oct2026]].
**Posterior (22-oct-2026):** HEAD e76b333, 449 pruebas. El kit ganó un instalador OPCIONAL (`scripts/instalar-links-dia.js`) y con él un MODO INSTALACION de la guardia (tres objetos con nombre escrito; Rick lo pidió): ver [[links-por-dia-diseno]]. Lo que se aprendió de la API de automations de SFMC (nacen en PausedSchedule; solo las activa el endpoint legacy) está en [[sfmc-api-automations-aprendizajes]]. Antes, el commit 288e851 arregló el falso positivo de secretos con nombres de DE con guion.
**Límite honesto:** el refresco REAL completo (queries de producción) no se repitió tras el endurecimiento del refresco (el último fue el de 6.4); se valida con el simulador + una lectura viva
de la automation (`refrescar-pieza.js --dry-run`). Repetirlo = ~9-18 min de las mismas queries que corre la automation, pero es "editar" producción: pedir OK a Rick.
(Plan original de E6:) **E6** = e2e "operador nuevo": zip con `git archive` (el comando de INSTALAR §7) → extraer en carpeta limpia → HOME vacío + credenciales solo por env (y variante conexion.txt
en carpeta señuelo) → seguir INSTALAR.md al pie de la letra (`node --test`, conectar, descubrir --dry-run y real, doctor, resolver, snapshot y comparar contra el kit real, agregar-pieza
simulacro + rechazo de duplicado, refrescar-pieza REAL de ERIT1 = el caso nuevo) · lectura en frío por 2 subagentes (operador nuevo / revisor de seguridad) · auditoría de seguridad
(0 secretos incl. el transcript de la sesión, 0 `CRM_Tmp_*`/`ZZSbx_*`, conexion.txt intacto vs línea base 1334 bytes / mtime 2026-09-08 17:13:58 -0600, huella del catálogo
7d317a8de2f09fe3 y estructura intactas) · veredicto honesto con lo no verificado en vivo.

**Renombre, estado local y carpeta ordenada (2-oct-2026 tarde; commits 805e512 skills · cd951a4 tools):**
- Nombre: `crm-reporte-mcp-nestle-sfmc` (Rick: «debe llevar nombre como crm-reporte-…», luego «sería más bien crm-reporte-mcp-nestle-sfmc» y «formas parte de ese sistema»). Antes: `sfmc-email-pipeline`.
- **Estado local FUERA del kit**: config con los IDs de la BU y fotos viven en `%LOCALAPPDATA%\crm-reporte-mcp-nestle-sfmc\` (Mac/Linux `~/.local/share/...`; `SFMC_PIPELINE_DIR` lo mueve). El kit se niega a escribir
  dentro de su carpeta y `doctor.js` avisa de restos. La config y las 3 fotos de Rick se movieron ahí (sha256 verificado). Las **claves** siguen en `%LOCALAPPDATA%\sfmc-mcp\conexion.txt` (solo lectura para el kit)
  y, para el MCP, en `~/.claude.json` (bloque sfmc-nestle): hoy conectar.js usa claude.json; el conexion.txt tiene un package viejo (2n6x…, 401).
- **Carpeta ordenada para Rick/equipo**: `…\CRM General\crm-reporte-mcp-nestle-sfmc\` (SharePoint COMPARTIDO CON EL CLIENTE). La carpeta ES el skill (LEEME.md, SKILL.md, docs, lib, scripts, tests) + `_MANIFIESTO.json`.
  Se publica con `node ~/.claude/tools/crm-reporte-mcp-nestle-sfmc.llevar-a-carpeta.js --escribir` (simulacro sin la bandera; `--autoprueba` se prueba solo): copia el ÚLTIMO COMMIT, antes corre las pruebas desde una carpeta
  temporal, se detiene si el kit tiene cambios sin commitear, si alguien editó la copia a mano (`--forzar`) o si aparece un dato local/clave en la carpeta. NO publicar nada con claves ni fotos ahí.
- `Sistema-Reportes-CRM` (su tool `orquestador.llevar-a-carpeta.js`) es OTRA cosa de otra sesión; su regex de skills (`/^rick-reportes/`) aún no se había actualizado: cuando lo hagan, copiará también este skill (ya es seguro).
**Hallazgos de la guía de migración (medidos en vivo 2-oct-2026; los que Rick debe saber):**
- 🔴 `CRM_Email_Detalle` guarda HISTORIA IRRECUPERABLE: de sus 8 JobID más viejos, 6 (envíos 14–20 mar) ya no tienen eventos en `_Sent` (retención ~6 meses).
  Nunca borrarla/recrearla/pasarla a Overwrite. Por eso su query es Update. Piezas y Auditoría sí son regenerables (Overwrite); Links también.
- 🔴 Rick dijo "nada depende de ConfigKey", pero **38 archivos de código** la usan: 22 vivos en `~/.claude/reportes-backend/nestle/_scripts/` (lib-fechas-envio,
  motor.links, fuentes-email.refrescar-volcado, fuentes-insumos.refrescar-metricas, resumen.piezas-por-quincena…; leen `r.ConfigKey` de los volcados sfmc-piezas/detalle/links
  y NO fallan si falta: agrupan en una fila vacía) + 6 en `_aplicados/` + 10 en `tools/_mcp-sfmc/scripts-nestle` (los viejos que reemplaza el kit). Hay que migrarlos
  ANTES de quitar la columna, o elegir Opción B (puente: ConfigKey como columna normal). Pendiente la decisión de Rick (§9 de la guía). NO se tocó nada de eso.
- Ensayo con objetos temporales: recrear una DE con el MISMO nombre+CustomerKey es inmediato y las queries la siguen por key (no hace falta re-apuntar; el PATCH de
  destino también funciona); `HASHBYTES` existe (hashea Unicode). Las 6 DEs: sin retención/descripción, no sendables, carpeta 445199.
- Ensayo de los 5 SQL nuevos (vieja vs nueva, a la vez, tablas temporales): idénticas (Vol 99 · Detalle 748 · Piezas 111 · Auditoría 113 · Links 983). Links: con
  `EmailName|URL` 20 de 980 RowKey pasan de 400 (máx 429) y 0 colisiones (con tope 300 serían 2).
- El respaldo con datos está en `%LOCALAPPDATA%\crm-reporte-mcp-nestle-sfmc\snapshot\snapshot-2026-10-02_1446-10966050.json` (local, trae datos del cliente; antes vivía en la carpeta del kit). Los scripts de ensayo y verificación
  de la guía eran sueltos (scratchpad de la sesión): `scripts/migracion-ensayo.js` y `scripts/migrar-llave.js` NO existen (la guía §8 lo dice).
Idioma: código/docs del kit en ESPAÑOL (equipo de Rick); respuestas al usuario en inglés (instrucción del sistema).
Diseño de 3.4 (hecho): por defecto SIMULACRO (`--escribir` inserta); valida contra el catálogo vivo (Marca≠Campaña cruzadas, ortografía por
normalización, duplicado por EmailName exacto). Prueba SIN tocar producción: catálogo SANDBOX = copia temporal + config con otro
`prefijoTemporales` (el catálogo no puede llamarse con el prefijo temporal: lo prohíbe config.validar). Huella sha256 del catálogo
de producción: 75476159eb35ef57 (112 filas, 16 columnas) — idéntica antes/después de todas las pruebas.
Diseño de 3.5 (hecho): señal = sello ANTES/DESPUÉS por EmailName; re-corre si la corrida terminó sin la pieza (lag); bloquea si la
automation corre o arranca en <20 min.
**Decisiones de Rick (2-oct-2026, tras 3.5):**
- Audiencias: NO aplicar `audiencias.js --escribir` en producción. La atribución de audiencia se hace en SU proceso de atribución del
  catálogo; no hay que tocar CRM_Audiencias ni la query Vol de producción. La herramienta queda en el kit (validada solo en sandbox).
  **SUPERADO el 7-oct-2026 solo para los 14 correos de su lista:** Rick ordenó mapearlas y se hizo (ver [[altas-validacion-real-oct2026]]). Para cualquier OTRA pieza sigue valiendo «no escribir en CRM_Audiencias ni en Vol sin que lo pida».
- Registrar la pieza viva `…_V2_024241_ERIT1` (EmailID 86192): Concentrate / Hackea tu café / E-Rit1* (inferido del sufijo, como su E-Rit3);
  aún sin envío masivo (jobs 24-sep→hoy 19:00). Registrada DESPUÉS de cerrar la validación en vivo de 3.6 (para no ensuciar su prueba de "catálogo intacto").
- El refresco real de AON EP3 en producción: enterado y de acuerdo.
- Migración EmailName como PK: Rick confirma el OBJETIVO y que NADA suyo depende de ConfigKey ("todo conectado por email name,
  ConfigKey no lo usamos"), pero NO dio aún la orden de ejecutarla. Acordado: terminar primero el kit y volver con un plan concreto
  (recrear 4 DEs + reescribir 5 queries + pausar la automation + respaldo/rollback) para su OK y fecha (fuera de las 00:08).
- Punto "no verificado en vivo": Rick dijo "lo revisamos después"; el veredicto final los etiqueta como solo-simulador.
- ✅ HECHO 2-oct: ERIT1 registrada en el catálogo de producción (ConfigKey TMP-CONCENTRATE-E-RIT1, verificada por relectura). Catálogo = 113 filas,
  huella sha256 7d317a8de2f09fe3 (la de 112 filas era 75476159eb35ef57). Tiene 4,102 envíos en _Sent (30-sep→1-oct): la corrida de las 00:08 la carga.
  Pendiente: refrescarla con refrescar-pieza.js = prueba real de "pieza NUEVA" (E6), cuidando de no correrla a la vez que pruebas que miren la huella de audiencias.

**Medido en vivo (3.5):** refresco completo ≈ 9 min (vol 55 s · links 59 s · detalle 7 min · piezas 35 s · auditoría 24 s). Las queries
NO exponen estado por REST (la definición no trae "status"); la automation sí (statusId 3 = corriendo).
**Hallazgo para Rick (no tocado):** el resolver ("NC00") lista 84 nombres de `_Job` que NO están en el catálogo; uno vivo es
`…_V2_024241_ERIT1` (asunto "Ya conoces el hack de café frío", 9 jobs, 24-sep→2-oct, EmailID 86192) — posible pieza Espresso/Concentrate sin registrar.
**No verificado en vivo:** reintento por lag y bloqueo con la automation corriendo (solo simulador); escritura real de agregar-pieza
solo en sandbox (nunca en el catálogo de producción).

**Más hechos medidos (E3.2/E3.3):**
- El conexion.txt de Rick (package del 8-sep) YA NO conecta (401 invalid client); el vivo está en ~/.claude.json
  (client 2cimnuty…). `conectar.js` lo detecta como "desactualizado" y no culpa al vigente.
- `os.homedir()` en Windows falla con ENOBUFS si USERPROFILE pasa de ~260 chars (solo afecta pruebas con rutas largas).
- `_Job.DeliveredTime` viene VACÍO en la mayoría de jobs de journey; `SchedTime` siempre está.
- Escaneo completo de `_Job` ≈ 30-40 s (la latencia la domina el motor, no el escaneo: `--desde` NO acelera de forma medible).
- El repo ~/.claude/skills tiene archivos `rick-reportes-*` staged por OTRA sesión: commitear SIEMPRE con
  `git commit -F <msg> -- crm-reporte-mcp-nestle-sfmc` (pathspec), nunca `git commit -a`. (Un commit que renombra lleva las dos rutas, la vieja y la nueva.)
- La copia con sufijo " - AAAAMM" es OTRO EmailName (J8 vive bajo el nombre de J7 + sufijo; EmailID distinto: 85752 vs 85487).

**Why:** hoy el pipeline vive en la cabeza de una sesión + scripts atados a la máquina de Rick.
**How to apply:** si la sesión se corta, retomar en la etapa marcada arriba; verificar con `git log`
en `~/.claude/skills` qué commits ya existen del kit antes de rehacer nada.
