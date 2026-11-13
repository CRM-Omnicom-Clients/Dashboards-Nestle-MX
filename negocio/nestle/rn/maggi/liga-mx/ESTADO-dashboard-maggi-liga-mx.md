# ESTADO · Dashboard Liga MX 2026

> Documento vivo. Última actualización: 2026-11-13 (exec-v1 · topnav fijo + QCart completo · $338K intención de compra).

---

## URLs en producción

| Dashboard | URL |
|---|---|
| **Ejecutivo (exec-v1)** | `https://crm-omnicom-clients.github.io/Dashboards-Nestle-MX/negocio/nestle/rn/maggi/liga-mx/dashboard-maggi-liga-mx-exec-v1.html` |
| **Operativo V4** | `https://crm-omnicom-clients.github.io/Dashboards-Nestle-MX/negocio/nestle/rn/maggi/liga-mx/dashboard-maggi-liga-mx-v3.html` |

> V4 reemplazó el contenido de `dashboard-maggi-liga-mx-v3.html` (URL sin cambio para el cliente). V3 original archivado en `_historico/`.

---

## Dashboard ejecutivo (exec-v1)

**Script**: `my/build_exec_v1.py` → `my/dashboard_maggi_exec_v1.html` (~0.61 MB)

### Estructura (6 slides × 100vh, Pyramid Principle / SCQA)

| Slide | ID | Contenido |
|---|---|---|
| 0 | `s0` | Portada · Logo + headline + 3 KPI chips |
| 1a | `s1a` | Divergent bar · SNM/SNF vs jornadas regulares · +117% WA-SNF-1 · −31% E-SNM-3 (video) · imágenes apiladas debajo de gráfica |
| 1b | `s1b` | Grouped bars · Clásicos J7–J10 · por qué no se pueden juzgar · rec. test limpio 2027 |
| 2 | `s2` | KPIs QCart: $338K total / $38.7K Nestlé / 10.5% penetración · clicks WA por pieza · gráfica penetración % WA |
| 3a | `s3a` | 3 decisiones creativas: atleta (+63%/+117%) · MAGGI protagonista (0.997% vs 0.722%) · un canal un objetivo |
| 3b | `s3b` | 2 decisiones audiencia (Bebas Neue 30px gold): no video como único destino · ampliar base WA |

### Decisiones clave exec-v1

- **Pyramid Principle / SCQA**: pregunta (72px Bebas Neue gold) → respuesta breve (17px muted) → datos → insight → accionable
- **Accionable = elemento más prominente**: 24px, borde 2px verde, glow verde, padding 24×28
- **Sin texto "Pool"**: reemplazado por "segmento" en todos los labels
- **S1a stacked**: imágenes después de la gráfica (no columnas paralelas)
- **S1b hipótesis contaminada**: E-J8 = igual CTOR que J7 (0.87%) pero destino cambió simultáneamente → no atribuible; accionable: test limpio Apertura 2027
- **S2 QCart completo**: 14 piezas medidas; email aportó $25.4K Nestlé, WA $13.3K; top por penetración: E-J6-Sur 22.4%, WA-SNF-1 17.6%
- **S3b decisiones**: encabezados Bebas Neue 30px gold + promedio 15px blanco con valor en verde
- **Topnav fijo**: logo Maggi izquierda + 5 links activos vía IntersectionObserver + nav-dots laterales mantenidos
- **CSS**: se eliminó definición `.slide-question` duplicada que causaba cascade bug (15px sobreescribía 72px)

### Datos QCart (fuente: Walmart+Chedraui · proporcionados por cliente 2026-11-13)

