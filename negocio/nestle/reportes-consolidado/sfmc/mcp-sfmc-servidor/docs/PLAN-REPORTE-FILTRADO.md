# Plan: la DE de reportería de Nestlé

> Diseño del 7-ago-2026, revisado el 19-ago tras leer el catálogo real de Rick.
> **No está implementado.** El MCP está desconectado.
>
> Diagramas: ver el artifact **Arquitectura CRM Nestlé**.
>
> Fuentes leídas: `(Interno)-Reporte-Consolidado-Nestle-2026-v8.xlsx` (hojas
> `Catalogo_Piezas` y `Data_Email`) y `Datorama-Nestle-WK32.1.xlsx` + su mapa
> `_orquesta/_mapas/datorama-email.json`.

---

## Lo que se pide

1. Solo las piezas y journeys que Rick indique — y **el 100%** de los que comparta
2. Las columnas que hoy da Datorama, **más** fecha de primer y último envío
3. **Todo desde marzo 2026** hasta hoy, actualizándose solo
4. Que al agregar piezas nuevas, se sumen
5. **Totales, no logs**

---

## 🔴 Tres hallazgos que cambian el diseño

### 1. El catálogo ya existe: `Catalogo_Piezas`

No hay que inventar una tabla de configuración. Rick ya mantiene **96 piezas** con 74
columnas, y ahí están las llaves de match:

| Columna | Distintos | Sirve como llave contra SFMC |
|---|---:|---|
| **`Content_Name`** | 74 | ✅ **es literalmente el `_Job.EmailName` de SFMC** |
| `Codigo_NC` | 6 | ✅ `NC000600`, `NC006537`… |
| `ID_SFMC` | 8 valores / 23 filas | ✅ el UUID del journey (`72089CDC-…`) |
| `Asset_ID` | 22 | por verificar |

Más las dimensiones que ya declara: `BU` · `Marca` · `Campaña` · `Touchpoint` · `Segmento` ·
`Email_Type` · `Tipo_Envio` · `Objetivo` · `Estado`.

**`Content_Name` es el puente principal.** Cubre 74 de 96 piezas y no requiere que Rick
capture nada nuevo.

### 2. ⚠️ Hay TRES "Journey ID" distintos y no son intercambiables

| Dónde | Ejemplo | Qué es |
|---|---|---|
| `Catalogo_Piezas.Journey_ID` | `001-J001` | **taxonomía interna de Rick** |
| `Catalogo_Piezas.ID_SFMC` | `72089CDC-0C32-…` | **el UUID real de SFMC** |
| `Data_Email.Journey_ID` | `803867`, `865439` | **el ID numérico de Datorama** |

SFMC solo conoce el segundo. Pero el tercero **es derivable**: es el número que Datorama
pone al final del Content Name.

```
J_AO-RECETAS-NESTLE-NC000600_1_IBS_..._ABRIL-AON-APP_AC_EM_A_V1_865439
                                                                ^^^^^^
                                                    = Data_Email.Journey_ID
```

Así que la DE puede entregar los tres y que cada consumidor use el suyo.

### 3. El grano de `Data_Email` es pieza × fecha, no pieza

274 filas / 88 Content Names. `JUN-AON-EP1` aparece **21 veces**, una por fecha de envío.
Meses: marzo a agosto.

Eso importa porque mi DE actual es **una fila por JobID**, y para un envío de journey un solo
JobID acumula meses. **Hay que abrir por día**, o los números no cuadran con `Data_Email`.

---

## Diseño

### Dos DEs de salida, porque son dos granos distintos

| DE | Grano | Alimenta |
|---|---|---|
| **`CRM_Email_Detalle`** | JobID × día de envío | hoja `Data_Email` |
| **`CRM_Email_Piezas`** | Content_Name (una fila por pieza) | hoja `Catalogo_Piezas` |

La segunda es la que trae **`Fecha_Primer_Envio` / `Fecha_Ultimo_Envio`**, que por definición
son de pieza, no de envío.

### `CRM_Email_Detalle` — columnas

Mapeadas 1:1 contra lo que hoy da Datorama, para que la hoja no cambie de forma.

