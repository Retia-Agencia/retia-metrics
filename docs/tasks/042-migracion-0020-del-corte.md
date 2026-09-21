---
id: 042
etapa: E1
serves: "plan v2 §6 etapa 1 · tarea E1-6 · ADR 0018"
depends: [036, 037, 038, 039, 040, 041]
status: todo
---

# 042 — La migracion `0020` del corte: `dev` primero, `production` solo con el ok de Mani

> **Es el cierre de la etapa 1.** Los seis tickets anteriores dejan el esquema escrito; este lo
> aplica. **La genera y la aplica la sesion principal, nunca un subagente** (AGENTS.md).

## Objetivo

Una sola migracion pensada para todo el corte, no seis parches.

## El orden importa y no es negociable

1. Renombres y cambios de tipo (`people` → `leads`, `estado` a texto, `responsable_closer_id` fuera).
2. Tablas nuevas (037) con sus indices.
3. `calls.deal_id`, `abonos.deal_id`, `drop table sales`.
4. `sources`: borrar las 7 filas, quitar `destino`, **desactivar `Forms viejo`**, y solo **despues**
   crear el indice unico parcial. Al reves falla.
5. La terna `anulado_*` de `deals`.

⚠️ **`drizzle-kit generate` es interactivo:** cuando una columna se va y otra llega en el mismo
cambio, **pregunta si es un renombre**. Un agente sin terminal se queda colgado ahi. Por eso este
ticket es de la sesion principal.

⚠️ **`db:push` y `db:drop` estan DENEGADOS** en `.claude/settings.json`. Solo `generate` y
`migrate`.

## Done cuando

- [x] Migracion aplicada en `dev`, **verificada contra `neon.branch_id`** (`br-withered-sun-b439zjof`),
      no contra el nombre de la variable de entorno. El 16-sep `DATABASE_URL` resulto apuntar a
      `production`.

      ⚠️ **Paso previo, solo en `dev`:** la rama tenia 4 `calls`, 3 `sales` y 5 `abonos` del
      recorrido visual (en `production` son 0, que es lo que midieron los ADR). Esos abonos cuelgan
      de ventas que la migracion elimina, asi que **no hay a donde migrarlos**: se borraron antes
      de aplicar, con un guardia de rama en el script. Eso NO va dentro de la migracion — un
      `DELETE FROM abonos` en un archivo de migracion es un explosivo para el dia que `production`
      si tenga filas.
- [ ] `npm test`, `npm run typecheck` y `npm run lint` limpios sobre la rama completa.
- [x] Los datos de `dev` despues del corte: **2.059 leads** (no 4.791 — esa cifra era de
      `production`, medida para el ADR 0035; el ticket las confundia), `sources` con 3 filas (2
      activas, una por programa, y `Forms viejo` inactiva), `sales` inexistente, `people`
      inexistente, `leads.estado` de tipo `text`, `responsable_closer_id` fuera y las **271 filas
      de `change_log` que decian `people` ahora dicen `leads`**.
      El invariante real no es el numero: es que **el conteo no cambie con la migracion**, y no
      cambio, porque `people` se RENOMBRA y no se re-crea.
- [ ] **`production` solo con el ok explicito de Mani** (ADR 0018), y despues del ok, verificada
      igual contra `neon.branch_id`.
- [ ] La rama de la etapa 1 se fusiona a `main` **entera**, con los siete tickets cerrados.

## Kiro

**No.** Migraciones nunca.
