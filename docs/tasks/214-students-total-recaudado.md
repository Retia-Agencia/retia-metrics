---
id: 214
etapa: corte
serves: "Mani, 9-oct (recorrido de Students tras el 208)"
depends: []
status: todo
---

# 214 — Students: total recaudado fijo abajo, y un saldo que se entienda

## Por qué existe

1. Students no dice cuánto se ha cobrado de la cohorte. Mani: un total recaudado en un rectángulo fijo en la
   parte inferior de la lista, como Potencial y Confirmado al pie de cada columna de Deals
   (`components/deals/tablero-kanban.tsx`).
2. La columna Saldo decía "sin precio de contrato registrado" en los 26 estudiantes migrados. Quería decir
   que el deal no tenía valor vendido, así que no había contra qué restar lo abonado. El dato se corrige
   aparte, desde el "Precio final" de la hoja (208); el texto, que nadie entendió, sigue igual (`saldoLegible` en `lib/format.ts`).

## Alcance

- Al pie de la lista de Students, fijo mientras se hace scroll: **Recaudado** (suma de abonos vigentes de los
  estudiantes que se ven) y, al lado, **Por cobrar** (suma de saldos). Siempre en USD con la moneda al lado.
- Las cifras salen del módulo de dinero (`lib/queries/saldo.ts`, ADR 0024) y de `vigente(abonos)`; nunca un
  `sum(abonos.monto)` a mano. Respetan los filtros de la lista (cohorte, closer, onboarding).
- El total abre su lista, como toda cifra (ADR 0067), si el molde lo permite sin una pantalla nueva.
- El texto del saldo sin valor vendido pasa a algo que un closer entienda, por ejemplo "Falta el valor
  vendido", y enlaza a la ficha donde se carga.

## Done cuando

- [ ] El pie muestra Recaudado y Por cobrar y cuadra con la suma de las filas (test).
- [ ] Cambiar un filtro cambia el total.
- [ ] El texto nuevo del saldo en Students, ficha y Mi día (todos usan `saldoLegible`).
- [ ] Recorrido en claro y oscuro, a 390 px.
