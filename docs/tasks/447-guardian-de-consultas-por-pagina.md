---
id: 447
etapa: rendimiento
serves: "docs/estudio-rendimiento-y-conexion.md §8.2 · ticket 445 (adelanta sus filas de consultas) · AGENTS.md › Contratos"
depends: [437]
status: en curso
---

# 447 — Una página no repite una consulta: contrato escrito y guardián por página

## Qué
Adelantar del 445 la parte de consultas, sin esperar a que cierren 438 a 444: (1) las filas de AGENTS.md › Contratos
sobre dónde vive una consulta, una lectura por solicitud y el presupuesto por render, con las dos reglas de la clave que
salieron del 437; (2) un guardián que mide **la página entera** con la memoria por solicitud **activa**, para que una
consulta repetida falle en el CI y no se descubra midiendo a mano.

## Por qué (hallazgos del 15-nov, ticket 437)
- El 437 dejó 0 idénticas en todas las rutas del estudio, pero **las encontré midiendo a mano** en `dev:local`. Ningún
  test las habría visto, por dos razones:
  1. `tests/presupuesto-de-consultas.test.ts` (436) mide 6 **funciones** sueltas. Todas las idénticas de hoy salían de
     la **composición**: dos partes de una página pidiendo lo mismo con argumentos distintos.
  2. Corre contra PGlite, y ahí `unaVezPorSolicitud` lee directo (`esLaBaseDeLaApp` es falso para la base de prueba,
     `lib/db/por-solicitud.ts`). En el test la memoria nunca está activa: no prueba que memoice ni que la clave esté bien.
- Las cuatro clases de repetición que aparecieron, para que el guardián las cace con un caso cada una:
  - **Dos caminos que arman lo mismo:** `/hub` (Hoy) arma el dashboard de cada programa desde `armarVistaDeTodos` y
    desde el reporte diario (`armarVistaDeHoy`), con distinto `ahora`. Lo que no depende del instante se repetía.
  - **Clave con campos que no deciden la consulta:** `detalleDeCifra` pasaba `origen`, `periodo` y `slug` a
    `leerMetrica`; la misma lectura entraba con dos claves. Era la mitad de las idénticas de Comercial.
  - **Clave con dos formas del mismo valor:** en Mi espacio `q` llegaba `""` en un llamador y `undefined` en otro.
  - **Una lectura sin programa ejecutada por programa:** `ventasConDiaEn` del mes, una vez por programa dentro de
    `leerCohortesYVentas`.
- Cero idénticas no es eficiencia: `/hub` sigue en 147 consultas y Pauta de un programa en 322. Lo que pesa ahí es el
  N+1 (438), el pool (441) y la caché (444). Este ticket fija el piso; no lo baja.

## Las reglas (texto para AGENTS.md › Contratos)
| Contrato | Estándar / dónde vive | Cómo se enforza |
|---|---|---|
| Dónde vive una consulta | `lib/queries/hechos/` o el módulo de su concepto (`docs/contrato-metricas-y-datos.md`, C-2); nunca en una página, un componente, `lib/mcp/` ni un script | Revisión manual (ya escrita en el contrato de métricas) |
| Una lectura, una vez por solicitud | `unaVezPorSolicitud` dentro de la función dueña, nunca en la página. **La clave se arma solo con los campos que deciden la consulta** (lista blanca exhaustiva contra el tipo, molde `CAMPOS_DE_LA_CLAVE` de `lib/queries/metricas-con-filas.ts`) **y con una sola forma por valor** (`q ?? ""`, `null` y no `undefined`). Lo que no depende de `ahora` se separa en su propia lectura para poder compartirse (molde `cajaPorCloser` en `lib/queries/dashboard.ts`). El valor memoizado no se muta | `tests/por-solicitud.test.ts` y el guardián de abajo |
| Cuánto cuesta un render | Toda página tiene su fila en el presupuesto, con tope de consultas que solo baja e `identicas === 0`; una página nueva entra con su fila en el mismo commit | El guardián de abajo |

## El guardián: el presupuesto mide páginas, con la memoria activa
- Un helper de test que abre un **alcance de solicitud** (un `Map` nuevo por corrida) y crea un `unaVezPorSolicitud`
  que acepta la base de prueba: la fábrica `crearUnaVezPorSolicitud` ya permite inyectar `esLaBaseDeLaApp`,
  `obtenerMemoria` y `esEscritura`. Hay que decidir cómo lo usan los módulos en el test sin tocar su firma (opciones:
  un `vi.mock` de `@/lib/db/por-solicitud` en el archivo del guardián, o que el módulo lea la memoria de un
  `AsyncLocalStorage` que el test abre). Medir antes de elegir; la segunda sirve también fuera de React.
- Por cada página de la tabla del estudio (§13.3) la **misma composición que su `page.tsx`**: si la página llama dos
  cargadores en paralelo, el test también. Para no duplicar la composición, extraer de cada página un cargador de datos
  puro (`cargarDatosDeHub(...)`) que la página y el test importan; sin eso el test se desfasa de la página.
- Asserts: `identicas === 0`, consultas ≤ tope, y el mismo número de consultas con 3 que con 6 programas (la prueba de
  N+1 del 445).
- Morderlo en los dos sentidos con los cuatro casos de arriba: revertir cada arreglo del 437 en una fuente sintética
  debe hacerlo fallar.

## Método para medir a mano (mientras el 436 no imprima en dev:local)
`npm run dev:local` en un puerto libre (`PORT=3437`), login local por `POST /api/auth/callback/credentials` con
`dev@retia.local` (closer: `carlos.closer@retia.local`), una petición de calentamiento, y contar las sentencias de
`docker logs retia-metrics-db-local` desde una marca de tiempo (la base local trae `log_statement=all`). Idéntica =
mismo SQL y mismos parámetros. Para hallar el dueño: un `console.log` temporal con la clave y la pila dentro de la
función sospechosa.

## Done cuando
- [ ] Las tres filas en AGENTS.md › Contratos; el 445 las cita en vez de repetirlas.
- [ ] El guardián corre las páginas del estudio §13.3 con la memoria activa, verde, y mordido con los cuatro casos.
- [ ] Topes por página tomados de la medición del 437 (tabla en `docs/tasks/437-una-lectura-por-solicitud.md`).
- [ ] Typecheck, lint, tests del cambio; tracker y `status:` iguales (N9).
