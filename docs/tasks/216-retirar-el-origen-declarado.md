---
id: 216
etapa: O8
serves: "A-122; ADR 0081 (enmienda ADR 0072 punto 6 y ADR 0062 punto 5)"
depends: []
status: review
---

# 216 — Retirar el origen declarado ("¿cómo nos conoció?")

## Por qué existe

Al salir de Atendido el motor exige `area_declarada` y los closers no saben si el lead vino de Paid, Orgánico o
Referido: eligen cualquiera para poder avanzar, así que el dato además es malo. Mani eligió quitarlo del todo
(no dejarlo opcional). El origen de verdad sigue saliendo del UTM y del link del closer (ADR 0044, 0045).

## Alcance

1. **Código primero** (se despliega antes de tocar la base, regla de AGENTS.md):
   - `lib/deals/requisitos.ts`: fuera el requisito `area_declarada` de toda flecha y de toda etapa.
   - Fuera el campo del diálogo (`dialogo-mover.tsx`, `responder-pregunta.tsx`, `transiciones.ts`), de la ficha
     (`ficha-pago.tsx`, `ficha-acciones.tsx`), de `editar-deal.ts`, `abonos.ts`, `mover-etapa.ts`, `kanban.ts`,
     `inbox.ts`, `ficha-deal.ts` y de las acciones de Deals.
   - Fuera la burbuja "sin UTM · según el comercial": `lib/queries/origen-declarado.ts` y su uso en
     `lib/queries/metricas-filtros.ts` y el dashboard.
2. **Migración después** (la genera y aplica la sesión principal, con el ok de Mani): `DROP COLUMN
   deals.area_declarada_id`, con `SET lock_timeout = '5s';`. Antes, contar cuántos deals la tienen llena y dejar
   ese número en el resultado del ticket (se pierde a propósito).
3. `lib/catalogo/areas.ts` se queda: las Áreas siguen agrupando Canales.

## Done cuando

- [ ] Ninguna flecha pide el área; salir de Atendido sin ella funciona (test del motor).
- [ ] No queda lectura de `areaDeclaradaId` en `lib/`, `app/` ni `components/` (grep vacío).
- [ ] La columna se quitó en producción después del deploy del código, con el conteo anotado.
- [ ] Typecheck, lint, `npm run build` y los tests tocados en verde.
