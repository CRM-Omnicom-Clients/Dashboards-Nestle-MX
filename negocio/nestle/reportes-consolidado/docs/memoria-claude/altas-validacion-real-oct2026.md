---
name: altas-validacion-real-oct2026
description: "Primer uso REAL del kit crm-reporte-mcp-nestle-sfmc con la lista de Rick (6-7 oct 2026): 10 correos dados de alta (Concentrate Super Journey, Maggi E-SNM-3, NAN Territorios, KitKat F1), pendientes (E-Rit3* sin envíos, 4 WhatsApp, audiencias) y lo que enseñó (journey≠EmailName, _Job≠envíos, --json calla la limpieza)"
metadata:
  node_type: memory
  type: project
  originSessionId: 3fcc95e0-6a7f-416d-8815-86a488810f41
  modified: 2026-10-26T17:33:51.292Z
---

**Estado al 7-oct-2026 10:45 Central (caduca: verificar en vivo antes de apoyarse en esto).** Rick dio solo NOMBRES DE JOURNEY de 4 campañas; cada uno se resolvió al
`_Job.EmailName` real y se dio de alta con `agregar-pieza.js --escribir` (6-oct 16:30-16:44). Catálogo 113→123 filas, 0 filas existentes cambiadas.
Respaldo previo con filas: `%LOCALAPPDATA%\crm-reporte-mcp-nestle-sfmc\snapshot\snapshot-2026-10-06_1629-10966050.json`.

**Etiquetas que Rick DIO (no volver a preguntar):**
- Concentrate / Hackea tu café, **Super Journey = una fila POR CORREO**: E-Rit2*, E-Rit3*, E-Hack2*, E-Hack3*, E-Hack4* (asterisco = inferido; `E-Rit1*` ya existía). Repiten touchpoint con los
  originales E-Hack3, E-Hack4, E-Rit3 (~37.8k envíos c/u) pero son correos DISTINTOS (EmailName y EmailID distintos): Rick mide por email, no por journey.
- Maggi / Liga MX: `E-SNM-3` (el EmailName trae el token SNM2; manda la etiqueta de Rick). BU RN derivada del catálogo.
- NAN / Territorios / BU "Family Nes" (valores NUEVOS, `--permitir-valores-nuevos`): E-T1, E-T2, E-T3 ↔ journey A1, A2, A3.
- KitKat / F1 / BU Chocolates (nuevos): `E-P1`; "Objetivo: Purchase" va en Notas (no hay columna). Segmento y PiezaID de todas: `*por definir` ([[no-inventar-identificadores]]).

**Resultado:** la automation REAL de las 00:08 del 7-oct cargó 13 de 14 correos (Piezas 121, Auditoría 123 filas): prueba de que basta el alta en el catálogo (join `RTRIM(_Job.EmailName)=EmailName` y
`Activo='Si'`). `E-Rit3*` sigue SIN MATCH porque aún no tiene ni un envío (`_Sent`=0; sus 9 jobs de `_Job` son del 24-sep): se llena sola con el primer envío. Cruce contra `_Sent`: KitKat 309,977 y
E-T1 42,840 coinciden exacto con Piezas. `E-Hack4*` tuvo su primer envío el 6-oct por la noche (entró con la automation).

**Pendiente / no hecho:** 4 journeys de WhatsApp de la lista (2 vs Perú, uno sin etiqueta, y 2 vs Chile; son REST sin correo → skill crm-reporte-fuentes-whatsapp) · audiencias: YA MAPEADAS el 7-oct por orden de Rick (sección de abajo); antes NO, por diseño de
Rick (`audiencias.js --pendientes` lista 12 piezas viejas; las 10 nuevas aún no salen porque el journey se toma de Piezas) · la copia compartida del kit en SharePoint NO se republicó (trae código viejo).

