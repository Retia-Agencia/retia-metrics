---
id: 358
etapa: hub
serves: "ADR 0115 N5 (formato) · auditoría 30-oct G-09, G-10, G-12, R-12, U-04, U-13, U-20, U-22"
depends: [357]
status: todo
---

# 358 — Formato único, insignias únicas y la regla del vacío

Auditoría: [`docs/auditoria-metricas-2026-10-30.md`](../auditoria-metricas-2026-10-30.md). Reglas: ADR 0115.

## Por qué

- **G-12:** "62,5%" (`pct`) contra "5,00 %" (`programa/page.tsx:360`, `operacion.tsx:19`); "COP 1.234" contra "1.234 COP"
  (`objetivos-de-la-cohorte.tsx:74`) contra "$1.234 COP" (WhatsApp); ROAS sin unidad; cuatro helpers locales de
  porcentaje; "—", "0", "Sin dato", "sin pauta", "Ninguno por ahora" sin regla.
- **G-09:** el resultado de llamada vive en dos mapeos (`lib/deals/estado-de-llamada.ts` y `lib/queries/llamadas.ts:30`)
  y sale "No-show" con guion en `operacion.tsx:125`.
- **G-10:** la calidad del lead tiene tres nombres ("Calidad", "Estado de llegada", `calificacion`) y tres variants de
  badge (`neutro`, `info`, `secondary`), en inglés crudo.
- **U-20:** el semáforo imprime el enum crudo (`problema`) en un badge y "09h".

## Decisión abierta

- **DA-7:** ¿High/Mid/Low se traducen? Viene así del formulario; decide Gerencia.

## Alcance

1. `pct`, `usd`, `cop`, `razon` (con "×") y `fecha`/`hora` de `lib/format.ts` como única forma de escribir esos datos,
   también en WhatsApp. Se borran los helpers locales.
2. La regla del vacío (N5) en `docs/structure.md` §9 y en un componente: "—" no se puede calcular, "0" es cero, "Sin
   datos" aún no hay periodo medido.
3. Un mapeo por dominio en `lib/` (resultado de llamada, semáforo, tipo de nota) y `<InsigniaDeCalidad>` en
   `components/leads/`, usados en todas las pantallas.
4. Guardián: un helper local de porcentaje o moneda, o un segundo `Record<Resultado, string>`, falla.

## Done cuando

- [ ] `tests/format.test.ts` cubre `razon` y la regla del vacío.
- [ ] Guardián mordido en los dos sentidos.
- [ ] Recorrido: la calidad se ve igual en Leads, Deals y la ficha; el semáforo con el mismo vocabulario en UI y WhatsApp.
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y cualquier ADR que cambie quedan reescritos en el mismo commit, título e índice incluidos.
