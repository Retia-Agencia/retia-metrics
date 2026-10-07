# Auditoría técnica (redundancia, acoplamiento, escalabilidad y sostenibilidad)

Fecha: 2026-10-07  
Alcance: revisión estática (sin cambios funcionales en código productivo).

## Resumen ejecutivo

El sistema ya tiene buenas bases de centralización en `lib/` y contratos fuertes, pero hay oportunidades claras para reducir duplicación en la capa `app/`, bajar acoplamiento entre UI y parsing de URL, y mejorar escalabilidad en consultas que hoy cargan y filtran en memoria.

## Hallazgos y mejoras propuestas

## 1) Redundancia

### R1. Helper duplicado para leer query params (`uno`)
- Evidencia:
  - `/home/runner/work/retia-metrics/retia-metrics/app/(app)/p/[programa]/inbox/page.tsx:34`
  - `/home/runner/work/retia-metrics/retia-metrics/app/(app)/p/[programa]/calls/page.tsx:41`
  - `/home/runner/work/retia-metrics/retia-metrics/app/(app)/p/[programa]/students/page.tsx:28`
  - `/home/runner/work/retia-metrics/retia-metrics/app/(app)/p/[programa]/programa/page.tsx:45`
  - `/home/runner/work/retia-metrics/retia-metrics/app/(app)/mi-espacio/page.tsx:35`
  - `/home/runner/work/retia-metrics/retia-metrics/app/(app)/p/[programa]/leads/page.tsx:41`
- Riesgo: divergencia futura en parsing y más costo de mantenimiento.
- Mejora: centralizar en un único helper server-side para `searchParams`.

### R2. Construcción manual repetida de query strings
- Evidencia:
  - `/home/runner/work/retia-metrics/retia-metrics/app/(app)/p/[programa]/leads/page.tsx:106-116`
  - `/home/runner/work/retia-metrics/retia-metrics/app/(app)/p/[programa]/calls/page.tsx:74-84`
  - Existe util central para cliente: `/home/runner/work/retia-metrics/retia-metrics/components/filtros/query.ts:1-14`
- Riesgo: cambios de comportamiento en un listado y no en otro.
- Mejora: crear versión compartida reutilizable también en server components.

### R3. Catálogo de resultados de llamadas duplicado
- Evidencia:
  - Definido en page: `/home/runner/work/retia-metrics/retia-metrics/app/(app)/p/[programa]/calls/page.tsx:30-39`
  - Ya existe fuente de verdad de etiquetas: `/home/runner/work/retia-metrics/retia-metrics/lib/deals/estado-de-llamada.ts:6-15`
- Riesgo: inconsistencias de label/orden entre pantallas.
- Mejora: exponer una constante única de opciones para filtros UI.

## 2) Acoplamiento (low coupling)

### C1. Páginas con mezcla de responsabilidades (acceso + parsing + mapeo + paginación)
- Evidencia (ejemplo):
  - `/home/runner/work/retia-metrics/retia-metrics/app/(app)/p/[programa]/leads/page.tsx` (guardas, parsing, construcción de URLs, paginación, mapping UI en un solo archivo)
  - `/home/runner/work/retia-metrics/retia-metrics/app/(app)/p/[programa]/calls/page.tsx` (patrón similar)
- Riesgo: cambios de una regla de filtro impactan varias capas y archivos.
- Mejora: extraer “bridges” por dominio (ej. `lib/listas/leads`, `lib/listas/calls`) para dejar la página como orquestador delgado.

### C2. Lógica de permisos compuesta inline cuando ya existe semántica de dominio
- Evidencia:
  - Inline: `/home/runner/work/retia-metrics/retia-metrics/app/(app)/p/[programa]/calls/page.tsx:134`
  - Función semántica existente: `/home/runner/work/retia-metrics/retia-metrics/lib/auth/roles.ts:130-132`
- Riesgo: divergencias al evolucionar reglas de permisos.
- Mejora: reutilizar funciones semánticas de `lib/auth/roles.ts` en vez de componer booleanos ad-hoc.

## 3) Escalabilidad

### E1. Listado de llamadas: filtro, orden y paginación en memoria
- Evidencia:
  - Carga y filtra en memoria: `/home/runner/work/retia-metrics/retia-metrics/lib/queries/llamadas.ts:48-107`
  - Paginación en página tras traer todo: `/home/runner/work/retia-metrics/retia-metrics/app/(app)/p/[programa]/calls/page.tsx:69-73`
- Riesgo: crecimiento de latencia y RAM al aumentar tráfico/concurrencia y volumen de llamadas.
- Mejora: mover filtros + `order by` + `limit/offset` a SQL y devolver `{total, filas}`.

### E2. Kanban con post-procesamiento grande en memoria
- Evidencia:
  - Construcción de tarjetas y filtros en memoria: `/home/runner/work/retia-metrics/retia-metrics/lib/queries/kanban.ts:312-394`
- Riesgo: para crecimiento x10 de deals, aumenta CPU de servidor y tiempo de respuesta.
- Mejora: medir con telemetría y priorizar pushdown parcial de filtros/orden al query base.

## 4) Sostenibilidad (hardcodes y flexibilidad)

### S1. Opciones de filtros declaradas manualmente por pantalla
- Evidencia:
  - Leads (calidades/campos): `/home/runner/work/retia-metrics/retia-metrics/app/(app)/p/[programa]/leads/page.tsx:46-57`
  - Deals (campos fecha): `/home/runner/work/retia-metrics/retia-metrics/app/(app)/p/[programa]/deals/page.tsx:26-30`
  - Calls (resultados): `/home/runner/work/retia-metrics/retia-metrics/app/(app)/p/[programa]/calls/page.tsx:30-39`
- Riesgo: cada cambio de dominio exige editar varias UIs.
- Mejora: un catálogo de opciones UI derivado de fuente de verdad de dominio.

---

## Plan de ejecución por sesiones (sin romper producción)

1. **Sesión A (R1 + R2):** centralizar helpers de `searchParams` y query string para server/client.
2. **Sesión B (R3 + S1 parcial):** unificar opciones de resultados de llamadas y calidades en un módulo compartido.
3. **Sesión C (C2):** reemplazar booleanos inline de permisos por funciones semánticas centralizadas.
4. **Sesión D (E1):** rediseñar `llamadasDelPrograma` para paginación SQL + total (con pruebas de regresión).
5. **Sesión E (C1):** extraer “bridges” por listado (leads/calls) y adelgazar páginas.
6. **Sesión F (E2):** perf pass de Kanban (métricas, límites y pushdown incremental).

## Criterios de seguridad para ejecutar estas mejoras

- No cambiar contratos funcionales sin tests de regresión equivalentes.
- Mantener frontera por `programa` intacta en toda consulta.
- Aplicar cambios incrementales, uno por sesión, con validación (`typecheck`, `lint`, tests del dominio afectado).