**Principios que enseñó:**
- El nombre de un journey NO es el EmailName (la actividad se llama distinto del envío real): journey → `_JourneyActivity` → `_Job.EmailName`. El nombre real de un journey puede traer un espacio inicial.
- Una fila en `_Job` NO prueba envíos: los correos de journey tienen jobs "cascarón" desde que se publica. Contar `_Sent` (kit: `diagnosticarEnvios` en `lib/refresco.js`) antes de prometer datos. Ver [[identidad-emailname-regla-dura]].
- Lag de propagación otra vez: con la pieza más nueva, la 1ª corrida de Detalle no la ve; refresco completo = 19 min con Detalle en 2 intentos (ver [[plan-portabilidad-sfmc]]).
- Hallazgo del kit, NO corregido: con `--json` los scripts pasan `log` vacío y `consultarTemp` calla "no pude limpiar" (`lib/de.js`, finally). Una simulación dejó huérfana la query
  `CRM_Tmp_alta_fad67f_Load` (creada 16:23 del 6-oct; causa del fallo de borrado no confirmada); se borró con `doctor.js --limpiar-tmp`. Propuesta: avisar siempre por stderr y reintentar el borrado.

**Aclarado el 7-oct por la tarde (verificado en vivo o en la fuente; las DECISIONES de Rick siguen ABIERTAS):**
- Los 3 pares viejo / Super Journey son el MISMO correo (mismo asunto) con EmailName y EmailID distintos: `…048416` (85414) vs `…048416_HACK3` (86190); `…048417` (85439) vs `…048417_HACK4` (86191);
  `…048414` (85440) vs `…048414 _ERIT3` (86194). Sus envíos no se traslapan (viejos hasta 22-sep / 26-sep / 30-sep; nuevos desde 27-sep / 6-oct / aún nada): parece continuación. Rick: «un mismo email name = 1 sola pieza en
  catálogo». Propuesta pendiente de su OK: dos renglones (EmailName = llave) con el MISMO PiezaID y touchpoint sin asterisco. NO verificado: si el motor/Resumen suma dos renglones de igual llave o los marca colisión.
- `Audience_Volume` en Piezas queda VACÍO (no 0) en piezas sin audiencia mapeada.
- Fuente de WhatsApp: `Seguimiento Interno\(Interno) Resultados Whatsapp CRM 2026.xlsx` (6 hojas; guardada 6-oct 16:08). Hoja "Maggi Liga MX": J8/J9/J10 + bloque "SNM1" (filas 26-27) = los 2 WA vs Perú del 29-sep
  (2PM 1,078 env / 864 rec / 453 leídos; 6PM 1,100 / 885 / 418). Los 2 vs Chile (6-oct) NO estaban aún. La fuente llama SNM1 a Perú; Rick lo llama WA-SNM-2 (su numeración va +1; el EmailName de Chile dice SNM2 y él lo llama SNM-3).
  Ningún correo de Perú existe en SFMC (`SNM1`/`VSPER` = 0 en `_Job`).
- El backend (`~/.claude/reportes-backend/nestle`) NO contiene ninguna pieza de hoy: no se corrió un corte ni se tocó el catálogo raíz de Excel.
- Migración EmailName-PK ([[migracion-emailname-pk]]): `migrar-llave.js` NO existe; 37 archivos del motor de reportes mencionan ConfigKey (la guía decía ~22). Decisión A/B de la guía §9 pendiente (la guía recomienda B).

**Decisiones de Rick (7-oct tarde), audiencias y validación — hecho:**
- Super Journey vs viejos (Hack3/Hack4/Rit3): se quedan como piezas SEPARADAS (dos renglones, no se fusionan).
- Alcance de Claude, textual: «solo te toca dar de alta las piezas en todo el proceso de SFMC con las automation y que se refleje bien en la data extensión todos sus valores… nada más». FUERA: WhatsApp, catálogo raíz de
  Excel / backend de cortes, migración EmailName-PK (en pausa hasta que él la pida) y Segmento/PiezaID (los pone él; los 14 correos siguen en «por definir»).