| Pieza | TouchPoint | Int. Total MXN | Int. Nestlé MXN | Pct. Penetración | Ticket Carrito |
|---|---|---|---|---|---|
| P005 | E-J4 CON | $8,246 | $890 | 10.79% | $330 |
| P006 | E-J4 SIN | $102,992 | $9,538 | 9.26% | $440 |
| P007 | E-J5 SIN | $4,816 | $785 | 16.30% | $268 |
| P008 | E-J5 CON | $1,403 | $0 | 0% | $468 |
| P009 | E-J6 Sur | $1,121 | $251 | **22.40%** | $224 |
| P010 | E-J7 | $81,746 | **$11,154** | 13.64% | $442 |
| P011 | WA-J8 | $9,547 | $462 | 4.84% | $455 |
| P012 | E-J8 | $2,239 | $204 | 9.11% | $320 |
| P013 | WA-J9 | $9,787 | $638 | 6.52% | $350 |
| P014 | E-J9 | $19,807 | $1,054 | 5.32% | $440 |
| P015 | E-J10 | $9,439 | $1,513 | 16.03% | $429 |
| P016 | WA-J10 | $15,827 | $1,152 | 7.28% | $417 |
| P018 | WA-SNM-2 | $15,534 | $1,271 | 8.18% | $299 |
| P021 | WA-SNF-1 | $55,880 | **$9,826** | **17.58%** | **$470** |
| **TOTAL** | — | **$338,382** | **$38,738** | **10.5% prom.** | — |

### Commits en producción — exec-v1

| Hash | Descripción |
|---|---|
| `82067df` | **feat**: topnav fijo · logo Maggi · 5 links activos · IntersectionObserver |
| `c830eee` | **feat**: S2 QCart completo — $338K intención total · $38.7K Nestlé · gráfica penetración WA |
| `5374ee2` | **fix**: eliminar `.slide-question` duplicado (CSS cascade bug) · labels S3b sin encimes |
| `28d2dfe` | **style**: question 72px · accionables 24px+glow · S1a apilada · S3b Bebas Neue gold |
| `2b64384` | **feat**: dashboard ejecutivo inicial · 6 slides · SVG charts · 14 imágenes |

### Cómo regenerar y republicar exec-v1

```bash
# Build
cd ~/work/2026-09-10_gp5b06
uv run --with pillow python3 my/build_exec_v1.py

# Publicar
TOKEN=$(sed -n '2p' my/"TOKEN DASHBOARDS 1.txt" | tr -d '[:space:]')
R=/tmp/dashboards-exec-$$
git clone -q "https://${TOKEN}@github.com/CRM-Omnicom-Clients/Dashboards-Nestle-MX.git" "$R"
git -C "$R" config user.email "studio@omnicom.mx"
git -C "$R" config user.name "Treasure AI Studio"
cp my/dashboard_maggi_exec_v1.html "$R/negocio/nestle/rn/maggi/liga-mx/dashboard-maggi-liga-mx-exec-v1.html"
git -C "$R" add negocio/nestle/rn/maggi/liga-mx/dashboard-maggi-liga-mx-exec-v1.html
git -C "$R" commit -m "update: exec-v1" && git -C "$R" push
```

---

## Dashboard operativo V4

**Script**: `my/build_v4.py` → `my/dashboard_liga_mx_v4.html` (~0.77 MB)

### Estructura (3 secciones + scroll, tablas detalladas)

1. **S1 · CONTENIDO** — tabla email (11 piezas) + tabla WA (5 piezas) · CTOR ↑↓ · insights creativos · patrones de copy
2. **S2 · DESTINO** — chips de destino · clicks email/WA · split QCart/Recetas (parcial J8/J9)
3. **S3 · AUDIENCIA** — evolución de segmento · tabla email+WA · gráfica desgaste WA CTOR

### Decisiones clave V4

- Sin benchmark Mundial
- Top 3 CTOR resaltado en verde
- Encabezados y primera columna sticky
- Flechas ↑↓ por pieza vs anterior cronológico
- Accionables integrados en cada sección (S4 eliminada)
- E-SNM-Femenil = única pieza con jugadora en el creativo (confirmado cliente)
- WA-SNM-2: sí tuvo QCart en envío final (confirmado cliente; brief decía YouTube)

### Commits en producción — V4

