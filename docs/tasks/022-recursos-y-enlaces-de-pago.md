---
id: 022
fase: F3
serves: "ADR 0017; spec §5 criterio 6"
depends: [011, 017]
status: done
---

# 022 — Tablas de recursos y enlaces de pago

## Objetivo
La base guarda los links del equipo con su programa, categoría, versión vigente e historial.

## Alcance
- Dentro: tabla `recursos` (`programId` nullable = global, `categoria`, `titulo`, `url`,
  `vigente`, `reemplazaA` nullable, `activo`, `createdAt`). `categoria` es un catálogo más
  (`categorias_recurso`, semilla: Brochure, Página web, Guion, Formulario, Calendly, Drive) sobre
  el molde.
- Dentro: tabla `enlaces_pago` (`programId`, `productoId` nullable, `plataformaId`, `monto`,
  `moneda`, `url`, `vigente`, `activo`, `createdAt`).
- Dentro: `lib/catalogo/recursos.ts` y `lib/catalogo/enlaces-pago.ts`. Operación extra
  `reemplazar(id, nuevaUrl)`: crea la fila nueva vigente y marca la anterior no vigente.
- Dentro: zod exige `https://`.
- Dentro: semilla con los 5 links de PayPal de Comunicarte publicados en el grupo el 8-sep
  (797, 697, 400, 300, 200 USD), cargada desde un script que lee de variables o de un archivo
  fuera del repo, no escrita en código.
- Fuera: la pantalla (023).

## Done cuando
- [x] Reemplazar un brochure deja una sola versión vigente por (programa, categoría, título).
- [x] Tests de reemplazo e historial.

## Notas de cierre (17-sep)

**Un recurso global tiene `programId` NULL y Postgres considera dos NULL como DISTINTOS**, así que
un índice único ingenuo habría dejado pasar dos recursos globales vigentes con el mismo título, que
es justo lo que el "Done cuando" prohíbe. `nullsNotDistinct` no existe en drizzle 0.45 (verificado),
así que el índice va sobre `coalesce(program_id, <uuid de ceros>)` y es PARCIAL: solo compiten las
filas vigentes y activas, para que el historial no ocupe cupo.

**El orden de las dos escrituras de `reemplazar` no es opcional:** primero el UPDATE que baja la
vigente anterior (libera el cupo del índice), después el INSERT de la nueva. Al revés, Postgres
rechaza con un `23505` que parece aleatorio. Vive en `lib/catalogo/versionar.ts`, compartido por las
dos entidades (ADR 0024).

**`vigente` y `activo` son distintos:** `vigente` marca la versión de hoy entre el historial;
`activo` es el borrado suave del molde. Una versión reemplazada queda `vigente = false` pero
`activo = true`: sigue ahí, que es el punto del ADR 0017.

**Los 5 enlaces de PayPal NO están cargados.** `scripts/cargar-enlaces-pago.ts` los lee de
`ENLACES_PAGO_JSON` (ruta a un archivo fuera del repo) y falla con mensaje explícito si no está
configurada. Ningún link real ni placeholder vive en el repo. Cargarlos es una tarea de Mani.
