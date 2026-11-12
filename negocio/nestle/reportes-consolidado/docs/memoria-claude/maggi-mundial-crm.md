---
name: maggi-mundial-crm
description: "Campaña MAGGI Mundial 2026 (CRM Nestlé RN) — piezas, clusters, personas↔país, reglas de copy anti-FIFA y UTM. El estatus vive en el calendario rector, no aquí"
metadata:
  node_type: memory
  type: project
  originSessionId: 25fc3efd-d999-4fd9-a612-ea0e487543a5
---

CRM Nestlé RN · campaña **MAGGI Mundial 2026** (jul 2026). Master de trabajo: `CRM RN\Maggi Mundial\Copyes\(Interno) CRM_BRIEF_MAGGI_JUNIO.xlsx`. El entregable cliente `Cliente_CRM_BRIEF_MAGGI_PARTIDOSMUNDIAL.xlsx` NO se edita: solo se copian resultados finales.

> **Qué NO está aquí (a propósito):**
> - **Estatus y fechas de envío** → la fuente de verdad es el **calendario rector** (`Marcas/CRM General/CRM-Nestlé-Calendario de envíos.xlsx`, hoja `Envíos`, filtra marca **Maggi** / campaña **Mundial**). Consúltalo ahí; no lo dupliques.
> - **Cómo editar el .xlsx** → `CLAUDE.md` global, sección Excel. Solo el dato específico: **este brief tiene 8 imágenes embebidas** → editar por **COM** (o cirugía XML); SheetJS/openpyxl las destruyen.
> - **El patrón general de "propiedad con derechos"** → vive en `~/.claude/rick-copies/conocimiento/hipotesis-refutacion.md` como **H11** (y el universo cerrado se fija en `rick-copies-tactica`). Aquí queda solo la regla concreta de esta campaña.

**Piezas y clusters:** E-Semifinal A (SF-A, Dallas) · E-Semifinal B (SF-B, Atlanta) · E-Gran Final (New Jersey). Cada hoja tiene 2 bloques/clusters: **Botanas** (bloque 1) y **Modern Cooking** (bloque 2). Se quitó el cluster Bebidas.

**Tablas de variación** (cols D=País · E=Cruce personas · F=Hero · G=Copy1 · H/I=Receta A+link · J/K=Receta B+link). Botanas filas 11-14 (SF) / 11-26 (GF); Cooking 43-46 (SF) / 43-58 (GF). Al 2026-07-08: 48 filas QA-coherentes, 0 errores.

**Personas↔país** (referencia cultural, para NO nombrar el país): Parisianos=Francia · Sultanes=Marruecos · Toreros=España · Belgas=Bélgica · Caballeros=Inglaterra · Vikingos=Noruega · Asadores=Argentina · Guardias Suizos=Suiza. Cruces SF-A={Paris,Sult}×{Tore,Belg} · SF-B={Cab,Vik}×{Asad,GS} · Final=4×4=16.

**Reglas de copy (ambush FIFA — riesgo ~29 MDP):** prohibido en copy cliente-facing decir *país / FIFA / Mundial / Copa del Mundo / marcas oficiales*. Sí permitido: fútbol, afición, "la gran final del fútbol", y el gentilicio **solo dentro del nombre de la receta** (Tortilla Española). Ritual SIN número: **"Échale MAGGI"**. Footer canónico: *"¡Porque MAGGI y el fútbol son oficialmente inseparables!"*. Hero Gran Final: *"⚔️ Llegó el día más esperado del fútbol: los {A} vs los {B}. El último gran grito."*

**Recetas:** SOLO saladas y REALES de recetasnestle.com.mx (validadas 1×1). **La Final usa recetas DISTINTAS a las de semifinal** (1 por país por cluster). Ver [[maggi-recetas-validadas]].

**Hoja `ENVIOS_UTM_SF_FINAL`:** 32 filas = 1 receta por país por cluster por touchpoint. Fijos: utm_campaign=`maggi-julio26` · utm_source=`crm-hive` · utm_medium=`email` · utm_content=`e-{cluster}-{evento}` · utm_term=`botanas`/`modern-cooking`. El país va en la col "Coments". Receta2 y ops (retailer/QCart/fechas/códigos) quedaron vacías para el equipo CRM.

⚠️ **Duplicados engañosos** (verificado jul-16): en `Copyes/_Archivo/` hay `borrar (Interno) CRM_BRIEF_MAGGI_JUNIO.xlsx` que **NO es copia** del máster — es **más nuevo (jul-09 11:09 vs 10:54) y 88 KB más grande**, o sea alguien guardó cambios sobre la copia archivada. **No borrar sin comparar**: puede tener trabajo que el máster no tiene.

**Siguiente paso:** copiar las piezas finales al brief `Cliente_` y marcar el cruce ganador cuando se sepa el resultado. Para saber **qué ya salió y qué falta**, mira el calendario rector (arriba) — no confíes en fechas escritas en esta memoria.
