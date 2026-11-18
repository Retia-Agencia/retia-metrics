---
id: 438
etapa: rendimiento
serves: "docs/estudio-rendimiento-y-conexion.md §13.3 (N+1 del Hub) · C-2 (docs/hub.md §8) · contrato de rendimiento"
depends: [437]
status: en curso  # 17-nov: fases A y B1 en el PR 31; faltan Pauta (tabla semanal), Dinero/Hoy, el Hub de todos y las mediciones de p95
---

# 438 — El Hub consulta por conjunto, no por elemento

## Qué
Quitar los patrones "una consulta por cohorte, por closer, por semana, por campaña o por deal" del Hub (todos y por
programa) y de `/hub/reporte`. Después del 437 quedan las consultas con parámetros distintos: esas son este ticket.

## Por qué (medido el 14-nov, base local con 3 programas; estudio §13.3)
| Ruta | Consultas | N+1 |
|---|---:|---:|
| `/p/[programa]/hub?seccion=pauta` | 846 | **219** |
| `/hub?seccion=comercial` | 278 | 90 |
| `/hub` | 286 | 78 |
| `/hub?seccion=pauta` | 202 | 69 |
| `/hub?seccion=dinero` | 154 | 52 |
| `/p/[programa]/hub?seccion=comercial` | 234 | 42 |

Con 30 personas abriendo Hub › Pauta a la vez, el servidor local tardó 18 s (0,7 s una sola): crece lineal porque
25.000 consultas hacen fila en el pool. En producción cada consulta suma además una ida y vuelta de red.

Firmas vistas en el registro (sentencia y veces por render):
- `select "deal_id","moneda",sum("monto") … from "abonos" where "deal_id" in ($1)` ×18 y
  `select "id","valor_vendido_usd" from "deals" where "id" in ($1)` ×18: `saldosDeDeals` (`lib/queries/saldo.ts`)
  llamada **con un deal a la vez** desde un bucle. La función ya acepta una lista.
- `select ("created_at" AT TIME ZONE 'America/Bogota')::date, count(*) from "calls" where program_id = $1 …` ×12: una
  serie por closer o por tipo.
- `select null::text, … min(coalesce("users"."closer_id", …))` ×12 y la de comisión
  (`deals left join users … comision_porcentaje`) ×8 a ×10: una por closer o por cohorte.
- En el Hub de todos, `Promise.all(programas.map(async …))` en `app/(app)/hub/page.tsx`, `secciones.tsx`, `pauta.tsx`
  y `lib/queries/vista-todos.ts`, `escalera-todos.ts`: correcto por la frontera de programa (ADR 0043), pero cada
  programa repite el árbol entero de consultas.

## Archivos (mapa de dónde está el olor: `.map(async` con base adentro)
`app/(app)/p/[programa]/hub/page.tsx` (788 líneas) · `app/(app)/hub/page.tsx`, `secciones.tsx`, `pauta.tsx` ·
`app/(app)/hub/reporte/page.tsx` · `components/pauta/tabla-semanal.tsx` · `lib/queries/dashboard.ts`,
`vista-metrica.ts`, `metricas-con-filas.ts`, `vista-todos.ts`, `escalera-todos.ts`, `hechos/pauta-semanal.ts`,
`roas-de-pauta.ts`, `comision.ts`, `saldo.ts` · `tests/presupuesto-de-consultas.test.ts`.

## Cómo
Tres moldes, en este orden de preferencia:

**1. Pasar la lista entera a la función que ya la acepta.**

```ts
// antes: un viaje por deal
const saldos = await Promise.all(deals.map((d) => saldosDeDeals(db, [d.id])));
// después: un viaje
const saldos = await saldosDeDeals(db, deals.map((d) => d.id));
```

**2. Agrupar en SQL por la dimensión, en vez de una consulta por valor** (es el contrato C-2: una métrica es una
agregación sobre un hecho, agrupada por una lista blanca de dimensiones).

```ts
// antes: una serie por closer
const series = await Promise.all(closers.map((c) => serieDeLlamadas(db, programId, rango, c.id)));
// después: una consulta agrupada, repartida en memoria
const filas = await db
  .select({ closer: calls.closerUserId, dia: diaBogota(calls.createdAt), n: sql<number>`count(*)::int` })
  .from(calls)
  .where(and(eq(calls.programId, programId), vigente(calls), enRango(calls.createdAt, rango)))
  .groupBy(calls.closerUserId, diaBogota(calls.createdAt));
const porCloser = Map.groupBy(filas, (f) => f.closer);
```

El predicado (`vigente`, ancla de fecha, qué es una venta) sigue saliendo de su módulo (N1): cambia la forma de la
consulta, no la definición. Si la función por elemento tiene llamadores que sí necesitan un solo elemento, deja la
versión por conjunto como la de verdad y que la de un elemento la llame con una lista de uno.

