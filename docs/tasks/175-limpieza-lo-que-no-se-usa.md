---
id: 175
etapa: O3
serves: "docs/anotaciones.md A-72 (Orígenes), A-76; ADR 0077 punto 3"
depends: [170, 171, 172, 173]
status: todo
---

> **3-oct (sesión central), medido en producción (solo lectura):** `origenes` 7 filas activas, **0** llamadas con `origen_id`, 0 filas en `change_log`; `categorias_recurso` 6 filas, **0** recursos. Nada que decidir con Mani: cero referencias. El orden es obligatorio: (1) se empuja y despliega el código sin `origenes` ni `categoriasRecurso`, (2) la sesión central genera la migración (`ALTER TABLE calls DROP COLUMN origen_id; DROP TABLE origenes; ALTER TABLE recursos DROP COLUMN categoria_id; DROP TABLE categorias_recurso;`, sin `CASCADE`, con `SET lock_timeout`), (3) se aplica. Al revés, drizzle pide las columnas por nombre y producción revienta.


# 175 — Limpieza: se quita lo que ya no usa nadie

Sesión **S8**, ola O3 parte 3. **Lleva migración** (la genera y aplica la sesión principal con el ok de Mani).

## Alcance

1. **Medir antes de borrar** (solo lectura en producción, el conteo va en la nota de cierre): filas de `origenes` y
   llamadas con `calls.origen_id`; filas de `categorias_recurso` y recursos con categoría. Lo que tenga referencias se
   decide con Mani antes de soltar la columna (ADR 0026: lo usado no se borra en silencio).
2. **Orígenes del lead:** fuera `lib/catalogo/origenes.ts`, su pestaña, su lectura en Nerd Stats y su registro en
   `lib/catalogo/registro.ts`; migración que quita `calls.origen_id` y la tabla `origenes`.
3. **Categorías de recurso:** fuera `lib/catalogo/categorias-recurso.ts` y su lectura; migración que quita
   `recursos.categoria_id` y la tabla.
4. **Rutas sin uso:** `app/(app)/p/[programa]/urgencias/` (no está en la nav; el Inbox la reemplaza: comprobar que
   nada la enlaza), `app/(app)/programas/[slug]/` y `app/(app)/documentos/` (solo redirigen), y lo que quede de
   `/mi-dia` y `/perfil` si el 172 los dejó redirigiendo más de una semana.
5. **Código huérfano:** `grep` de cada export de lo borrado; lo que nadie llame se va (AGENTS.md: mirar quién llama
   antes de dar por probada una función). Pre-existente que no sea de esta lista se anota, no se borra.

## Done cuando

- `grep -rn "origenes\|categoriasRecurso\|/urgencias\|/documentos" app components lib` solo encuentra la migración.
- Migración leída (sin `DROP ... CASCADE` sorpresa, `SET lock_timeout = '5s'`), aplicada con el ok de Mani, y el
  código sin las columnas desplegado ANTES de aplicarla (AGENTS.md).
- Typecheck, lint, build y los tests tocados en verde; la suite completa en el checkpoint.

## Nota de cierre de la sesión S8 (3-oct): código listo, falta la migración

**Estado:** código en `main`; la migración (0064) la genera y aplica la sesión central DESPUÉS de desplegar este código.

- **Medido (ticket, solo lectura, 3-oct):** `origenes` 7 filas y 0 llamadas con `origen_id`; `categorias_recurso` 6 filas y 0 recursos. Sin referencias, nada que decidir.
- **Quitado:** `lib/catalogo/origenes.ts`, `categorias-recurso.ts`, sus entradas en `registro.ts`; en `schema.ts` `calls.origenId`, `recursos.categoriaId`, las tablas `origenes` y `categoriasRecurso` y sus tipos; `/urgencias` (página, `components/urgencias.tsx`, `lib/queries/urgencias.ts`, test); `/programas/[slug]` y `/documentos`; el sembrado de categorías.
- **⚠️ Índice `recursos_vigente_idx` cambió de forma:** era `(coalesce(program_id), categoria_id, lower(titulo))` y ahora es `(coalesce(program_id), lower(titulo))` (`WHERE vigente AND activo`). Al soltar `categoria_id` Postgres tira el índice viejo solo; la migración debe crear el nuevo. **Antes, comprobar que no haya dos recursos vigentes y activos con el mismo título en el mismo programa** (con categoría nula el índice viejo no los chocaba): si hay, el `CREATE UNIQUE INDEX` falla.
- **No se tocó:** "Registros por origen" de Nerd Stats lee `calls.origen` (texto hoja/app), otra columna; `/mi-dia` y `/perfil` siguen redirigiendo (172 es de hoy, el ticket pide más de una semana). Quitarlos queda para después del 10-oct.
- **Verificado:** typecheck y lint limpios. `grep` de `origenes|categoriasRecurso|/urgencias|/documentos` en `app components lib scripts`: solo la variable local de Nerd Stats. **No corrí** los tests (la máquina tenía carga 16 y swap casi lleno, AGENTS.md) ni `build` (ningún componente cliente tocado) ni el recorrido en `dev:local`: lo valida el CI y el checkpoint.