| # | Campo | Equivale a (Datorama / Data_Email) | De dónde sale en SFMC |
|---|---|---|---|
| 1 | **JobID** | — | `_Job.JobID` · **PK** |
| 2 | **SendDay** | — | día del envío · **PK** |
| 3 | Email_Content_Name | `Email Content Name` | `_Job.EmailName` |
| 4 | Email_Subject_Raw | `Email Subject` | `_Job.EmailSubject` |
| 5 | Send_Date | `Send Date` | `MIN(_Sent.EventDate)` del día |
| 6 | Send_Week | `Send Week` | derivado |
| 7 | Email_Sender_Name | `Email Sender Name` | `_Job.FromName` |
| 8 | Journey_Name | `Journey Name` | `_Journey.JourneyName` |
| 9 | Journey_UUID | — | `_Journey.JourneyID` (el de SFMC) |
| 10 | Journey_ID_Datorama | `Journey ID` | **derivado**: número final del Content Name |
| 11 | Journey_Version | — | `_Journey.VersionNumber` |
| 12 | Codigo_NC | `Campaign ID` | **derivado**: el `NC######` del Content Name |
| 13 | Email_Sends | `Email Sends` | `COUNT(_Sent)` |
| 14 | Email_Deliveries | `Email Deliveries` | `Sends − Bounces` |
| 15 | Email_Bounces | `Email Bounces` | `COUNT(_Bounce)` |
| 16 | Email_Bounces_Soft | `Email Bounces - Soft` | `_Bounce` con `BounceCategory LIKE 'Soft%'` |
| 17 | Email_Unique_Opens | `Email Unique Opens` | `_Open` con `IsUnique = 1` |
| 18 | Email_Total_Opens | — | `COUNT(_Open)` · **extra, Datorama no lo da** |
| 19 | Email_Unique_Clicks | `Email Unique Clicks` | `_Click` con `IsUnique = 1` |
| 20 | Email_Total_Clicks | — | `COUNT(_Click)` · **extra** |
| 21 | Email_Unique_Unsubs | `Email Unique Unsubscribes` | `_Unsubscribe` con `IsUnique = 1` |
| 22 | Delivery_Rate | `Email Delivery Rate` | calculado |
| 23 | Open_Rate | `Email Open Rate` | calculado |
| 24 | Click_Rate | `Email Click Rate` | calculado |
| 25 | CTOR | `Email Click To Open Rate` | calculado |
| 26 | Bounce_Rate | `Email Bounce Rate` | calculado |
| 27–31 | BU · Marca · Campana · Touchpoint · Segmento | dimensiones canónicas | **del `Catalogo_Piezas`** |
| 32 | Pieza_ID | — | del catálogo, para amarrar de vuelta |
| 33 | LastRefresh | — | `GETDATE()` |

**22 de las 23 columnas de email de Datorama quedan cubiertas**, más 2 extra que Datorama no
da (`Total_Opens`, `Total_Clicks`).

⚠️ **La que falta: `Audience Name`.** En Datorama sale `All Subscribers` en las filas que vi,
o sea aporta poco. **No verifiqué si SFMC la puede dar** — `_Sent.ListID` existe y el objeto
SOAP `SendDefinitionList` podría resolverla. Es de lo primero a probar al reconectar; no la
doy por imposible ni por resuelta.

**Las 9 columnas de WhatsApp no aplican**: son otro canal y viven en `Data_WhatsApp`.

### `CRM_Email_Piezas` — columnas

Una fila por `Content_Name`, agregando todos sus envíos:

`Content_Name` (PK) · `Pieza_ID` · `Codigo_NC` · `Journey_Name` · `Journey_UUID` ·
**`Fecha_Primer_Envio`** · **`Fecha_Ultimo_Envio`** · `N_Envios` (cuántos jobs) ·
`Dias_Con_Envio` · `Email_Sends` · `Email_Deliveries` · `Email_Bounces` ·
`Email_Unique_Opens` · `Email_Unique_Clicks` · `Email_Unique_Unsubs` · las 5 tasas ·
`BU` · `Marca` · `Campana` · `Touchpoint` · `Segmento` · `LastRefresh`

### `CRM_Reporte_Auditoria` — el 100%

