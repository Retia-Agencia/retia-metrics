---
id: 439
etapa: rendimiento
serves: "docs/estudio-rendimiento-y-conexion.md §6.2, §13.2 y §13.4 · 504 de /programa, /api/salud/* y Nerd Stats"
depends: [436]
status: todo
---

# 439 — Salud de fuentes y Nerd Stats cuentan en SQL

## Qué
`saludDeFuentes` (`lib/queries/salud-fuentes.ts:141`) y `conteosPorPrograma` (`lib/queries/nerd-stats.ts:30`) dejan
de hacer una consulta por fuente o por programa y de bajar filas completas para contarlas en memoria.

## Por qué (producción, 14-nov; estudio §13.2)
- `saludDeFuentes`: 29 consultas. La llaman 8 lugares, entre ellos `/p/[programa]/programa`, `/ajustes/salud`,
  `/api/salud/alertas`, `/api/salud/cierre`, `/api/semaforo/envios` y Mi espacio: es el factor común de todos los 504.
- Cuatro de sus consultas son `select lead_id, respuestas from submissions … where program_id = $1`, **una por
  programa**, 800 a 900 ms cada una desde local: bajan el JSON de respuestas (5,96 MB en total) para contar.
- Otra trae los UTM **y `respuestas`** de todos los envíos de 24 h para clasificarlos en memoria.
- Una consulta que baja megas retiene una conexión del pooler mientras transfiere: bajo carga agotó el pool
  (`ECHECKOUTTIMEOUT`, estudio §13.4).
- `conteosPorPrograma`: 19 consultas; llama `posiblesDuplicadosDelPrograma` con `porPagina: Number.MAX_SAFE_INTEGER`
  por cada programa (`lib/queries/nerd-stats.ts:84`).

## Archivos
`lib/queries/salud-fuentes.ts` · `lib/queries/nerd-stats.ts` · `lib/queries/leads.ts` (`posiblesDuplicadosDelPrograma`,
:407) · `lib/calendly/reconciliar.ts` (`alarmasCalendly`, :38) · `lib/pauta/arbol.ts` · el módulo dueño de la consulta
de `respuestas` (búscalo con el medidor: es el que emite `select "submissions"."lead_id", "submissions"."respuestas"`) ·
`tests/salud-fuentes*.test.ts` · `tests/presupuesto-de-consultas.test.ts`.

## Cómo

**a) Penúltimo envío: una consulta para todas las fuentes** (hoy una por fuente, `salud-fuentes.ts:209`):

```ts
const ordenados = db.$with("ordenados").as(
  db.select({
    sourceId: submissions.sourceId,
    createdAt: submissions.createdAt,
    puesto: sql<number>`row_number() over (partition by ${submissions.sourceId} order by ${submissions.createdAt} desc)`.as("puesto"),
  }).from(submissions),
);
const dosUltimos = await db.with(ordenados)
  .select({ sourceId: ordenados.sourceId, createdAt: ordenados.createdAt, puesto: ordenados.puesto })
  .from(ordenados).where(lte(ordenados.puesto, 2));
```

⚠️ El penúltimo de hoy es `max(created_at) where created_at < ultimo`: si dos envíos comparten el instante del último,
`row_number` da otro resultado. Usa `dense_rank()` sobre `created_at` para conservar la semántica, y cúbrelo con un
test (dos envíos en el mismo instante). ⚠️ AGENTS.md: una TABLA dentro de una plantilla `sql` descalifica las
columnas; aquí solo van columnas. Imprime `.toSQL().sql` y compruébalo.

**b) `alarmasCalendly` y `arbolDePauta`: una llamada para todos los programas.** Agrega la variante por conjunto
(`alarmasCalendlyDe(db, programIds, ahora)`: `where program_id in (…) group by program_id`) y que la de un programa
la llame con una lista de uno. El árbol se memoiza por solicitud con el helper del 437.

**c) Los envíos recientes no traen `respuestas`.** La traza solo necesita los UTM y el `fbclid`. Mira
`columnasUtmDelEnvio` y `utmsDelEnvio` (`lib/atribucion/`): si el `fbclid` sale de `respuestas`, extráelo en SQL
(`respuestas->>'fbclid'`, con la llave real) en vez de bajar el objeto. El significado de cada UTM sigue decidiéndolo
`emparejar` (contrato de AGENTS.md): solo cambia qué columnas viajan.

**d) La consulta de `respuestas` por programa:** identifica qué se cuenta con ese JSON y exprésalo en SQL con el
operador de jsonb que corresponda, agrupado por programa en una sola consulta. Si lo que hace falta es un campo, pide
el campo; nunca el objeto.

**e) Duplicados como conteo.** En `lib/queries/leads.ts`, junto a `posiblesDuplicadosDelPrograma`, exporta el conteo
con **el mismo predicado** (N1: el predicado es del módulo, la proyección del llamador):

```ts
/** Cuántos leads tienen un posible duplicado, por programa. Misma condición que la lista; una consulta. */
export async function leadsConPosibleDuplicado(db: Db, programIds: string[]): Promise<Map<string, number>> {
  const filas = await db
    .select({ programId: leads.programId, n: sql<number>`count(distinct ${leads.id})::int` })
    .from(/* el mismo from y joins de la lista, extraídos a una función privada compartida */)
    .where(and(inArray(leads.programId, programIds), /* el mismo predicado */))
    .groupBy(leads.programId);
  return new Map(filas.map((f) => [f.programId, f.n]));
}
```

Y `conteosPorPrograma` la usa en lugar del `lista.map(async …)` de `nerd-stats.ts:84`.

**f) Índice de `entregas_webhook`:** 10.953 `seq_scan` contra 120 `idx_scan`. Mira qué consulta la recorre
(`lib/queries/entregas-webhook.ts`) y propón el índice con su `EXPLAIN`; **la migración la genera y aplica la sesión
principal**, no tú (AGENTS.md). Deja el SQL propuesto en este ticket.

## Guardián
- Paridad (N2): por cada pieza, un test compara la salida vieja y la nueva sobre la misma siembra (incluye el empate
  de instantes y un programa sin envíos).
- Presupuesto (436): `saludDeFuentes` ≤ 8 consultas y `conteosPorPrograma` ≤ 6, **iguales con 3 y con 6 programas y
  fuentes**.
- `Number.MAX_SAFE_INTEGER` como `porPagina` queda prohibido (lo caza el guardián del 445).

## Done cuando
- [ ] `/nerd-stats` ≤ 15 consultas (hoy 52 en producción); `saludDeFuentes` ≤ 8 (hoy 29).
- [ ] Ninguna consulta de estas funciones selecciona `respuestas` completa (test sobre el SQL emitido).
- [ ] Contra producción, solo lectura, las 5 funciones de Nerd Stats en serie: ≤ 2 s desde local (hoy ~6 s). Lo
      corre la sesión principal.
- [ ] Las alarmas de `/api/salud/alertas` y el semáforo dan lo mismo antes y después (tests de sus contratos verdes).
- [ ] Typecheck, lint, tests del cambio, build; tracker y `status:` iguales.