- Audiencias: Rick ordenó mapearlas («hazlo tú, sí puedes») → 14 filas nuevas en `CRM_Audiencias` (99→113) con `audiencias.js --email-name … --escribir` (3 llamadas), query Vol regenerada de 44 a 51 listas (SOLO se agregaron
  ramas; el cierre `) cnt ON …` pasó a la última). Cadena completa corrida en producción incluyendo Vol (10 min, todo ✓) → `Audience_Volume` ya sale en Piezas y Detalle. Volúmenes: Super Journey 9,430 (los 6 correos
  comparten la lista FINAL ATM CONCENTRATE) · viejos Hack3/Hack4/Rit3 37,230 / 37,919 / 37,915 · E-SNM-3 61,784 · NAN 43,368 · KitKat 311,566. Quedan 8 piezas viejas FUERA de su lista sin audiencia (AON Traditional Parents ×2,
  E-PROP1, Liga MX J6-región-sur/J7/J8/J9/J10). `audiencias.js` necesita `--journey-uuid` si la pieza no tiene fila en Piezas (E-Rit3*, cero envíos) o Piezas guarda un UUID que no es el vivo (NAN E-T2).
- Hallazgo NO corregido: Piezas/Detalle guardan Journey_Name «SIMULATION8012 journeyId 3f691a7c…» para NAN E-T1..T3 y Journey_UUID `DB9696E9…` para E-T2 (3 de 121 filas). Causa: la query Detalle usa MAX(JourneyName)/MAX(JourneyID)
  sobre todos los `_Journey` con el mismo VersionID (entran journeys borrados y simulaciones; 'SIMULATION' > 'J_FamilyNes'). No afecta métricas ni audiencia (se une por ConfigKey). Arreglo propuesto: excluir JourneyStatus Deleted y
  nombres SIMULATION% en ese join; exige editar la query Detalle de producción (la guardia del kit lo prohíbe) → pedir OK a Rick.
- Validación de valores (7-oct 16:00): dimensiones y audiencia coinciden catálogo = Piezas = Detalle = Auditoría = CRM_Audiencias en los 14; métricas vs crudos de SFMC (conteo directo por JobID de `_Sent`/`_Bounce`/`_Open` y `_Click` con
  IsUnique/`_Unsubscribe`): 65 comparaciones, 60 idénticas y 5 con 1-8 aperturas de diferencia (entran eventos durante los ~7 min de Detalle); E-Rit3* = 0 envíos crudos. Las aperturas altas de KitKat/NAN SON lo que registra SFMC.

## Lote 2 (20-21 oct-2026): 18 piezas nuevas — HECHO y validado el 21-oct 04:50 (catálogo 123→141, Piezas 139, Auditoría 141)
Rick dio nombres de journey/asset de 4 campañas; se resolvieron contra `_Job` y `_Journey`. Dimensiones de Rick: **KitKat = Marca, F1 = Campaña** (no confundir; KitKat ya estaba como E-P1/Purchase y no se tocó).
- **Ya estaban (no se agregó nada):** ICE E-P1 (`…EM_C_V3_024243` = TMP-NESC-ICE-ENRICH1, Nescafé ICE · The Freshers · GEN Z; su FUP también), AON Purchase E-P1..E-P4 (`…JUN-AON-EP#…982527`, 8 piezas 001-P015..P022: los 4 journeys «…SIN-CLUSTER/WELLNESS/YOUNG/PRODUCTIVE…» envían esos mismos correos), KitKat.
- **Checo** (Nescafé · Marca Clásico · Campaña Checo, valores NUEVOS; Awareness · One-shot): E1-A ← `…CH2_AC_EM_A1_V1_102551` (94,959) y E1-B ← `…A2_V1_102552` (95,291); ambos salieron a la vez desde el journey …102551. Segmento
  «Participantes*» / «Core*» INFERIDO por orden (Rick dijo que él confirma los segmentos). Los A/B chicos van como «E1-B (Test) v1/v2/v3» (`…A_B1…` 12 envíos, `…A_B2…` 9, y `Test_1` 635), segmento *por definir. `Test_1` es un nombre genérico: la
  base NO distingue mayúsculas, así que casa también con el `Test_1` de Pro Plan de jul-2026 (1 envío); el kit exige escribirlo `Test_1`. Auditoría marca esas 3 como DUPLICADO porque son el MISMO asset (EmailID 86681) con 3 nombres por renombres: aviso de diseño, no duplica envíos.
- **ICE E-L1** (Nescafé ICE · The Freshers · GEN Z; Loyalty · One-shot): el journey 108133 envió 3 variantes del mismo mensaje → «E-L1 v1» `…108133` (36,691), «E-L1 v2» EmailName `13` (22,202) y «E-L1 v3» `12` (19,046) (nombres genéricos, solo este journey los usa desde marzo);
  `…117693` (13 envíos reales + 1 prueba) → «E-L1 (Test)».
