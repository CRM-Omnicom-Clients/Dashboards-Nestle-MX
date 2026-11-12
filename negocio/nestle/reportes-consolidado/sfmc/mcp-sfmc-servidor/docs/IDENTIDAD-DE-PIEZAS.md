# Cómo identificar una pieza en SFMC sin equivocarse

> Escrito después de reconciliar 76 piezas de Nestlé contra Datorama. Todo lo de aquí
> está verificado contra la instancia real (NMX, MID 10966050), no deducido.

## El problema

Un reporte de email cruza dos mundos: el **catálogo** que mantiene el equipo (una fila
por pieza, con su BU/marca/campaña/touchpoint) y lo que **SFMC** realmente envió. El
único puente entre ambos suele ser el **Content Name**. Y el Content Name es el peor
identificador posible: se puede renombrar, se puede repetir, y se puede reusar.

## Los tres identificadores, y para qué sirve cada uno

| Identificador | De dónde sale | Qué identifica | ¿Sirve de llave? |
|---|---|---|---|
| `_Job.JobID` | Data View `_Job` | **un envío** (un disparo concreto) | ✅ **Sí.** Es la llave real |
| `_Job.EmailID` | Data View `_Job` · SOAP `Send` → `Email.ID` | **el creativo** (el correo como pieza de contenido) | ❌ No — ver abajo |
| `_Job.EmailName` | Data View `_Job` | el nombre que tenía el creativo **en ese momento** | ❌ No |

### `EmailID` NO es una llave, aunque lo parezca

Es tentador: sobrevive a los renombres, es numérico, es estable. Pero identifica al
**creativo**, no al envío. Y un mismo creativo se reusa:

- el mismo correo mandado en dos journeys distintos (marzo y abril)
- el mismo correo mandado en dos campañas distintas (Día del Cachorro de marzo y de abril
  compartían `EmailID` 80234; Día del Niño y Día de la Madre compartían 81503)
- versiones A/B de un mismo envío que apuntan al mismo asset

Si se usa como llave, esas piezas **se fusionan** — justo las que el reporte quiere
separadas.

### Para lo que SÍ sirve: delatar duplicados y renombres

Esos son los dos problemas que el Content Name no puede detectar, y `EmailID` sí:

```sql
-- ¿dos piezas del catálogo apuntan al MISMO correo?
SELECT j.EmailID, COUNT(DISTINCT c.ConfigKey) AS NPiezas
FROM CRM_Reporte_Config c
INNER JOIN _Job j ON RTRIM(j.EmailName) = c.ContentName
WHERE c.Activo = 'Si'
GROUP BY j.EmailID
-- NPiezas > 1  =  duplicado en el catálogo
```

```sql
-- ¿un creativo se envió con más de un nombre? (= lo renombraron)
SELECT EmailID, COUNT(DISTINCT RTRIM(EmailName)) AS NNombres
FROM _Job GROUP BY EmailID
```

> ⚠️ El conteo de duplicados hay que hacerlo contra el **catálogo**, no contra la tabla de
> detalle. Cuando dos `ConfigKey` comparten Content Name, el `GROUP BY` del detalle
> conserva solo uno (`MAX(ConfigKey)`) y el duplicado desaparece justo de la columna que
> existe para delatarlo.

## Los renombres son reales pero casi siempre inofensivos

En NMX, **93 de 335 creativos (28%)** se enviaron bajo más de un nombre. El patrón es
siempre el mismo: nombre de borrador → nombre de convención.

```
"Career focused"     →  J_AO-…_MX_ES_CAREER-FOCUSED_AC_EM_A_V1_803867
"EP_4"               →  J_AO-…_MX_ES_PURCHASE-EP4_AC_EM_A_V1_863587
"Encuesta sachet"    →  O_El-antojo-infinito-…_LECHERA-SACHET…
```

**Pero el volumen bajo el nombre viejo es de 1 a 15 envíos** — son las pruebas internas
antes de publicar. De 76 piezas reconciliadas, en **cero** casos el renombre explicaba
una diferencia de volumen. Vale la pena detectarlos, no vale la pena reprocesar por ellos.

## El número final del Content Name es el ID de journey de Datorama

`…_AC_EM_A_V1_803867` → `803867`. Es el que permite cruzar con Datorama, y **no** es el
UUID del journey de SFMC (`72089CDC-…`) ni el `JourneyID` de `_Journey`. Son tres cosas
distintas que la gente llama "journey ID".

```sql
CASE WHEN CHARINDEX('_', REVERSE(RTRIM(j.EmailName))) BETWEEN 2 AND 9
       AND ISNUMERIC(RIGHT(RTRIM(j.EmailName),
             CHARINDEX('_', REVERSE(RTRIM(j.EmailName))) - 1)) = 1
     THEN RIGHT(RTRIM(j.EmailName),
             CHARINDEX('_', REVERSE(RTRIM(j.EmailName))) - 1)
     ELSE NULL END AS Journey_ID_Datorama
```

⚠️ Dos IDs parecidos pueden ser journeys **distintos**, no un typo. `803867` y `863587`
comparten dígitos y son dos journeys reales y separados (marzo por perfil vs abril por
comportamiento de compra). Antes de declarar "transposición", listar las piezas de cada
uno y mirar las fechas.

## Los FUP se detectan por el nombre, no por el catálogo

El touchpoint del catálogo puede no distinguirlos. El nombre en SFMC sí:

```sql
CASE WHEN RTRIM(j.EmailName) LIKE '%FUP%'
       OR RTRIM(j.EmailName) LIKE '%-FP[_ -]%'
       OR RTRIM(j.EmailName) LIKE '%-FP'
     THEN 'Si' ELSE 'No' END AS Es_FUP
```

Conviene guardar **las dos** versiones (la del catálogo y la de SFMC) en la tabla: donde
no coinciden, hay algo mal clasificado.

## 🔴 El bug que casi me hace reportar el doble

Al contar envíos con un `LEFT JOIN` a un catálogo que tiene **nombres repetidos**, cada
fila de `_Sent` se multiplica por cuántas filas del catálogo matchean:

```sql
-- MAL: si dos ConfigKey comparten ContentName, COUNT(*) sale al DOBLE
SELECT COUNT(*) FROM _Sent s
INNER JOIN _Job j ON j.JobID = s.JobID
LEFT  JOIN CRM_Reporte_Config c ON RTRIM(j.EmailName) = c.ContentName
GROUP BY j.EmailID
```

No da error. Da un número creíble. **Para contar volumen, no metas el catálogo en el
join** — cuenta primero por `JobID` y cruza el catálogo después, o usa `EXISTS` en vez
de `LEFT JOIN`.

## Agregar campos a una DE que ya tiene datos

No hace falta recrearla (y perder la historia). SOAP `Update` sobre `DataExtension` con
solo los campos nuevos, todos nullable:

```xml
<UpdateRequest><Options/>
  <Objects xsi:type="DataExtension">
    <CustomerKey>…</CustomerKey>
    <Fields>
      <Field><Name>Email_ID</Name><FieldType>Number</FieldType>
             <IsRequired>false</IsRequired><IsPrimaryKey>false</IsPrimaryKey></Field>
    </Fields>
  </Objects>
</UpdateRequest>
```

Orden correcto: **primero el campo, después el SQL**. Una columna que la DE tiene y la
query no devuelve queda en NULL; al revés, la query falla. Y validar leyendo
`DataExtensionField` de vuelta — el `OK · Data Extension updated` del Update no garantiza
que el campo haya entrado.
