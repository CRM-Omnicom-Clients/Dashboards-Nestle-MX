---
name: node-cpsync-ruta-con-acento
description: "En esta máquina (Node 24.14.1, Windows) fs.cpSync MATA el proceso en silencio si la ruta de origen lleva un acento (como \"Nestlé\" en la carpeta de CRM General); copiar a mano con readdirSync + copyFileSync"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3fcc95e0-6a7f-416d-8815-86a488810f41
  modified: 2026-10-03T00:58:35.120Z
---

`fs.cpSync(origen, destino, { recursive: true })` termina el proceso de golpe (código 0xC0000409; bash lo muestra como exit 127) **sin ningún mensaje** cuando la ruta de ORIGEN contiene un carácter
no ASCII, p. ej. la `é` de `…\Nestlé 2026\…\CRM General`. Espacios y paréntesis solos no lo provocan; `copyFileSync`, `readFileSync`, `writeFileSync` y `mkdirSync` con esa misma ruta funcionan bien.
Medido el 2-oct-2026 con 4 casos en procesos hijos (ASCII ok · acento FALLA · espacios y paréntesis ok · acento+espacios+paréntesis FALLA).

**Why:** un script que copia desde o hacia las carpetas de OneDrive/SharePoint de Rick puede morir sin decir por qué (me costó un diagnóstico falso: parecía que `node.exe` había desaparecido).
**How to apply:** en scripts que toquen rutas de CRM General, copiar con una función recursiva (`readdirSync` + `copyFileSync`), nunca `cpSync`. Si un proceso de Node sale con 127 y sin salida, sospechar de esto antes que de la instalación de Node.
Ver [[plan-portabilidad-sfmc]] (la herramienta que publica la carpeta de CRM General copia archivo por archivo).