| Hash | Descripción |
|---|---|
| `d685fa8` | **feat**: V4 completo — insights+accionables · sticky · top-3 verde · flechas ↑↓ |
| `bab9f7c` | **style**: encabezados tabla sticky |
| `e3dcfc5` | **feat**: imágenes E-SNM3/E-SNF-1/WA-SNF1 agregadas |
| `0724239` | **feat**: separar email/WA en S1/S2/S3 |
| `526d274` | **fix**: WA-SNM-2 QCart confirmado por cliente |
| `7e9087d` | **feat**: V4 inicial sin Mundial |

### Cómo regenerar y republicar V4

```bash
cd ~/work/2026-09-10_gp5b06
uv run --with pillow python3 my/build_v4.py

TOKEN=$(sed -n '2p' my/"TOKEN DASHBOARDS 1.txt" | tr -d '[:space:]')
R=/tmp/dashboards-v4-$$
git clone -q "https://${TOKEN}@github.com/CRM-Omnicom-Clients/Dashboards-Nestle-MX.git" "$R"
git -C "$R" config user.email "studio@omnicom.mx"
git -C "$R" config user.name "Treasure AI Studio"
cp my/dashboard_liga_mx_v4.html "$R/negocio/nestle/rn/maggi/liga-mx/dashboard-maggi-liga-mx-v3.html"
git -C "$R" add negocio/nestle/rn/maggi/liga-mx/dashboard-maggi-liga-mx-v3.html
git -C "$R" commit -m "update: dashboard Maggi V4" && git -C "$R" push
```

---

## Contrato de datos

Si la fuente contradice al dashboard: **gana la fuente**. Cualquier limitación de medición se declara en el HTML con cajas ⚠.

**Limitaciones conocidas:**
- Fuera de QCart no hay métrica de conversión — clicks como proxy
- Split WA QCart/Recetas solo completo en J8 y J9
- CTOR de WA-SNM-3 es derivado por supuesto (excluida del exec-v1)
- Audiencia WA sin volumen oficial (inferido desde WA-Envíos)


---

## Objetivo final (V4)

Dashboard HTML autocontenido con **3 secciones accionables** para el cliente,
sin benchmark Mundial. Cada sección responde una pregunta y entrega insights +
accionables concretos para la próxima campaña:

1. **🍳 CONTENIDO** — ¿qué receta/copy performa mejor? (email y WA separados)
2. **🔗 DESTINO** — ¿a dónde conviene mandar al usuario (QCart · Recetas · YouTube · TikTok)?
3. **👥 AUDIENCIA** — ¿a quién tocamos (región · femenil · desgaste WA)?

Más una síntesis **📋 Accionables** con 5 bullets.

**Entrega pública** (en vivo, HTTP 200):
`https://crm-omnicom-clients.github.io/Dashboards-Nestle-MX/negocio/nestle/rn/maggi/liga-mx/dashboard-maggi-liga-mx-v3.html`

> La URL vigente para el cliente **no cambió**: V4 reemplazó el contenido del
> archivo `dashboard-maggi-liga-mx-v3.html`. V3 archivado en
> `_historico/dashboard-maggi-liga-mx-v3-pre-insights.html`.

---

## Dashboard ejecutivo (exec-v1)

**Entrega pública:**
`https://crm-omnicom-clients.github.io/Dashboards-Nestle-MX/negocio/nestle/rn/maggi/liga-mx/dashboard-maggi-liga-mx-exec-v1.html`

**Script**: `my/build_exec_v1.py` → `my/dashboard_maggi_exec_v1.html` (0.25 MB)

### Estructura (6 slides × 100vh, Pyramid Principle / SCQA)

| Slide | ID | Contenido |
|---|---|---|
| 0 | `s0` | Portada · Logo + headline + 3 KPI chips (1.29% CTOR · 16 piezas · 316 clicks QCart) |
| 1a | `s1a` | Divergent bar · SNM/SNF vs jornadas regulares · +117% WA-SNF-1 · −31% E-SNM-3 (video) |
| 1b | `s1b` | Grouped bars · Clásicos J7–J10 · por qué no se pueden juzgar todavía · rec. test limpio 2027 |
| 2 | `s2` | KPI strip intención de compra · horizontal bars QCart clicks por pieza WA |
| 3a | `s3a` | 3 decisiones creativas: atleta (+63%/+117%) · MAGGI protagonista (0.997% vs 0.722%) · un canal un objetivo |
| 3b | `s3b` | 2 decisiones audiencia: no video como destino único · ampliar base WA (misma pool −29%) |

