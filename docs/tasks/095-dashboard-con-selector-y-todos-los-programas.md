---
id: 095
etapa: E5
serves: "ADR 0048 punto 2 · ADR 0050 · propuesta 24-sep §3.6"
depends: [064, 089, 094]
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
