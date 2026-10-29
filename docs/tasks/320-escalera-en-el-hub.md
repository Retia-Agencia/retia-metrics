---
id: 320
etapa: media
serves: "propuesta.md §3.1 (qué porción cierra en la llamada y cuál por seguimiento) y §3.5"
depends: [319]
status: done
---

# 320 — Las ventas por escalón en el Hub

## Alcance

- Una tarjeta en el Hub de un programa: deals por escalón en el periodo, con número y porcentaje, y días medianos de
  la cita al primer abono en los escalones 2 y 3. Cada cifra abre su lista (ADR 0067).
- Por programa siempre; en "todos los programas", lado a lado (es una distribución, ADR 0048).
- Se abre por closer y por calidad (propuesta §3.6 punto 3), con las dimensiones que ya tiene el Hub.
- Gráfica, si la hay, por `components/graficas/` (ADR 0091).

## Done cuando

- La cifra contra todas las páginas de su lista (`tests/metricas-con-filas.test.ts`).
- Recorrido local con gerente y closer, escritorio y 375 px; humo verde.

## Avance (28-oct, sesión carril M)

**Hecho:** tarjeta «Ventas por escalón» en Hub › Comercial (`components/dashboard/escalera.tsx`, vista en
`lib/queries/vista-escalera.ts`): número, %, días hábiles medianos, cambio contra B si hay comparación, y las mismas
filas por closer y por calidad. Cada cifra abre su resumen y su lista (`metrica=escalera&escalon=&calidad=&closer=` en
`hub/lista`). Sin equipo comercial (paid trafficker) no hay closers ni listas. Sin gráfica: una tabla; si se pide una,
va por `components/graficas/` (ADR 0091). Tests en `tests/escalera.test.ts` (320): cada cifra contra todas las páginas
de su lista, por closer, sin equipo, escalón inexistente y comparación.

**Falta:** el recorrido local con gerente y closer en escritorio y 375 px, y el humo (`npm run test:humo`), que piden la
base local (`db:local`) con la 0105 aplicada. La vista «todos los programas» (Hub de todos › Comercial) se construyó el 28-oct: una tarjeta por programa, lado a lado,
sin total (`lib/queries/escalera-todos.ts`).