---

## Commits en producción — exec-v1

| Hash | Descripción |
|---|---|
| `c830eee` | **feat(exec-v1)**: S2 QCart completo — $338K intención total · $38.7K Nestlé · gráfica penetración WA por pieza |
| `5374ee2` | **fix**: eliminar `.slide-question` duplicado (CSS cascade bug) · labels S3b sin encimes |
| `28d2dfe` | **style(exec-v1)**: question 72px, accionables 24px+glow, S1a imágenes debajo de gráfica, S3b decisiones Bebas Neue 30px gold |

## Commits en producción — V4

| Hash | Descripción |
|---|---|
| `d685fa8` | **feat**: V4 nueva iteración — notas internas eliminadas · insights+accionables antes de cada tabla · S4 removida · columna sticky izquierda · top-3 CTOR verde · flechas ↑↓ · columnas "Insight creativo" y "Patrón de copy" en S1 |
| `bab9f7c` | **style**: encabezados de tabla fijos (sticky) al hacer scroll |
| `e3dcfc5` | **feat**: imágenes E-SNM3/E-SNF-1/WA-SNF1 agregadas; clicks email unificados como CTA; quitar notas "único CTA" WA |
| `0724239` | **feat**: separar email/WA en S1/S2/S3; volúmenes en celdas; chips de destino; tabla WA antes de gráfica; insights y accionables en bullets |
| `526d274` | **fix**: WA-SNM-2 — pieza final sí llevó QCart (confirmado cliente), se retira nota de revisión |
| `7e9087d` | **feat**: V4 insights accionables — sin Mundial, 3 secciones + síntesis |
| `f108142` | ordenar: repo público espeja estructura del repo privado |

---

## Estado actual del build

- **Script**: `my/build_v4.py` (único constructor, sin pipeline separado)
- **Output local**: `my/dashboard_liga_mx_v4.html` — **0.77 MB**
- **Piezas**: 16 medidas · **14 imágenes** incrustadas
- **Imágenes disponibles**: E-J4…E-J10 · WA-J8…WA-J10 · WA-SNM1 · E-SNM3 · E-SNF-1 · WA-SNF1

---

## Arquitectura de secciones (vigente)

### S1 · CONTENIDO
- **Email**: tabla unificada con Pieza · Imagen · Receta · OR · CTOR ↑↓ · CTR · **Insight creativo** · **Patrón de copy** — 11 piezas
- **WhatsApp**: tabla unificada con Pieza · Imagen · Receta · %Lectura · CTOR ↑↓ · **Insight creativo** · **Patrón de copy** — 5 piezas
- Insights y accionables **antes** de las tablas
- Top 3 CTOR resaltado en verde (1°=fuerte · 2°=mediano · 3°=claro)
- Flechas ↑↓ comparando cada pieza vs la anterior cronológicamente
- **E-SNM-Femenil = única pieza con jugadora en el creativo** (confirmado cliente)

### S2 · DESTINO
- **Email**: tabla con chips de destino · Clicks · CTOR ↑↓ · columna "Insight destino"
- **WhatsApp**: tabla con Clicks QCart / Clicks Recetas / CTOR ↑↓ · columna "Insight destino"
- Insights y accionables antes de las tablas

### S3 · AUDIENCIA
- **Email**: tabla cronológica J4–J10 + SNM/SNF con segmento · OR ↑↓ · CTOR ↑↓
- **WhatsApp**: tabla de evolución del segmento + gráfica SVG de desgaste CTOR
- Insights y accionables antes de las tablas
- **WA-SNM-2 segmento = "Región unificada"** (actualizado)

### ~~S4 · ACCIONABLES~~
- **Eliminada** — los accionables quedaron integrados en cada sección

---

## Arquitectura de archivos (V4)

