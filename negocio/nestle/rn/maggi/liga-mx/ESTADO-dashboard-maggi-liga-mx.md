# ESTADO · Dashboard Liga MX 2026

> Documento vivo. Última actualización: 2026-10-29 (v4 · iteración feedback cliente).

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

## Commits en producción

| Hash | Descripción |
|---|---|
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
- **Email**: tabla receta + OR (con aperturas) + CTOR (con clicks) + CTR — 11 piezas
- **WhatsApp**: tabla receta + %Lectura (con leídos) + CTOR (con clicks) — 5 piezas
- **Copy Email**: patrón de subject → resultado
- **Copy WA**: patrón de card → resultado
- Insights y accionables en bullet points

### S2 · DESTINO
- **Email**: tabla por pieza con chips de destino · columna "Clicks" (todos los clicks a destino cuentan como CTA) · CTOR
- **WhatsApp**: tabla con Clicks QCart / Clicks Recetas / CTOR · nota solo para WA-J10 (YouTube no medido)
- Sin separación por subgrupos — todo email junto, todo WA junto
- Insights y accionables en bullet points

### S3 · AUDIENCIA
- **Email**: tabla unificada cronológica con jornadas J4–J10 + E-SNM-3 varonil + E-SNM-Femenil — todo en la misma tabla
- **WhatsApp**: tabla de evolución del segmento primero, luego gráfica SVG de desgaste CTOR
- Insights y accionables en bullet points

### S4 · ACCIONABLES
- 5 bullets con ícono + título corto + evidencia numérica

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
- Paleta: `#FFB800` gold · `#00D45A` verde · `#FF2040` rojo · `#080808` fondo

### Qué se eliminó vs V3
- Mundial como benchmark
- 5 agrupaciones de contenido → S1 email/WA separados con tablas por pieza
- 6 sub-bloques de destino → S2 email junto / WA junto con chips de destino
- Mini-grid de diseño
- Penetración Nestlé en S1
- Notas de "cortes crudos" y particiones en S3

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
