# Organización del conocimiento — detalle

> Complemento de la sección "Qué va dónde" de CLAUDE.md. Aquí vive el **cómo**; allá quedó el **qué**.
> Ruta: `~/.claude/docs/organizacion-conocimiento.md`

## Cómo escribir una memoria

- **Una memoria = un tema.** Nombre en `kebab-case`, con frontmatter (`name`, `description`, `type`).
- Escribir el **por qué**, no solo el qué — y **cómo aplicarlo** la próxima vez.
- **Enlazar** con `[[nombre-de-otra-memoria]]`. Una memoria suelta se pierde; enlazada se encuentra.
- **Actualizar la existente** antes que crear una nueva parecida.
- Registrarla en el `MEMORY.md` de esa carpeta (una línea con liga y gancho).
  ⚠️ **`MEMORY.md` tiene tope duro: 200 líneas / 25 KB — lo que pase de ahí se DESCARTA al cargar,
  sin avisar.** Por eso el índice va a una línea por entrada y el detalle vive en archivos de tema.
- **NO guardar**: lo que ya está en el código o en git, ni lo que solo importa a esa conversación.
- ⚠️ Las memorias viven en carpetas nombradas según la **ruta de trabajo**. Si la carpeta del proyecto
  cambia de nombre (como pasó con Interpublic→OneWorkplace), **dejan de cargar sin avisar** → re-mapear.

## Qué hacer cuando CLAUDE.md rebasa el presupuesto

Objetivo <200 líneas. Se carga completo en cada sesión: cada línea cuesta **y de más de 200 líneas baja
la adherencia** — entre más largo, **menos caso** se le hace. La doc oficial lo dice sin rodeos:
*"un CLAUDE.md inflado hace que Claude ignore tus instrucciones reales"*.

Antes de agregar algo: *"¿le sirve igual a una sesión de Unilever que a una de la agenda personal?"*
Si no → memoria, regla o skill; no global.

Si lo rebasa, en este orden:
1. **Buscar redundancia** — ¿Claude Code ya lo sabe solo? ¿ya está en un skill o en un rules?
2. **Mover el detalle**, no borrarlo:
   - a `~/.claude/rules/*.md` con `paths:` → carga sola al tocar esos archivos
   - a `~/.claude/docs/*.md` → material de consulta, se lee cuando hace falta (cuesta 0 hasta leerlo)
   - a un **skill** → si es un procedimiento repetible
3. **Hasta el final, recortar.** No mutilar contenido bueno para cuadrar el número.

Verificar qué cargó de verdad con `/context`; `/doctor` propone recortes.

### Mecanismos y lo que cuesta cada uno

| Mecanismo | Cuándo carga | ¿Ahorra contexto? |
|---|---|---|
| Inline en CLAUDE.md | Siempre | No — pero sobrevive a `/compact` |
| `rules/` **sin** `paths:` | Siempre | No |
| `rules/` **con** `paths:` | Al leer un archivo que matchea | Sí |
| `docs/` + puntero con ruta | Solo si se lee | Sí |
| **Skill** | Cuando la tarea lo dispara | Sí |
| `@import` | Siempre (transclusión) | **No** — solo organiza |
| Comentario HTML `<!-- -->` | Nunca (se elimina del contexto) | Sí, pero Claude no lo ve |

⚠️ **Al acotar por `paths:`, tres límites** (verificados, no supuestos):
1. La regla se dispara cuando Claude **lee** un archivo que coincide → no sirve para reglas de
   *momento-de-escritura* (PowerShell/JSON, heredoc): esas fallan **antes** de que algo se lea.
2. El glob se evalúa contra `path.relative(cwd_de_la_sesión, archivo)` y **se rinde si sale con `..`**
   → **NO carga si el archivo está fuera de la carpeta donde abriste la sesión** (el caso normal al
   abrir un Excel de cliente en OneDrive desde otra carpeta).
3. **No se re-inyecta tras un `/compact`** — vuelve solo cuando Claude lee otro archivo que matchee.

**Corolario:** lo mandatorio se queda inline. A `rules/` va lo que, si un día no carga, no rompe nada.
Y lo que **no puede fallar nunca** no va en prosa: va en un **hook** (determinista), como el protocolo
de `.xlsx`. Ver [[reglas-acotadas-paths-mecanismo]].
