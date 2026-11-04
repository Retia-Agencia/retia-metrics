---
id: 371
etapa: hub
serves: "Weekly con Daniel Tovar del 3-nov (docs/hub.md §0, G-7, el norte) · ADR 0023, 0106 · 146, 147 · absorbe lo que le faltaba al 253"
depends: [352]
status: done
---

# 371 — "¿Vamos a llegar?": el bloque de metas que no tocan los filtros

Entrega del Hub a Gerencia, fase 1 (`docs/hub.md` §0). Es **el norte** del Hub, en palabras de Dani.

## Por qué

Daniel Tovar, weekly del 3-nov:

> "En el hub deberíamos ver siempre abajo una sección que no sea tocada por los filtros y que sea como comparando lo
> que llevamos versus la meta, tanto del mes como del cohorte, tanto en cupos como en dinero vendido."

> "Tienes que tener siempre presente, esto es el norte, hermano. Hay una meta por cumplir que es tanto por cupos como
> por plata, tanto por mes como por cohorte. (...) Hay cuatro unidades: cohorte, mes, que son periodos de tiempo, y
> unidades de medida, que son plata y cupos, y que se deberían ver en ambos periodos de tiempo."

Hoy (3-nov): las piezas existen pero repartidas y con los filtros encima: "Cohorte activa por programa" y "Meta del mes
por programa" en Hoy (`app/(app)/hub/secciones.tsx:140-155`), Metas del mes (`SeccionMetas`), la proyección del 253 y
las alertas del 147. Ninguna muestra las cuatro combinaciones juntas, y ninguna está en todas las pestañas.

## La matriz (2 × 2, siempre las cuatro)

|  | **Cupos** | **USD (Vendido)** |
|---|---|---|
| **Mes en curso** | llevamos · meta · % · faltan · esperado a hoy · por día hábil que queda | lo mismo en USD |
| **Cohorte activa** | llevamos · meta · % · faltan · esperado a hoy · por día hábil que queda · proyección al cierre | lo mismo en USD |

- **Llevamos** = ventas (función del 352) del mes o de la cohorte, en cupos o en Vendido.
- **Meta** en cupos: la de la cohorte y la del mes repartida por hábiles (146, `lib/queries/metas.ts`). En USD: cupos ×
  precio de la cohorte, **la regla que ya usa `metas.ts:194`** para el mes, ahora también para la cohorte. No se inventa
  una meta nueva ni se reparte entre closers (ADR 0023).
- **Esperado a hoy** y **por día hábil que queda**: la función única del 352 (`lib/dias-habiles.ts`, con su borde).
- **Proyección al cierre**: la del 253 (`calcularProyeccion`), con su ventana de ritmo a la vista.
- El color de cada celda: el de las alertas por persistencia del 147 (rojo, ámbar, verde), con los umbrales que ya
  están en Programa › Ventas.

## Alcance

1. **Un componente, `<VamosALlegar>`, al pie de las pestañas del Hub** (Comercial, Dinero, Pauta, Origen; en Hoy va en el
   lugar de las secciones 4 y 5 del reporte diario, 373) y
   de la vista "todos los programas" (una matriz por programa, lado a lado, nunca sumada: es una meta, ADR 0048).
   Título: "¿Vamos a llegar?". Subtítulo fijo: "Mes de noviembre y cohorte C3 · no cambia con los filtros".
2. **No lee los filtros**: recibe solo programa y hoy. El tipo de sus props no admite periodo, cohorte ni closer, para
   que no se pueda filtrar ni queriendo (el molde del comparativo del ADR 0023).
3. **Cada número abre su lista** (ventas del mes, ventas de la cohorte) y, para quien administra, el atajo a donde se
   configura la meta (310).
4. **Se borran las copias**: "Cohorte activa por programa" y "Meta del mes por programa" de Hoy, y la tabla de Metas del
   mes si queda sin propósito, porque la matriz las contiene. Lo que Hoy necesite del día (Cupos del día) se queda en
   Hoy. Antes de borrar, `grep` de llamadores (N7).
5. **Sin cohorte activa o sin meta**: la celda dice "Sin cohorte activa" o "Sin meta: configúrala en Programa › Ventas"
   (regla del vacío, N5), nunca 0 %.
6. **Lo que faltaba del 253**: recorrido con ventas sembradas que muestre proyección y requeridos con datos.

## Done cuando

- [x] Test: con filtros puestos en la URL (cohorte C2, periodo Mes pasado, un closer), la matriz da las mismas cifras (por construcción: `leerVamosALlegar` y las props de `<VamosALlegar>` solo admiten programa y hoy, `tests/vamos-a-llegar.test.ts`)
  que sin filtros.
- [x] Test: meta USD de la cohorte = meta cupos × precio de la cohorte; llevamos USD = Vendido de la cohorte (369).
- [x] Test: el último día hábil, "por día hábil que queda" da el faltante entero (borde del 352).
- [x] Test de tipo: pasarle un periodo a `<VamosALlegar>` no compila.
- [x] Recorrido en `dev:local` con ventas sembradas: la matriz al pie de las cinco pestañas y de "todos", escritorio y
  375 px.
- [x] El 253 queda `reemplazado` por este ticket en su archivo y en el tracker.
- [x] Regla N8: `docs/metricas.md` §2 (meta USD de la cohorte) y `docs/hub.md` §1 en el mismo commit.

## Cierre (4-nov)

- `lib/queries/vamos-a-llegar.ts` (cuenta pura `armarVamosALlegar` + `leerVamosALlegar`), `components/metas/vamos-a-llegar.tsx`.
  Montado al pie de las cinco pestañas del Hub de programa y de la vista de todos (una matriz por programa, sin sumar).
- Se borraron de Hoy-todos "Cohorte activa por programa" y "Meta del mes por programa" (sin llamadores, N7). **Se queda**
  `SeccionMetas` en Hoy de un programa: tiene lo que la matriz no (navegación a meses pasados, meta por cohorte,
  compensación de la semana); retirarla es decisión aparte.
- Proyección en USD: cupos que faltan × precio de la cohorte, la misma regla de la meta USD (supuesto nombrado en `metricas.md`).
- Color de cada celda: umbral de Programa › Ventas (147): rojo si la alerta está disparada, ámbar bajo el aceptable, verde si no.