Una fila por pieza del catálogo, con **`JobsEncontrados`** y `Estado` (`OK` / `SIN MATCH` /
`INACTIVO`). Un `SIN MATCH` es una alerta: el Content Name del catálogo no existe en SFMC.

**Sin esta tabla, una pieza que no matchea se ve idéntica a una pieza sin envíos.** Es el
falso negativo silencioso que ya apareció dos veces en este proyecto.

---

## Cómo se unen

```
Catalogo_Piezas.Content_Name  ─────────────▶  _Job.EmailName
       (o Codigo_NC, o ID_SFMC)                     │
                                          _Job.JobID┼── _Sent  ── el día del envío marca el grano
                                                    ├── _Open      (se atribuyen al día del ENVÍO,
                                                    ├── _Click      no al día del evento)
                                                    ├── _Bounce
                                                    └── _Unsubscribe
                        _Job.TriggererSendDefinitionObjectID
                                    └─▶ _JourneyActivity ─▶ _Journey
```

🔴 **Los eventos se atribuyen al día del ENVÍO, no al día del evento.** Una apertura del día 5
de un correo enviado el día 1 cuenta en el día 1. Si no, aparecen días con aperturas y cero
envíos, y `Delivered` sale negativo — pasó en la versión anterior, en 6 de 1,213 filas. El
join va por `JobID + ListID + BatchID + SubscriberID`, como lo hace la query `JPR_NMX_PerfStage`
que ya existe en el tenant.

---

## Historia desde marzo, y que se acumule

- **Ventana:** desde `2026-03-01` fija, no móvil de 90 días. Hoy la DE arranca en mayo y por
  eso se perdía marzo y abril.
- **`targetUpdateTypeId: 1` (Update)**, no Overwrite: upsert por la PK. Lo nuevo se agrega, lo
  existente se refresca, **lo viejo se queda**. Así la historia crece sola.
- **Piezas nuevas:** Rick las agrega a `Catalogo_Piezas` y entran en la siguiente corrida. La
  query no se toca.

⚠️ Con Update, el criterio de "ya terminó" cambia: `LastRefresh` deja de ser uniforme. El
semáforo pasa a ser el **paso 2 de la automation** (la auditoría), cuya fila con fecha de hoy
solo existe si el paso 1 terminó.

---

## La automation DIARIA

Dos fases, porque no es lo mismo la primera carga que el mantenimiento:

**Fase 1 — carga inicial, una sola vez.** Ventana completa desde `2026-03-01` hasta hoy.
Es la corrida cara (la de 90 dias tardo ~8 min; esta va a tardar mas). Se corre a mano.

**Fase 2 — corrida diaria.** Ventana movil de **45 dias** en modo Update. No hace falta
recorrer todo el historico cada dia: las aperturas casi siempre ocurren en los dias
posteriores al envio, y lo viejo se queda intacto porque el upsert no lo toca. Una ventana
fija desde marzo creceria sin fin y la corrida se haria mas lenta cada semana.

```
CRM_Reporte_Diario   ·   05:00 America/Mexico_City
  Paso 1 → CRM_Email_Detalle_Load      Update      ventana movil 45 dias
  Paso 2 → CRM_Email_Piezas_Load       Overwrite   recalcula totales por pieza
  Paso 3 → CRM_Reporte_Auditoria_Load  Overwrite   y es el semaforo de la corrida
```

🔴 **Programar la automation por REST no funciona en este tenant** (el `PATCH` con
`schedule` responde 200 y lo descarta; `/actions/schedule/` da 404 — verificado 31-jul).
O Rick pone la recurrencia a mano en Automation Studio una vez, o se intenta por SOAP,
que **esta sin probar**.

---

## Cómo baja Rick la DE sin depender del MCP

Tres vías. La tercera es la que cierra el ciclo sin intervención.

### A. Export manual desde la UI — 0 de setup

En **Email Studio → Subscribers → Data Extensions** (o Contact Builder), se selecciona la DE
y se usa **Export**. Pide delimitador y si incluir encabezados.

- ✅ Funciona hoy, sin configurar nada
- ❌ Manual cada vez. Para DEs grandes el export no se descarga al navegador: **aterriza en el
  FTP del tenant**, así que de todos modos hay que ir por él (ver B).

### B. Data Extract + File Transfer dentro de la MISMA automation

