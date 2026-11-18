---
id: 422
etapa: pauta
serves: "ADR 0048 (qué se suma en «todos») · ADR 0043 (el programa es frontera) · docs/paid-media-2026-11-09.md §6 («Todos los programas») · docs/diseno-cifra-y-pauta.md §6 y la fila X-4 · docs/audit-hub-2026-11-10.md §4.4 y D-C · ticket 412 (nota del 10-nov) · ADR 0115 (N1, N4, N7)"
depends: [419, 420]
status: en curso
---

# 422 — Hub de todos los programas: la Pauta con la misma forma, sin cruzar programas

Nace del 403 (decisión de Mani, 10-nov): el `/hub` de «todos los programas» quedó con la Pauta vieja cuando el 412 fundió Origen
y Pauta y construyó la tabla semanal, el cumplimiento y la traza **solo en el Hub de un programa**. No entra al 403 porque no cambia
ninguna cifra: es una pantalla distinta y su forma depende del 419 y el 420. Este ticket no inventa nada: cada punto del alcance
cita de dónde sale.

## Qué hay hoy (medido el 10-nov en `dev:local` y en el código)

`/hub?seccion=pauta` (`app/(app)/hub/pauta.tsx`, `PautaPorPrograma`): para cada programa visible pinta **solo** la tabla «Pauta:
origen, embudo y ROAS» (`PautaRoas` con `soloConteos`, la del 355, por campaña o canal) y, en su tab de Origen, `OrigenPorPrograma`.
**No tiene:** cumplimiento de cohorte, tabla semanal (M1 a M19), gráficas de inversión y agendas, «¿Cómo va el costo por agenda hoy?»,
traza de pauta, ROAS a hoy y proyectado, ni el embudo del formulario. Y no tiene ninguna cifra sumada entre programas, ni siquiera
las sumables.

## Qué se pidió y qué está decidido (la fuente de cada punto)

| Punto | Lo decidido | Fuente |
|---|---|---|
| Qué se suma entre programas | Solo conteos, caja en USD y gasto, **en la misma unidad**; ROAS, costos, tasas, metas y cumplimiento **por programa, lado a lado**; la función del agregado no compila con una tasa | ADR 0048 punto 2 (tabla «Se suma / Va por programa») y ADR 0043 |
| La tabla semanal en «todos» | **Una tabla por programa**, no una sola | `docs/paid-media-2026-11-09.md` §6 («Todos los programas») |
| Moneda | Nunca convertir en silencio; la inversión se suma solo dentro de la misma moneda, con la moneda al lado | AGENTS.md (restricciones) y ADR 0124 |
| La forma de cada cifra | La Cifra y su explicación (qué mide, fórmula, cada número, filtros y lista) en todo el Hub | `docs/diseno-cifra-y-pauta.md`, ticket 419; norte visual `docs/bocetos/una-forma-de-metrica.html`, tal cual |
| La estructura de Pauta | Dos vistas, Resultados y Origen y calidad, con los mismos filtros | ticket 420 |
| Rótulos | Uno por concepto, del vocabulario; el bloque de Pauta con el subtítulo «solo Paid»; Comercial con «todas las áreas» | D-C (`docs/audit-hub-2026-11-10.md` §8), ya en `main` (403 F2) |
| Agendas diarias por programa con interruptores | **«Falta decidir»**; solo cantidades, nunca tasas entre programas | `docs/diseno-cifra-y-pauta.md` (tabla de pedidos), `docs/paid-media-2026-11-09.md` X-4 |

## Decisiones (contestadas por Mani el 10-nov, con la recomendación)

| # | Pregunta | Recomendación | Por qué |
|---|---|---|---|
| DT-1 | ¿«Todos» lleva una franja de totales sumables arriba (inversión por moneda, agendadas de Paid, ventas, vendido en USD)? | Sí, con su moneda y sin tasas | Es lo que el ADR 0048 permite sumar y lo que pidió Gerencia para ver el conjunto; sin ella «todos» no suma nada |
| DT-2 | ¿Se incluye la gráfica de agendas diarias por programa con interruptores (X-4)? | Sí, como una línea por programa (cantidades) | Está dibujada en el boceto y «solo cantidades» respeta el 0048; usa la gráfica del 370, sin código nuevo de dibujo |
| DT-3 | ¿Cada programa en «todos» repite las dos vistas completas o solo Resultados (tabla semanal y cumplimiento) con un enlace a su Origen y calidad? | Resultados por programa, y Origen y calidad con enlace al Hub del programa | 4 programas × 9 bloques es una pantalla ilegible; el contrato de entendimiento pide poco texto y lo principal visible |

