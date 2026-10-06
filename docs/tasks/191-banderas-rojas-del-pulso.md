---
id: 191
etapa: O6
serves: "148 (Lo que sigue, punto 8); comercial.md GC-20, GC-32"
depends: [148]
status: en curso
---

# 191 — Las banderas rojas que faltan en el Pulso

## Alcance

1. **Atendido sin valor:** deals en Atendido o más adelante sin el valor vendido que exige el 128.
2. **Atendido sin Grain**, como bandera aparte de "shows sin Grain" (ADR 0066).
3. Cada bandera con su número, su % y su lista (ADR 0067), con las alertas que ya define el 128, sin otra regla.

## Done cuando

- Test por bandera: la cifra contra su lista, con anulados y otro programa.
- Typecheck, lint, tests, `npm run build`; recorrido en `dev:local`.

## Entrega 5-oct (Alejo + Claude)

- `lib/queries/banderas-del-pulso.ts`: el universo (deals vigentes en Atendido, Compromiso Verbal o Ganado, sin
  cortesías ni Cierre perdido, acotados por el dueño del deal) y los dos predicados. **Foto de hoy**, como la
  cartera: el periodo no las acota. "Sin valor" es valor vendido nulo o cero; "sin Grain" es la regla de la alerta
  roja de la ficha (ADR 0066: una llamada vigente que ocurrió sin link), ahora por deal.
- Las métricas `atendidos_sin_valor` y `atendidos_sin_grain` en `metricas-con-filas.ts` usan los mismos
  predicados, así que la cifra y la lista no pueden discrepar. Tarjetas rojas en el Pulso (número, % sobre los
  atendidos, "a hoy") y en el Pulso de "todos" (los conteos se suman; el % va por programa).
- El diálogo de una cifra que es foto de hoy ya no dice "registros del periodo A" (`fotoDeHoy` en
  `DetalleDeCifra`): arregla también la cartera y los abiertos del embudo, anotados el 5-oct.
- `tests/banderas-del-pulso.test.ts`: la cifra contra la lista deal por deal, con anulados (deal y llamada),
  cortesía, perdido, otro programa y el filtro de closer. Build y recorrido en `dev:local` (1440 y 375 px, gerente y
  closer, diálogo y listas por programa y de todos; consola limpia).
- **Ojo para producción:** los deals ganados históricos sin valor vendido (eximidos al moverse) cuentan como "sin
  valor". Es cierto, pero si son muchos la bandera se vuelve ruido.