- **Dog Chow** (BU Purina · Marca Dog Chow · Campaña 100 años, NUEVOS; Recaptación · One-shot): touchpoints E1-F1..E4-F1, E1-F2, E2-F2 y la Fase 3 (E1-F3..E3-F3, lanzada 19-20 oct); segmento *por definir. El E4-F1 es el correo general `O_Purina-Brand-AON-NC005385…` (106,755).
- Los nombres de journey NO coinciden con los EmailName enviados (sufijos `_1A`/`_2B`, `A1`/`A2`, `AC_` que falta en 117693, variantes llamadas «12»/«13»/«test_1»): resolver siempre con el kit.
- Métricas vs crudos de SFMC: 18 piezas, todas ✓ (una con 4 aperturas de diferencia por eventos que entran durante la corrida). El refresh pidió 2 intentos de Detalle (lag, otra vez) y tardó 20 min.
- PERMISOS: Rick marcó `automations_execute` y `journeys_read` el 20-oct (el package quedó con 10 scopes); ver [[sfmc-nestle-mcp]]. La fuente de WhatsApp se movió el 8-oct a `Sistema-Reportes-CRM\Fuentes\` (otra sesión): el contrato `entorno.json` puede apuntar a la ruta vieja.
- Pendiente de Rick: Segmento y PiezaID de las 18 (y confirmar «Participantes»/«Core»), renombrar en SFMC los correos «12», «13», «test_1», y decidir si quiere audiencias de estas piezas (no se mapearon).

## Auditoría Maggi Liga MX y journeys de WhatsApp Mundial (22-oct-2026, solo lectura; estado que caduca)
- **Liga MX en el catálogo: 10 correos**, todos con PiezaID *por definir: J4 SinRegión/ConRegión (15-ago), E-J5 sin/con región (22-ago), E-J6 Region Sur (28-ago), E-J7 (4-sep), E-J8 (11-12 sep; su EmailName es el de J7 + « - 202609»), E-J9 (18-19 sep), E-J10 (24-26 sep), E-SNM-3 (6-oct).
  🔴 Las 4 primeras traen BU «Maggi*», Marca «Maggi*» y Campaña «Liga MX*» (con asterisco, inferidos): parten Liga MX en los reportes frente a las 6 con «RN/Maggi/Liga MX». Los ConfigKey J6-SR/CR llevan touchpoint E-J5 (el EmailName dice J5).
- **No registrado con envíos reales:** `O_Maggi-Seleccion-NC006537` (EmailID 86776, nombre genérico = asset base): 7,242 envíos reales en 2 jobs + 15 pruebas, entre 3-sep y 13-oct, asunto «El fútbol también es nuestro. ¿Lista para apoyar? ⚽». Sin J1-J3 ni SNM-1/2 por correo (desde 1-jun no hay `_Job` con esos nombres; Perú fue solo WA).
- **WA Liga MX:** journeys en SFMC LALIGA-JORNADA-8 (10-sep), JORNADA-4PM/5PM (11-sep), J9-4PM/5PM (18-sep), J10-JUE/SAB-12PM/SAB-2PM (24-sep), MEXVSPER-2PM/6PM (29-sep), MEXVSCL-MAR-7PM y OCT06-4PM (5-6 oct) y CDP-RN-LMXF (12-13 oct). La fuente de WhatsApp (modificada 8-oct 00:13) trae resultados de J8, J9, J10 y SNM1 (Perú); NO trae JORNADA-8, los 2 vs Chile ni CDP-RN-LMXF.
- **WA Mundial en SFMC (13 journeys Maggi + 3 de Nescafé Tercer Tiempo):** PARTIDO2 BEBIDAS/BOTANAS/NEWCOOKING (18-jun, código 949921), PARTIDO3 ×3 (24-jun, 961549-51), SEMIFINAL (V1 borrado, V2 y ENVIO-2, 14-jul, 987709), SEMIFINAL-ING-ARG (15-jul, 990192; el «-2» es borrador), FINAL-ENVIO-1/2 (17-jul, 996934); Tercer Tiempo = `O_Welcome-NC007067…WA` 948953, 948959 y WA_B 972359. Hoja «Maggi Mundial» de la fuente: 5 filas (Segundo Partido, Tercer Partido, Semifinal A, Semifinal B, Finales); Segundo y Tercer Partido repiten 162 enviados / 125 entregados (parece dato repetido). Sin WA para Partidos 1, 4 y 5.

## Cambios del 22-oct-2026 (E-SNM-Femenil + corrección de 4 filas + lista completa de Maggi)
- **Hecho y verificado** (catálogo SFMC 141→142; compare contra `snapshot-2026-10-22_1631`: 0 desaparecidas, 4 cambiadas, 1 nueva; audiencias 113→113):
  alta `TMP-MAGGI-E-SNM-FEMENIL` (RN · Maggi · Liga MX · touchpoint E-SNM-Femenil · EmailName `O_Maggi-Seleccion-NC006537`, genérico/asset base · EmailID 86776 · 7,242 envíos reales; su journey es `…CDP-RN-LMXF_CN_EM_A_V1_0311029`; PiezaID y Segmento *por definir). Pedido por Rick en inglés el 22-oct.
  Las 4 filas con asterisco (J4-SR/CR y J6-SR/CR) pasaron de «Maggi*/Maggi*/Liga MX*» a RN/Maggi/Liga MX. El kit NO tiene comando para editar filas: se hizo con un script acotado sobre `upsertarFila` (lo permite la guardia: solo catálogo y audiencias), con respaldo y verificación fila por fila. Siguen provisionales los touchpoint/segmento de J4 («J4-ConRegión*», «Con región*»); el libro raíz los llama E-J4.
- **Dónde vive WhatsApp:** el catálogo SFMC (`CRM_Reporte_Config`) NO puede tenerlo (el cruce es por `_Job.EmailName`, y WA no tiene `_Job`). WA vive en el libro raíz, `Catalogo_Piezas` (columnas `Whatsapp_Name` / `Whatsapp_Names_Variantes`). Liga MX WA: 11 de los 13 journeys de SFMC ya están por nombre exacto (005-P011 WA-J8, P013 WA-J9, P016 WA-J10, P018 WA-SNM-2, P019 WA-SNM-3); faltan `…LALIGA-JORNADA-8…065899` y `…CDP-RN-LMXF_CN_WA…0311029` (gemelo WA del Femenil). Mundial WA: 0 de 13 por nombre; las 5 piezas (004-P010/P013/P017/P018/P019) solo traen la etiqueta de la fuente (`WA-MUNDIAL-SEGUNDO-PARTIDO`…). Escribirlos en el libro es decisión de Rick (él edita ese archivo a mano).
- **Envíos reales de Maggi que NO están en ningún catálogo:** `…LA-SELECCION_EN_EM_A_V1_892056` (1,202,252, 8–11 may; journeys …ACTIVOS… y …PARTIDOS…_892056) y `…ECHALE-5_AC_EM_A_V1_917222` (378,118, 27-may, asunto de boletos México vs Serbia). Son previos al Mundial; si van como Maggi · Mundial lo decide Rick (touchpoints suyos).
- **Journey ≠ email también en Liga MX:** J7→journey `…LIGAMX-J7_AQ…`, J8→`…LALIGA-J8-SAB…069127`, J9→`…LALIGA-J9…074970`, J10→`…LALIGA-J10…089420`; E-SNM-3 salió por el journey `…CDP-RN-LMXF_CN_EM_A_V1_03401` (ese era el «nombre» que Rick pasó el 6-oct: es un journey, no un email). Mundial: journey y email se llaman igual; el E-P2 Bebidas tiene EmailName con prefijo «Gomichela» (es el real en `_Job`).
- **Libro raíz, 22-oct (a la mañana; a las 16:39 Rick lo renombró y YA está: ver [[sincronia-catalogo-libro]]):** el archivo vivo `(Interno)-Reporte-Consolidado-Nestle-2026-v8.xlsx` no estaba en `Sistema-Reportes-CRM` (solo «- Copy» y `Copia-151026-…`, ambos 14-oct 19:38); `_catalogo/catalogo.json` del backend está desfasado (sep-22). Los datos de WA/libro salieron de la copia 151026.
- Lista completa entregada en chat + CSV (`maggi-lista-completa.csv`, en el scratchpad de la sesión). Refresh del 22-oct (ancla E-SNM-Femenil, `--sin-vol`): Detalle pidió ≥2 intentos de nuevo.
- **Validado el 22-oct 17:10:** E-SNM-Femenil aterrizó en Piezas/Detalle/Auditoría/Links: 7,257 envíos (7,242 reales en UN job del 13-oct + 15 pruebas de 1 envío), 2,642 aperturas únicas, 34 clicks únicos = crudos de SFMC; 16 jobs en Piezas vs 17 en `_Job` porque el job real 1329823 no tiene ningún envío. Auditoría la marca DUPLICADO (asset base genérico 86776; esperado). Las 4 piezas corregidas muestran RN/Maggi/Liga MX en todas las tablas y no queda ningún asterisco en BU/Marca/Campaña.
- **Audiencias (22-oct, a petición de Rick «revisa que Audience_DE no esté vacío»):** `CRM_Audiencias` estaba completa (113 filas, 5 columnas sin vacíos) pero el catálogo tiene 142 activas: 29 sin fila, así que Audience_DE salía vacío en 28 Piezas y 169 Detalle. Se corrió `audiencias.js --pendientes` (simulacro y luego `--escribir`, con snapshot `snapshot-2026-10-22_1657` antes): 26 filas nuevas (lote 2 completo, Liga MX J6-Sur/J7–J10, Femenil, AON E-P1 tradicionales y PROP1-FUP) sobre 21 journeys, la query Vol pasó de contar 51 a 70 DEs (validada en query temporal y verificada) y el refresh completo (con Vol, 11 min) la ejecutó bien en producción. Hoy: audiencias 139 filas sin vacíos; Piezas con Audience_DE vacío 4 y Detalle 17 filas.
  Lo que queda y por qué: (a) `009-P005` (Pro Plan E-A2) y `TMP-DOG-CHOW-E4-F1` son envíos únicos (`_Job.JobType=MULTIPLE_SEND`, `EmailSendDefinition` vacío): la DE usada no se puede derivar, hay que pedírsela a Rick; `TMP-NESC-ICE-EP1-FUP` no tiene envíos reales. (b) `001-P005`/`001-P006` (AON E-P1, envíos de marzo–abril) SÍ tienen audiencia en `CRM_Audiencias`, pero sus filas de Detalle ya no se pueden recalcular (envíos fuera de la retención de ~182 días) y Piezas toma `Audience_DE` del Detalle; el arreglo es que la query de Piezas lea la audiencia de `CRM_Audiencias` (un LEFT JOIN por ConfigKey); el kit no puede editar esa query, necesita OK de Rick. Avisos: el journey de PROP1-FUP está «Stopped»; Checo E1-A y E1-B comparten la audiencia «EW1-Clasico F1 A FINAL»; las piezas de prueba quedaron con su lista de prueba (`test_PC`).
- Clicks por link con fecha: INSTALADA y activa el 22-oct (ver [[links-por-dia-diseno]]).
- **Respuestas de Rick (22-oct, a mis 4 preguntas en español sencillo):** (1) nombre de la DE de `009-P005` y de `TMP-DOG-CHOW-E4-F1`: «luego te los paso» → SIGUE PENDIENTE (son las únicas 2 piezas con `Audience_DE` vacío en Piezas); (2) journeys de WhatsApp al `Catalogo_Piezas`: **NO**; (3) que la query de Piezas lea `Audience_DE` de `CRM_Audiencias`: **Sí** → hecho y verificado (`001-P005`/`001-P006` = 56,902); (4) segmento de AON E-PROP2: **«Reenganchables»** → aplicado a `TMP-AON-EPROP2` y `-FUP` y propagado a Detalle y Piezas. Además dijo (mismo día) que `PiezaID` se elimine: [[pieza-id-eliminada]].
- Winback de Nescafé Classic (26-oct, journeys V1 103603 / V2 103604, 6 piezas sin registrar): [[nescafe-winback-journeys-oct2026]].