## Alcance (DT-1 a DT-3 = sí)

1. **Sección Pauta de `/hub`** con la forma del 420: por programa, lado a lado, con el rótulo y el subtítulo del vocabulario, y la
   tabla semanal de cada programa (una por programa, §6 del 9-nov).
2. **Franja de totales** (DT-1): solo magnitudes sumables en la misma unidad, con la guarda en el **tipo** (la función del
   agregado no admite una tasa; `lib/queries/vista-todos.ts`), y la moneda al lado de cada número.
3. **Cifra y explicación (419)** en cada cifra de «todos»: la explicación dice por programa, no combinada.
4. **Retirar `PautaRoas soloConteos` y `OrigenPorPrograma`** cuando queden cubiertos (N7: reemplazar es borrar).
5. **Gráfica de agendas diarias por programa** (DT-2, X-4): una línea por programa, solo cantidades, con los tres interruptores del 370 y sin echarts directo.
6. **Resultados por programa** (DT-3): tabla semanal y cumplimiento de cada programa; Origen y calidad solo como enlace a su Hub.
7. **Paridad (N2):** cada total de «todos» es la suma de las cifras del Hub de cada programa (test con dos programas y monedas
   distintas, y con un programa sin gasto cargado: da «—», no cero).

**Archivos calientes:** `app/(app)/hub/pauta.tsx`, `app/(app)/hub/page.tsx`, `lib/queries/vista-todos.ts`, `components/pauta/*`. Los
mismos del 420 y 419 (carril P, Alejandro): **no se empieza hasta que el 420 esté en `main`**, para no pisarse.

**Migración:** Ninguna.

## Fuera

- Cualquier cifra que cruce programas y no sea una suma en la misma unidad (ADR 0048). ROAS, costo por agenda y tasas de «todos»
  son por programa.
- Cambiar una fórmula o un rótulo: ya están decididos (D-A a D-E, 403 F1). Aquí solo se muestran.
- Quién ve «todos»: no cambia (gerente, developer y paid trafficker según su alcance; el closer, 404, ADR 0082).

## Done cuando

- [x] DT-1 a DT-3 contestadas por Mani (10-nov): las tres con la recomendación (franja de totales sumables; gráfica de agendas diarias por programa; Resultados por programa y Origen y calidad con enlace al Hub del programa).
- [ ] `/hub` Pauta: la misma forma que el Hub de un programa, comparada lado a lado con el boceto en claro, oscuro y 375 px. *(18-nov: construida y vista en oscuro; falta claro y 375 px.)*
- [x] Ninguna tasa, ROAS ni costo combinado entre programas; solo entran las filas que el registro marca sumables (`FILAS_SUMABLES_DE_PAUTA`) y `tests/cifras-de-pauta-de-todos.test.ts` lo muerde con las tasas.
- [x] Test de paridad: total de «todos» = suma de los programas y un programa sin gasto no aporta cero (`tests/cifras-de-pauta-de-todos.test.ts`). Las monedas no se mezclan: Inversión es solo COP y Vendido solo USD, cada una en su Cifra.
- [ ] Rótulos solo del vocabulario; el subtítulo «solo Paid» y «todas las áreas» donde corresponda.
- [x] `PautaRoas soloConteos` y `OrigenPorPrograma` borrados (también el componente `Origen`, que solo ellos usaban, y el parámetro `soloConteos` de `TablaDeOrigen`).
- [ ] Recorrido del gerente y del paid trafficker con alcance limitado; `npm run build`, `test:humo` y consola limpia.

