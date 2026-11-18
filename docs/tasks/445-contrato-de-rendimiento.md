---
id: 445
etapa: rendimiento
serves: "docs/estudio-rendimiento-y-conexion.md §8 · AGENTS.md › Contratos · decisión 2 de la §10"
depends: [435, 436, 437, 438, 439, 440, 441, 442, 443, 444]
status: en curso  # 17-nov: escrito lo que es real hoy (435, 437, 439, 440, 447, 438 parcial); faltan 438 (cierre), 441, 442, 443, 444 y el guardián n-mas-uno
---

# 445 — El contrato de rendimiento, escrito y vigilado

## Qué
Reunir en AGENTS.md › Contratos las reglas que dejaron los tickets 435 a 444, cada una con su guardián, y los dos
guardianes de código que faltan (N+1 y contar en memoria). Este ticket no optimiza nada: fija lo ganado para que una
pantalla nueva no lo pierda.

> **15-nov:** las filas "Cuánto cuesta un render" y "Una lectura, una vez por solicitud" se adelantan en el
> [447](./447-guardian-de-consultas-por-pagina.md), con las reglas de la clave y el guardián por página. Este ticket las
> cita cuando el 447 cierre; no las repite.
>
> **15-nov, 447:** las tres filas ("Dónde vive una consulta", "Una lectura, una vez por solicitud" y "Cuánto cuesta
> un render") ya están en AGENTS.md › Contratos; aquí solo se citan.

## Las filas (texto para AGENTS.md › Contratos; los números salen de los tickets cerrados, no de aquí)

| Contrato | Estándar / dónde vive | Cómo se enforza |
|---|---|---|
| Cómo se conecta la app a la base | Un pool de `pg` por proceso, en `lib/db/index.ts`, por el pooler en modo transaction; tamaño `MAX_CONEXIONES_POR_PROCESO`; nadie más crea un pool (ADR 0047 enmendado, 435) | `tests/conexion-pooler.test.ts` contra Postgres real en el CI; guardián de imports en `tests/base-portable.test.ts` |
| Presupuesto de conexiones | instancias × pool ≤ lo que admite el pooler; consultas simultáneas ≤ `Pool Size`. La cuenta con números vive en `docs/operations.md` (441) | Revisión cuando cambie el número de usuarios o el tamaño del cómputo; el olor es `ECHECKOUTTIMEOUT` o "too many clients" en los logs |
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

## Avance (17-nov)

Hecho, con evidencia:
- [x] `docs/agents/contratos.md` (que es donde vive AGENTS.md › Contratos): filas nuevas de **conexión (435)**, **fallar rápido (440)**,
      **consultar por conjunto (438, en curso)** y **contar en SQL (439)**, con los números medidos; las de 437 y 447
      ya estaban y no se repiten. Cada fila dice qué guardián existe y cuál falta.
- [x] `docs/contrato-metricas-y-datos.md` §8: los guardianes de rendimiento que existen pasaron a 🔒; los que faltan quedan
      como pendiente 4.
- [x] El estudio gana la §14 "Cerrado": antes y después por ruta (solo lo medido), ms y JavaScript (lo que no se midió, dicho),
      el inventario de las 31 secciones de página con su tope y las decisiones de la §10 respondidas.
- [x] Encabezado del estudio: ya no dice "sin plan aprobado".

**Falta, y de quién depende (no está marcado):**
- [ ] **438 cierre** (el PR 31 entró con las fases A y B1): tabla semanal de Pauta, `detallesPorCohorte`, Hub de todos
      por `program_id in (…)`, p95 de 30 peticiones. De él dependen el guardián `n-mas-uno` (sus excepciones se conocen al
      cerrar) y la fila "Consultar por conjunto" sin "en curso".
- [ ] **Guardián `tests/n-mas-uno-guardian.test.ts`** y el de `porPagina: Number.MAX_SAFE_INTEGER` / `jsonb` entero (depende del 438).
- [ ] **Fila "Presupuesto de conexiones"** (441, `todo`, sesión principal: la cuenta con números vive en `docs/operations.md`).
- [ ] **Fila "Qué precarga"** (442, código listo, falta medirlo en producción) y su guardián `enlace-guardian` (existe; falta el número).
- [ ] **Fila "Qué recibe el navegador"** (443, `todo`) y **"Qué se cachea"** (444, `todo`, depende además del 438).
- [ ] **Fila "Índices"**: sin ticket que la mida; se escribe con el primer `EXPLAIN` a 10×.
- [ ] Los cuatro cambios de texto de AGENTS.md: *Rendimiento y escala* (hechos medidos del 14-nov), *Feedback loops* (medir una
      pantalla y el bucle de conexión), *Agent skills 2e* y *Conventions*. Solo el de «el estudio ya no dice sin plan» está hecho.
- [ ] Inventario final con el medidor del 436 en producción (la tabla de la §14.3 es del guardián, no de Vercel).
- [ ] Checkpoint verde que incluya 435 a 444.
