---
id: 191
etapa: O6
serves: "148 (Lo que sigue, punto 8); comercial.md GC-20, GC-32"
depends: [148]
status: todo
---

# 191 — Las banderas rojas que faltan en el Pulso

## Alcance

1. **Atendido sin valor:** deals en Atendido o más adelante sin el valor vendido que exige el 128.
2. **Atendido sin Grain**, como bandera aparte de "shows sin Grain" (ADR 0066).
3. Cada bandera con su número, su % y su lista (ADR 0067), con las alertas que ya define el 128, sin otra regla.

## Done cuando

- Test por bandera: la cifra contra su lista, con anulados y otro programa.
- Typecheck, lint, tests, `npm run build`; recorrido en `dev:local`.