**Costura con el 419 (enmienda del 13-nov).** Este ticket lleva solo la **Pauta** de `/hub`. Hoy, Comercial y Dinero de `/hub`
(`app/(app)/hub/secciones.tsx`: 3 `CifraConLista`, 4 `CifraDeRazon`, `Tarjeta` y `Variacion`) pasan a la Cifra en la fase **E-4
del 419**. Los dos tocan `app/(app)/hub/secciones.tsx`, `app/(app)/hub/page.tsx` y `components/pauta-roas.tsx`: **no van a la
vez**. Orden: primero este 422 (Pauta), después E-4 del 419; quien termine avisa en el archivo del otro ticket. Medido el 13-nov:
`soloConteos` aparece en 5 archivos y `OrigenPorPrograma` en 2; repetir el `grep` antes de borrar.

## Avance

**18-nov · Sesión de UI: la Pauta de `/hub` con la forma del Hub de un programa** (commit local; PR de la sesión padre).

- **Hecho:** `/hub?seccion=pauta` pinta (1) una franja de totales sumables, cada uno una Cifra en su unidad: Inversión (COP),
  Agendadas, Ventas y Vendido (USD), con «Suma de programas» y los programas que la componen en «Calculada con»
  (`lib/hub/cifras-de-pauta-de-todos.ts`, puro); (2) «¿Cuántas agendas trae cada programa?», una línea por programa, solo
  agendas de Paid, con Paso y Forma en la URL (`?g_pauta-programas=…`) y clic en un punto que abre su explicación
  (`components/pauta/agendas-por-programa.tsx`); (3) por programa, su cumplimiento de cohorte y su tabla semanal, sin la
  gráfica propia, y el enlace «Origen y calidad →» a su Hub (DT-3). El cargador (`lib/queries/hub-todos.ts`) lee la tabla
  semanal de cada programa con su cohorte activa y la pasa a `TablaSemanalDePauta` (`vistaLeida`) para no leerla dos veces.
- **Decisiones que tomé (Mani, confirma):** (a) un programa sin dato (sin gasto cargado) **no aporta cero**: no suma, se nombra
  en la explicación y la cifra queda «Parcial»; si ninguno tiene dato, «—» con su motivo. (b) La gráfica ofrece Paso y Forma
  pero **no Unidad**: agendas es la única unidad que cruza programas, así que el tercer interruptor del 370 sería un botón
  único. (c) Cada programa usa **su cohorte activa** para el cumplimiento y la tabla; el periodo es el común de `/hub`.
- **Retirado (N7):** `PautaRoas` ya no tiene parámetro `soloConteos`, se borró `OrigenPorPrograma` y el componente `Origen`.
  `PautaRoas` sigue exportado solo para `tests/roas-de-pauta.test.ts` y `detalleDeCampana`; sin llamador en pantalla.
- **Guardián de consultas por página:** `/hub?seccion=pauta` sube de 219 a **298** en el escenario de 3 programas. Por qué: el
  219 era el ROAS y el origen por programa (solo conteos); ahora cada programa trae su tabla semanal completa (~26 consultas
  cada uno, +79 en total). No hay consultas idénticas ni crecimiento con las filas (el guardián sigue en verde); crece con el
  número de programas, que es lo que `escalaConProgramas` declara. Las lecturas del cumplimiento corren dentro de su componente,
  como en el Hub de un programa, y no entran a esa cuenta.
- **Verificado:** typecheck, lint 0 errores, tests de la franja, páginas, consultas por página, ROAS, celdas y corte; `dev:local`
  como gerente con dos programas: franja con «Parcial» en Inversión, gráfica, cumplimiento y tabla de cada programa, explicación
  de Inversión con los programas sumados.
- **No verificado:** claro y 375 px, paid trafficker con alcance limitado, `npm run build`, `test:humo`, ni el clic en un punto de
  la gráfica (la semilla no tiene agendas de Paid).

## Lo que falta contra el boceto (18-nov, sesión de UI)

Todo: el ticket sigue en `todo` y `/hub?seccion=pauta` pinta solo `PautaRoas soloConteos` y `OrigenPorPrograma`
(`app/(app)/hub/pauta.tsx`). Falta la franja de totales sumables con moneda (DT-1), la tabla semanal y el cumplimiento por
programa lado a lado (DT-3), la gráfica de agendas diarias por programa (DT-2), la Cifra y su explicación en cada número, el
enlace a Origen y calidad de cada programa, el test de paridad con dos monedas y un programa sin gasto, y borrar
`soloConteos` y `OrigenPorPrograma`. El 420 ya está en `main`, así que ya no bloquea.
