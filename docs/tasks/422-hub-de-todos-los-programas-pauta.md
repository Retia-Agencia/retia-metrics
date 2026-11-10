---
id: 422
etapa: pauta
serves: "ADR 0048 (qué se suma en «todos») · ADR 0043 (el programa es frontera) · docs/paid-media-2026-11-09.md §6 («Todos los programas») · docs/diseno-cifra-y-pauta.md §6 y la fila X-4 · docs/audit-hub-2026-11-10.md §4.4 y D-C · ticket 412 (nota del 10-nov) · ADR 0115 (N1, N4, N7)"
depends: [419, 420]
status: todo
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

## Decisiones abiertas (las contesta Mani antes de construir)

| # | Pregunta | Recomendación | Por qué |
|---|---|---|---|
| DT-1 | ¿«Todos» lleva una franja de totales sumables arriba (inversión por moneda, agendadas de Paid, ventas, vendido en USD)? | Sí, con su moneda y sin tasas | Es lo que el ADR 0048 permite sumar y lo que pidió Gerencia para ver el conjunto; sin ella «todos» no suma nada |
| DT-2 | ¿Se incluye la gráfica de agendas diarias por programa con interruptores (X-4)? | Sí, como una línea por programa (cantidades) | Está dibujada en el boceto y «solo cantidades» respeta el 0048; usa la gráfica del 370, sin código nuevo de dibujo |
| DT-3 | ¿Cada programa en «todos» repite las dos vistas completas o solo Resultados (tabla semanal y cumplimiento) con un enlace a su Origen y calidad? | Resultados por programa, y Origen y calidad con enlace al Hub del programa | 4 programas × 9 bloques es una pantalla ilegible; el contrato de entendimiento pide poco texto y lo principal visible |

## Alcance (pendiente de DT-1 a DT-3)

1. **Sección Pauta de `/hub`** con la forma del 420: por programa, lado a lado, con el rótulo y el subtítulo del vocabulario, y la
   tabla semanal de cada programa (una por programa, §6 del 9-nov).
2. **Franja de totales** (si DT-1 = sí): solo magnitudes sumables en la misma unidad, con la guarda en el **tipo** (la función del
   agregado no admite una tasa; `lib/queries/vista-todos.ts`), y la moneda al lado de cada número.
3. **Cifra y explicación (419)** en cada cifra de «todos»: la explicación dice por programa, no combinada.
4. **Retirar `PautaRoas soloConteos` y `OrigenPorPrograma`** cuando queden cubiertos (N7: reemplazar es borrar).
5. **Paridad (N2):** cada total de «todos» es la suma de las cifras del Hub de cada programa (test con dos programas y monedas
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

- [ ] DT-1 a DT-3 contestadas por Mani y escritas aquí.
- [ ] `/hub` Pauta: la misma forma que el Hub de un programa, comparada lado a lado con el boceto en claro, oscuro y 375 px.
- [ ] Ninguna tasa, ROAS ni costo combinado entre programas; el tipo del agregado lo impide y hay un test que lo muerde.
- [ ] Test de paridad: total de «todos» = suma de los programas, con monedas distintas y un programa sin gasto.
- [ ] Rótulos solo del vocabulario; el subtítulo «solo Paid» y «todas las áreas» donde corresponda.
- [ ] `PautaRoas soloConteos` y `OrigenPorPrograma` borrados si quedaron sin llamador.
- [ ] Recorrido del gerente y del paid trafficker con alcance limitado; `npm run build`, `test:humo` y consola limpia.
