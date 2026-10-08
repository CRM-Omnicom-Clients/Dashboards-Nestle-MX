# Catálogo CRM · Nestlé México

El **catálogo de piezas** del sistema de reportes CRM: la autoridad de dimensiones de la que sale
todo lo demás. Una *pieza* es un envío identificable (un email o un mensaje de WhatsApp) con su
campaña, su touchpoint, su segmento y sus códigos de Qcart.

| archivo | qué es |
|---|---|
| `Catalogo_Piezas.csv` | **139 piezas × 85 columnas.** Una fila por pieza |
| `Catalogo_Referencias.csv` | 268 filas × 11 columnas. Alias y equivalencias de nombres |
| `CATALOGO.md` | la documentación de la estructura: qué significa cada grupo de columnas |

**Foto del 7-oct-2026.** No es un sistema vivo: es una exportación para revisar y comentar.

---

## Cómo leerlo sin equivocarse

### 1 · Una celda vacía y un `N/A` no son lo mismo

El catálogo tiene **tres estados** y la diferencia importa:

| estado | significa |
|---|---|
| un valor | el dato |
| **`N/A`** | **no aplica por naturaleza** — p. ej. `Email_Name` en una pieza de WhatsApp |
| **`POR DEFINIR`** / **`PENDIENTE`** | **sí aplica y nos falta** |

Llenar todo de `N/A` cerraría el archivo pero **borraría la señal de qué falta**. Si ves
`POR DEFINIR`, es deuda reconocida, no un descuido.

### 2 · La llave de una pieza es su `Email_Name`, no su nombre bonito

`Email_Name` es el identificador natural y es único (verificado: 0 repetidos en las 139).
`Pieza_ID` es el id interno, y su **prefijo es la campaña**: `007-P008` es la pieza 8 de la
campaña 007 (Concentrate · Hackea tu café).

🔴 **Nada se deduce del naming.** Dos piezas pueden tener nombres casi idénticos y ser cosas
distintas, y los nombres de la fuente a veces contradicen al touchpoint declarado. Cuando chocan,
manda lo declarado en el catálogo.

### 3 · Hay 7 columnas sin un solo dato, y es a propósito

`Receta_5`, `URL_Receta_5`, `Cod_Walmart_5`, `Carritos_Walmart_5`, `Cod_Chedraui_5`,
`Carritos_Chedraui_5` y `Cod_Chedraui_3`.

El layout prevé hasta **5 recetas por pieza** y el máximo que ha tenido una es **4**. No son datos
perdidos: es **capacidad reservada**. Se dejaron en el CSV para que la forma del archivo sea
estable — si se quitaran, el día que una pieza use el 5º bloque el CSV ganaría 5 columnas de golpe
y la comparación de ese mes saldría llena de ruido estructural en vez de enseñar el cambio real.

Uso real de los bloques: **1** → 38 piezas · **2** → 19 · **3** → 6 · **4** → 2 · **5** → 0.
Solo **39 de 139** piezas tienen Qcart.

---

## Cosas que vas a notar, y ya están identificadas

- **4 piezas tienen un subject de PRUEBA** guardado como su asunto real (`001-P001`, `001-P003`,
  `001-P005`, `009-P001`): dicen `[Test]:` y traen AMPscript a la vista. Tomaron el asunto del job
  de prueba en vez del envío real. Es cosmético y no afecta ninguna cifra.
- **8 celdas contienen varias URLs dentro de una sola celda** (`004-P001` tiene 11 en
  `URL_Receta_1`). En CSV van entre comillas y se leen bien, pero si tu herramienta las muestra
  raras, es por eso.
- La deuda declarada se concentra en `N_Envios_Fechados` (52 celdas), `Fuente_Qcart` (29) y los
  campos de periodo.

## Qué contiene

| piezas | BU · Marca · Campaña |
|---:|---|
| 33 | RN · Recetas Nestlé · AON |
| 24 | RN · Carnation, La Lechera · Hotcakes |
| 17 | Purina · Pro Plan · Fuel for life |
| 15 | RN · Maggi · Liga MX |
| 15 | RN · Maggi · Mundial |
| 15 | Nescafé · Concentrate · Hackea tu café |
| 8 | Nescafé · Clásico · Tercer Tiempo |
| 6 | Nescafé · ICE · The Freshers |
| 3 | Family Nes · NAN · Territorios |
| 2 | RN · La Lechera · Antojo Infinito |
| 1 | Chocolates · KitKat · F1 |

---

## Notas técnicas

- **UTF-8 con BOM.** Sin el BOM, Excel en Windows abre el CSV en ANSI y rompe los acentos
  (`Nestlé` → `NestlÃ©`). El BOM no estorba a `pandas`, a `git` ni a Google Sheets.
- **RFC 4180**: separador `,`, fin de línea `CRLF`, comillas dobles escapadas duplicándolas.
- Verificado al exportar: los CSV tienen **exactamente** las mismas columnas y filas que las hojas
  de origen (85/85 y 140/140 · 11/11 y 269/269).
