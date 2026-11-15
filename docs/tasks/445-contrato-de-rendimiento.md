---
id: 445
etapa: rendimiento
serves: "docs/estudio-rendimiento-y-conexion.md §8 · AGENTS.md › Contratos · decisión 2 de la §10"
depends: [435, 436, 437, 438, 439, 440, 441, 442, 443, 444]
status: todo
---

# 445 — El contrato de rendimiento, escrito y vigilado

## Qué
Reunir en AGENTS.md › Contratos las reglas que dejaron los tickets 435 a 444, cada una con su guardián, y los dos
guardianes de código que faltan (N+1 y contar en memoria). Este ticket no optimiza nada: fija lo ganado para que una
pantalla nueva no lo pierda.

> **15-nov:** las filas "Cuánto cuesta un render" y "Una lectura, una vez por solicitud" se adelantan en el
> [447](./447-guardian-de-consultas-por-pagina.md), con las reglas de la clave y el guardián por página. Este ticket las
> cita cuando el 447 cierre; no las repite.

## Las filas (texto para AGENTS.md › Contratos; los números salen de los tickets cerrados, no de aquí)

| Contrato | Estándar / dónde vive | Cómo se enforza |
|---|---|---|
| Cómo se conecta la app a la base | Un pool de `pg` por proceso, en `lib/db/index.ts`, por el pooler en modo transaction; tamaño `MAX_CONEXIONES_POR_PROCESO`; nadie más crea un pool (ADR 0047 enmendado, 435) | `tests/conexion-pooler.test.ts` contra Postgres real en el CI; guardián de imports en `tests/base-portable.test.ts` |
| Presupuesto de conexiones | instancias × pool ≤ lo que admite el pooler; consultas simultáneas ≤ `Pool Size`. La cuenta con números vive en `docs/operations.md` (441) | Revisión cuando cambie el número de usuarios o el tamaño del cómputo; el olor es `ECHECKOUTTIMEOUT` o "too many clients" en los logs |
| Cuánto cuesta un render | Toda función de página tiene un tope de consultas en `tests/presupuesto-de-consultas.test.ts`; el tope solo baja. Una pantalla nueva agrega su fila en el mismo commit (436) | Ese test: tope, `identicas === 0`, y el mismo número de consultas con 3 y con 6 programas, fuentes, cohortes y closers |
| Una lectura, una vez por solicitud | `unaVezPorSolicitud` en `lib/db/por-solicitud.ts`, dentro de la función dueña del concepto; nunca en una transacción ni en una server action (437) | `tests/por-solicitud.test.ts` y `identicas === 0` del presupuesto |
| Consultar por conjunto | Ninguna consulta por elemento de una lista: se pasa la lista (`inArray`) o se agrupa en SQL (438, 439). El programa sigue siendo frontera: se agrupa por `program_id`, nunca se suma entre programas | `tests/n-mas-uno-guardian.test.ts` (abajo) y la prueba de 3 contra 6 |
| Contar en SQL | Una cifra que es un conteo no baja las filas; ninguna consulta de página selecciona una columna `jsonb` entera para contar o clasificar | `tests/n-mas-uno-guardian.test.ts` (`MAX_SAFE_INTEGER` como tamaño de página) y los tests de SQL emitido del 439 |
| Fallar rápido | `statement_timeout` de la app, espera de conexión y `maxDuration` por clase de ruta, con los números en `lib/tiempos.ts` (440) | `tests/tiempo-maximo-guardian.test.ts` |
| Qué precarga | Todo enlace interno es `<Enlace precarga="…">` (`components/enlace.tsx`): navegación sí, filas y tarjetas al pasar el cursor, filtros nunca (442) | `tests/enlace-guardian.test.ts` |
| Qué recibe el navegador | JavaScript de primera carga por ruta bajo su tope; `"use client"` en la hoja con estado; las gráficas se cargan diferidas desde `components/graficas/` (443) | `tests/peso-de-cliente.test.ts` en el job de build |
| Qué se cachea | Solo lecturas sin sesión y con invalidación explícita, con etiquetas en `lib/cache/`; cifras, bandejas, usuarios y membresías nunca (444) | `tests/cache-con-dueno.test.ts` |
| Índices | Justificados con `EXPLAIN` a 10× el volumen de hoy, como ya pide C-2; la migración la aplica la sesión principal | Revisión manual: un `Seq Scan` sobre una tabla caliente en una consulta de página es el olor |

Además, en AGENTS.md:
- **Restricciones › Rendimiento y escala:** reemplazar el párrafo del sync por los hechos medidos el 14-nov (las
  consultas tardan menos de 25 ms en la base; el costo es el número de idas y vueltas y los megas transferidos; el
  techo es el pool del pooler).
- **Feedback loops:** cómo medir una pantalla (`dev:local` y el medidor del 436) y el comando del bucle de conexión.
- **Agent skills, punto 2e:** el estudio deja de decir "sin plan aprobado" y apunta a los tickets 435 a 446.
- **Conventions:** "antes de agregar una consulta a una pantalla, mira su fila en el presupuesto".

## El guardián que falta: `tests/n-mas-uno-guardian.test.ts`
Lee el código como `tests/vigencia-centralizada.test.ts`, sobre `lib/`, `app/` y `components/`:

```ts
// 1. Una consulta dentro de una iteración asíncrona: `.map(async` … `db.` | `await <función de lib/queries>` adentro.
const ITERACION_CON_BASE = /\.map\(\s*async\b[^]*?\b(db|tx)\s*\.\s*(select|execute|query)\b/;
// 2. Traer todo para contar.
const TODO_PARA_CONTAR = /porPagina:\s*Number\.MAX_SAFE_INTEGER/;

const EXCEPCIONES: Record<string, string> = {
  // archivo → por qué es legítimo (p. ej. un cron que llama una API externa por cuenta, no la base)
};
```

Hoy hay 26 archivos con `.map(async`; no todos consultan la base. El test arranca con las excepciones que queden
**después** de 438 y 439, cada una con su razón, y se muerde en los dos sentidos (caza una fuente sintética mala y no
marca la solución con `inArray`). Una expresión regular no ve una consulta escondida en una función llamada desde el
bucle: por eso el contrato fuerte es la prueba de 3 contra 6 del presupuesto; este guardián es la alarma temprana.

## Done cuando
- [ ] Las filas de arriba en AGENTS.md › Contratos con los números reales de cada ticket cerrado, y los cuatro
      cambios de texto listados.
- [ ] `tests/n-mas-uno-guardian.test.ts` verde y mordido en los dos sentidos.
- [ ] `docs/contrato-metricas-y-datos.md`: los guardianes de rendimiento pasan de propuestos a existentes.
- [ ] El estudio (`docs/estudio-rendimiento-y-conexion.md`) gana una sección final "Cerrado": qué se midió antes y
      después por ruta (consultas, ms en Vercel, JavaScript), y sus decisiones de la §10 respondidas.
- [ ] Inventario final de las 37 páginas con el medidor del 436, pegado en el estudio; ninguna sobre su tope.
- [ ] Checkpoint verde que incluya los tickets 435 a 444; tracker y `status:` iguales (N9).
