# 0014 — "Corte" pasa a llamarse "Cohorte" en todo el proyecto

**Fecha:** 2026-09-16

El proyecto usaba dos palabras para la misma cosa: la tabla se llama `cohorts`, pero el tipo es
`Corte`, el enum es `estado_corte`, la columna es `trm_corte` y la UI y los documentos dicen
"corte". Dos nombres para un concepto obligan a traducir en cada lectura.

**Decidimos usar "Cohorte" en todas partes** (decision de Mani, 16 de septiembre): glosario,
documentos, UI, nombres de variables, tipos y base de datos.

| Antes | Despues |
|---|---|
| tipo `Corte` | `Cohorte` |
| `estadoCorteEnum` / `estado_corte` | `estadoCohorteEnum` / `estado_cohorte` |
| `cohorts.trmCorte` / `trm_corte` | `cohorts.trmCohorte` / `trm_cohorte` |
| `corteActivo()` (planeado) | `cohorteActiva()` |
| "Corte C2" en la UI | "Cohorte C2" |

La tabla `cohorts` no cambia de nombre: los nombres de tabla del esquema estan en ingles y ya
decian cohorte.

## Consecuencias

- Migracion con `ALTER TYPE ... RENAME` y `ALTER TABLE ... RENAME COLUMN`, sin perdida de datos
  (ticket 008). Se escribe a mano porque `drizzle-kit generate` pregunta de forma interactiva si
  es un renombre o un borrado.
- Los insumos historicos (`docs/insumos/`) no se reescriben: son material crudo con fecha.
- Los ADR anteriores a este conservan la palabra "corte" en su texto; leerla como "cohorte".
