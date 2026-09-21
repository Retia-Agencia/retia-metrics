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

- [ ] Migracion aplicada en `dev`, **verificada contra `neon.branch_id`** (`br-withered-sun-b439zjof`),
      no contra el nombre de la variable de entorno. El 16-sep `DATABASE_URL` resulto apuntar a
      `production`.
- [ ] `npm test`, `npm run typecheck` y `npm run lint` limpios sobre la rama completa.
- [ ] Los datos de `dev` despues del corte: 4.791 leads, `sources` con 3 filas, `sales` inexistente.
- [ ] **`production` solo con el ok explicito de Mani** (ADR 0018), y despues del ok, verificada
      igual contra `neon.branch_id`.
- [ ] La rama de la etapa 1 se fusiona a `main` **entera**, con los siete tickets cerrados.

## Kiro

**No.** Migraciones nunca.