**3. Varios programas: una consulta con `program_id in (…)` y `group by program_id`**, repartida por programa en
memoria. La frontera de programa se conserva porque **ninguna cifra cruza**: se agrupa por programa en SQL y cada
programa recibe solo sus filas. Aplica a conteos, caja y gasto del Hub de todos (ADR 0048). Las tasas siguen
calculándose por programa a partir de sus propios conteos.

No cambies qué muestra ninguna pantalla ni ninguna definición de `docs/metricas.md`.

## Guardián
- Topes nuevos en `tests/presupuesto-de-consultas.test.ts`, y la prueba de 3 contra 6 programas, cohortes y closers:
  el número de consultas de cada función del Hub **no crece** con el número de elementos.
- Paridad (N2): por cada función reescrita, un test compara la salida vieja contra la nueva sobre la misma siembra
  antes de borrar la vieja (N7: reemplazar es borrar).

## Done cuando
- [ ] Topes, medidos con el 436 en `dev:local` y fijados en el test (pegar la tabla aquí):
      Hub › Pauta de un programa ≤ 60 consultas · las demás secciones del Hub ≤ 40 · Hub de todos ≤ 40 + 10 por
      programa. Si un tope no se alcanza, se escribe por qué y cuál consulta lo impide.
- [ ] 30 peticiones concurrentes a Hub › Pauta contra `next start` y la base local: p95 ≤ 3 s (hoy 18 s).
- [ ] Las cifras del Hub son idénticas antes y después (tests de paridad y comparación visual de un programa en
      `dev:local`, en claro y oscuro).
- [ ] `docs/metricas.md` sin cambios de definición; si cambió el nombre de una función citada ahí, se actualiza.
- [ ] `/p/[programa]/hub` entra a `PAGINAS` en `tests/consultas-por-pagina.test.ts` (con cargador compartido) y `PENDIENTES_447` queda vacía; con eso el 447 pasa a `done`.
- [ ] Typecheck, lint, tests del cambio, build; tracker y `status:` iguales.

## Nota para quien implementa
Es el ticket más grande del frente. Pártelo por sección (Pauta, Comercial, Dinero, Hoy, Todos) y entrega cada una con
su medición antes y después; no reescribas dos secciones en el mismo commit.

## Avance (17-nov, PR 31)
Hecho, con evidencia del CI:
- **Fase A.** El Hub de un programa lee por `lib/hub-programa/cargar-datos.ts` (`cargarDatosDelHubDelPrograma`); la página conserva el JSX, la guarda y los `Suspense`, y `SeccionPauta` sigue leyendo dentro de su componente. Las cuatro secciones entraron a `PAGINAS` con topes exactos medidos en el CI (3 programas sembrados): Hoy 66, Comercial 82, Pauta 22, Dinero 55. `PENDIENTES_447` quedó vacía.
- **Guardián de variedad.** `tests/consultas-por-pagina.test.ts` siembra closers, cohortes y campañas de más y exige el mismo número de consultas con 1 y con 4 (y 0 idénticas), y dice qué sentencias crecen. Se compara 1 contra 4 porque una página vacía salta ramas (listas sin filas no consultan): contra 0 daba +6 que no eran N+1.
- **B1 (Comercial).** `detallesDelComparativo` y el dinero por closer (`dineroPorCloserDelRango`) leen una vez para todos los closers y reparten en memoria por la identidad central de closer. Medido antes de B1: 82 consultas con 0 closers extra y 107 con 4 (+25, unas 6 por closer). Paridad celda a celda y dinero por closer en `tests/comparativo-por-conjunto.test.ts` (con anulado, otro programa, identidad histórica y dos monedas). `personasDeDeals` pasó a una lectura por solicitud y conjunto de ids (dos listas de evidencia pedían los mismos deals).

Falta (no marcado):
- Pauta: `components/pauta/tabla-semanal.tsx` y `lib/queries/hechos/pauta-semanal.ts` leen desde el componente, así que el guardián no los ve (el tope de Pauta 22 no incluye la tabla). Hay que llevar esa lectura a una función de `lib/` por conjunto (métricas × semanas) y meterla al cargador.
- `detallesPorCohorte` (Dinero) y los `listaDeMetrica` de evidencia.
- Hub de todos (`hub-todos.ts`, `vista-todos.ts`, `escalera-todos.ts`): una consulta con `program_id in (…)`.
- Topes del ticket (Pauta ≤ 60, demás ≤ 40, todos ≤ 40 + 10 por programa), p95 de 30 peticiones concurrentes y comparación visual: sin medir.
- `dineroDelRango` por closer sigue existiendo solo como referencia de la prueba de paridad (N7: borrar cuando el 438 cierre).
