---
id: 095
etapa: E5
serves: "ADR 0048 punto 2 · ADR 0050 · propuesta 24-sep §3.6"
depends: [064, 089, 094, 136, 137]
status: todo
---

# 095 — La tab Dashboard: un programa, o "todos los programas" solo con lo sumable

## Objetivo

Reemplazar los dashboards por programa (`/programas/[slug]`) por **una** tab Dashboard con selector de
programa, y la opción "todos los programas".

## Lo que se suma y lo que no (ADR 0048)

| Se suma | Va por programa, lado a lado |
|---|---|
| # leads, # deals, # ventas, # llamadas | % de show, % de cierre, conversión etapa a etapa |
| caja recaudada USD, saldo por cobrar USD | meta de cupos y meta dinámica |
| gasto de pauta | CPL, CPI, CAC, ROAS |
| conteos por área y por canal | comisión |

## Alcance

- **Dentro:** la tab, el selector (lo da el ticket 097) y la función que arma el agregado.
- **Dentro:** 🩸 **la garantía vive en el tipo**: la función del agregado recibe métricas de tipo
  "sumable" y no compila con una de tipo "tasa". Mismo molde que el comparativo del ADR 0023.
- **Dentro:** para un closer, "todos" son sus programas (ticket 094).
- **Fuera:** el layout definitivo y los umbrales de Gerencia (siguen pendientes, ticket 090).

## Done cuando

- [ ] "Todos los programas" muestra solo sumas; ninguna tasa combinada aparece.
- [ ] Un test de tipo prueba que pasarle una tasa al agregado **no compila**.
- [ ] La caja agregada cuadra con la suma de la caja de cada programa en el mismo rango.
- [ ] `/programas/[slug]` redirige a la tab Dashboard con el programa en la URL.

## Kiro

Sí, con revisión visual.


---

## Enmienda 2026-09-29 (reunión con Pauta, [`docs/analytics.md`](../analytics.md))

- Presets de fecha que faltan (PT-36): ayer, últimos 7, 14 y 30 días, mes pasado. Comparativos en cada KPI (DP-16). Las secciones de Pauta son del 123 y el cumplimiento del 124.
- El paid trafficker ve este Dashboard para sus programas menos el comparativo entre closers y la comisión (ADR 0052 enmendado).


---

## Enmienda 2026-10-01 (norte comercial, lote 1, [`docs/comercial.md`](../comercial.md))

- Toda cifra del dashboard usa el selector del **136** (A contra B, atajos, número y %) y abre su lista por el **137** (resumen primero, lista paginada después; en "todos", partida por programa). Ejes lineales siempre (ADR 0067).
- El contratado y la comisión leen el valor vendido (132, 133); la comisión no se suma entre programas.
- Las secciones del dashboard (Pulso, Operación comercial, Dinero) van en el **148**, bloqueado por las etapas (142).
