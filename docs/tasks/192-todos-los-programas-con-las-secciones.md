---
id: 192
etapa: O6
serves: "148 (Lo que sigue, punto 14); ADR 0048"
depends: [148]
status: done
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

## Nota de cierre (5-oct, Alejo + Claude; Codex empezó y se quedó sin cuota)

- `/dashboard` en pestañas (Pulso, Operación, Dinero, Pauta) con `Pestanas` y `PantallaFija`, como el de un programa.
  Sumado (ADR 0048): leads, agendas, shows, cierres, sin Grain, sin resultado, contratado USD (`sumarUsd`), caja por
  moneda y la cartera de hoy en USD. Por programa, lado a lado: % show, % cierre, % sin Grain, cohorte activa, meta del
  mes, comisión y descuento. Operación y Pauta repiten la pieza de cada programa con su nombre encima.
- `sumarUsd` solo acepta `Dinero<"USD">`: ni una tasa ni otra moneda compilan. Cada fila arma
  `armarVistaDelDashboard` del programa, así que tasas, comisión, descuento, metas y saldo tienen UNA definición.
- La lista de todos acepta `sin_resultado`, `contratado` y `cartera`; "Volver" regresa a la pestaña de la cifra.
- Tests: `tests/vista-todos.test.ts` (la suma es la suma de los dashboards propios; un programa fuera del alcance no
  suma) y `tests/agregado-programas.test.ts` (`@ts-expect-error` con tasa y con COP). Typecheck, lint, guardianes y
  `paginas.test.ts` en verde.
- **5-oct (tarde):** `npm run build` limpio. Recorrido en `dev:local` como developer: Pulso, Operación, Dinero y Pauta cargan; Pauta y las tasas van por programa, lado a lado. Prueba de costura (mayo a 5-oct): caja de todos USD 19.940,30 = 8.190,30 + 11.750,00, y 28 sin valor vendido = 16 + 12. Consola sin errores. **Falta:** 375 px y el checkpoint.
- Deuda: Operación de "todos" llama `Operacion(...)` como función y cambia su `id` con `cloneElement` para no repetir
  el ancla; si la pieza aceptara un `id`, sobraría.