La automation que refresca la DE puede dejar el archivo listo. Se le agregan dos pasos:

```
CRM_Reporte_Diario   ·   05:00 America/Mexico_City
  Paso 1 → Query    CRM_Email_Detalle_Load
  Paso 2 → Query    CRM_Email_Piezas_Load
  Paso 3 → Query    CRM_Reporte_Auditoria_Load
  Paso 4 → Data Extract    DE → CSV en el Safehouse
  Paso 5 → File Transfer   Safehouse → FTP del tenant
```

En el **Data Extract** el nombre del archivo admite patrones de fecha
(`CRM_Email_Detalle_%%Year%%%%Month%%%%Day%%.csv`), así que cada corrida deja su propio
archivo y no se pisan.

Para bajarlos: **Setup → Data Management → FTP Accounts** para crear un usuario, y luego
cualquier cliente **SFTP** (WinSCP, FileZilla). Los exports aterrizan en `/Export`.

⚠️ **Sin verificar:** no probé crear actividades de Data Extract ni de File Transfer por API —
solo Query Activities. El scope `automations_write` debería cubrirlas, pero es suposición.
En la UI se pueden agregar a mano en cualquier caso.

### C. File Transfer directo a un SFTP de Nestlé — el que cierra el ciclo

Si Nestlé (o el equipo) tiene un SFTP propio, el paso 5 puede apuntar **ahí en vez de** al FTP
del tenant. Entonces el archivo aparece solo en un destino que Rick ya controla, y de ahí a
OneDrive es un paso más.

**Alternativa sin SFTP propio:** una tarea programada en la máquina de Rick que baje del FTP
del tenant a una carpeta de OneDrive con WinSCP en modo script. Una vez configurada, el CSV
del día aparece solo.

### Y de ahí al Excel, sin copiar y pegar

Con el CSV cayendo en una carpeta local, **Power Query** de Excel lo puede leer directo
(`Datos → Obtener datos → Desde archivo → Desde carpeta`) y actualizar con un botón. Eso
elimina el paso manual entre la descarga y `Data_Email`.

### Qué recomiendo

Empezar por **A** para ver el dato cuanto antes, y montar **B** en la misma sesión en que se
configure la automation — son dos actividades más en algo que ya se va a tocar. **C** solo si
el ciclo manual empieza a estorbar.

---

## Plan al reconectar

1. Cargar `Catalogo_Piezas` a una DE de config en SFMC
2. **Correr SOLO la auditoría** (lectura pura) y revisarla **pieza por pieza** con Rick.
   Cada `SIN MATCH` se resuelve antes de seguir. **Aquí se cumple o no el 100%**
3. Verificar si `Audience Name` se puede sacar de `_Sent.ListID` / `SendDefinitionList`
4. Crear las DEs y correr la carga con ventana desde marzo
5. **Cruzar contra `Datorama-Nestle-WK32.1`**: los `Email Sends` por pieza y fecha tienen que
   cuadrar. Es el mejor control que hay — dos sistemas independientes sobre el mismo dato
6. Cruzar también contra `sfmc_list_sends`
7. Recién entonces, el schedule diario
8. Y los pasos de **Data Extract + File Transfer**, para que el CSV baje solo

---

## Riesgos conocidos

- **Datorama y SFMC van a diferir, y la regla ya esta decidida: manda SFMC.**
  Rick lo fijo el 19-ago-2026, y el argumento es correcto: SFMC es la fuente raiz — el envio
  escribe en las Data Views y Datorama INGIERE de ahi, con su propia capa de atribucion
  encima. Una diferencia no es un error de SFMC que haya que corregir: es la capa de
  Datorama. Se documenta y se reporta el numero de SFMC.
  Ojo al comparar: **las hojas mensuales de Datorama son ACUMULADAS, no del mes** (la de
  "Mayo" trae del 14-mar al 30-may). Cotejar mes contra mes sin ver eso lleva a conclusiones
  falsas.
- **Los triggered sends con JobID de larga vida** siguen siendo el caso difícil. Abrir por día
  de envío lo mitiga, pero hay que confirmarlo contra Datorama.
- **`Audience Name` sin verificar.**
- **El schedule por SOAP sin probar.**