```
my/
├── build_v4.py                              · constructor único (imágenes → HTML, data hardcodeada)
├── dashboard_liga_mx_v4.html                · entregable V4 local, 0.77 MB, 14 imágenes
└── ESTADO-dashboard-maggi-liga-mx.md        · este archivo

RN/Dashboard Maggi/
├── Resultados-LigaMX201028.xlsx             · fuente de resultados (Sheet1 · 16 piezas válidas)
├── Copia-Cliente_CRM_Copies_Brief_SNM_2026 - Copy.xlsx  · brief SNM + SNF
├── Copia-Cliente_CRM_Copies_Brief_Maggi_Liga2026.xlsx   · brief Liga MX
├── LogoMaggi.png
└── Piezas-LigaMX2026/
    ├── E-J4…E-J10.png   · WA-J8…WA-J10.png   · WA-SNM1.png
    ├── E-SNM3.png        · E-SNF-1.png         · WA-SNF1.jpg   ← agregadas 2026-10-29
    └── (sin imágenes de Mundial en V4)
```

---

## Decisiones clave V4

### Datos
- **Fuente**: `Resultados-LigaMX201028.xlsx · Sheet1` (16 piezas; WA-SNM-3 excluida por CTOR derivado; SNM-1 no se lanzó)
- **WA-SNM-2**: confirmado por cliente — sí tuvo QCart en el envío final aunque el brief decía YouTube
- **Clicks email = CTA**: todos los clicks a destino (QCart, Recetas, YouTube, TikTok) se contabilizan igual; no se distingue "CTA vs no-CTA"
- **Split WA QCart/Recetas**: solo completo en WA-J8 y WA-J9

### Visual
- Imágenes como CSS classes (`.img-xxx{background-image:url(...)}`) — cada data URL aparece una sola vez
- Encabezados de tabla `position: sticky; top: 62px` — se quedan visibles al hacer scroll
- **Primera columna sticky** `position: sticky; left: 0` — pieza visible al scroll horizontal
- **Top 3 CTOR** resaltado: verde fuerte (#1) · verde mediano (#2) · verde claro (#3)
- **Flechas ↑↓** en verde/rojo comparando CTOR de cada pieza vs la anterior
- Paleta: `#FFB800` gold · `#00D45A` verde · `#FF2040` rojo · `#080808` fondo

### Qué se eliminó vs iteración anterior
- Todas las notas internas (hero disclaimer "Tres lecturas accionables...", bloque `.decl` con SNM-1/WA-SNM-3/limitaciones y cualquier patrón similar)
- Tablas separadas de patrón de copy → columnas integradas en tabla principal
- S4 Accionables → accionables en cada sección
- Mini-grid de diseño, penetración Nestlé, notas de cortes crudos

---

## Qué falta / pende de terceros

- **Medición de clicks por URL** — la fuente no desglosa clicks por destino fuera de QCart. Accionable del dashboard: habilitar UTMs únicas o shortlinks por destino antes de escalar YouTube/TikTok.

---

## Cómo regenerar y republicar

```bash
# Build
uv run --with pillow python3 my/build_v4.py

# Publicar
TOKEN=$(sed -n '2p' my/"TOKEN DASHBOARDS 1.txt" | tr -d '[:space:]')
R=/tmp/dashboards-nestle-mx-$$
git clone -q "https://${TOKEN}@github.com/CRM-Omnicom-Clients/Dashboards-Nestle-MX.git" "$R"
git -C "$R" config user.email "studio@omnicom.mx"
git -C "$R" config user.name "Treasure AI Studio"
cp my/dashboard_liga_mx_v4.html "$R/negocio/nestle/rn/maggi/liga-mx/dashboard-maggi-liga-mx-v3.html"
git -C "$R" add negocio/nestle/rn/maggi/liga-mx/dashboard-maggi-liga-mx-v3.html
git -C "$R" commit -m "update: dashboard Maggi V4" && git -C "$R" push
```

---

## Contrato de datos

Si la fuente contradice al dashboard: **gana la fuente**. Cualquier limitación
de medición se declara explícitamente en el HTML con cajas ⚠ — no es un error
del reporte, es una limitación documentada de la fuente.
