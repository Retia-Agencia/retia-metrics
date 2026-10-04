---
id: 192
etapa: O6
serves: "148 (Lo que sigue, punto 14); ADR 0048"
depends: [148]
status: todo
---

# 192 — El dashboard de todos los programas con las secciones nuevas

## Alcance

`app/(app)/dashboard` gana las secciones del 148 **solo con sumas en la misma unidad** (ADR 0048): conteos,
contratado y caja en USD, cartera en USD. Las tasas, la meta, la comisión y el descuento van **por programa, lado a
lado**, y la función del agregado no compila con una tasa (`lib/queries/agregado-programas.ts`).

## Done cuando

- Test: la suma de dos programas es la suma de sus dashboards; intentar sumar una tasa no compila (test de tipos).
- Un closer ve solo sus programas (ADR 0048); forjar un programa ajeno no suma nada.
- Typecheck, lint, tests, `npm run build`; recorrido en `dev:local`.
