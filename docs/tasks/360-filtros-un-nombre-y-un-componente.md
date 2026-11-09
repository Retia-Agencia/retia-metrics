---
id: 360
etapa: plataforma
serves: "ADR 0115 N1, N4 · auditoría 30-oct G-11, G-13, R-12"
depends: []
status: done
---

# 360 — Filtros: un nombre por parámetro y un componente de fecha

> **Enmendado el 3-nov (fase 2):** los filtros del Hub (cohorte, periodo, closer con el parámetro `closer`) los hace el [377](./377-filtros-del-hub-periodo-cohorte-y-closer.md). Aquí quedan las cinco listas operativas.

Auditoría: [`docs/auditoria-metricas-2026-10-30.md`](../auditoria-metricas-2026-10-30.md). Reglas: ADR 0115.

## Por qué

- **G-11:** la misma idea con parámetros distintos: `owner` (Deals) y `closer` (Calls, Hub) con etiquetas "Dueño" y
  "Closer"; `leadQuality` (Deals) y `calidad` (Leads); `leadValue`. Tres componentes de fecha (`SelectorPeriodo`,
  `FiltroFechaLista`, `FiltroFecha`), y `desde`/`hasta` son claves viejas en Leads (`filtro-fecha-lista.tsx:17`) y nuevas
  en Calls. El valor por defecto cambia por lista (cohorte activa en Deals y Students, nada en Calls).
- **G-13:** Calls y Students guardan la búsqueda en `?q=`; Leads y Deals en estado local, que no sobrevive al volver;
  "celular" contra "teléfono".
- **R-12:** `components/filtro-dashboard.tsx` con nombre viejo.

## Alcance

1. Parámetros en español y minúscula (`closer`, `calidad`, `valor`), con alias para los enlaces viejos (la regla 5 de
   `components/filtros/declaracion.ts` ya lo permite).
2. Un componente de fecha de lista; `SelectorPeriodo` queda para métricas.
3. El valor por defecto de cada lista visible en su chip.
4. Una búsqueda por URL en las cuatro listas, con un placeholder.
5. `filtro-dashboard.tsx` → nombre del Hub.

## Done cuando

- [x] Un enlace viejo (`?owner=`, `?leadQuality=`) sigue funcionando por alias, con test.
- [x] Buscar en Leads, abrir un lead y volver conserva la búsqueda.
- [x] Recorrido de las cinco listas con clic en cada filtro.
- [x] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y cualquier ADR que cambie quedan reescritos en el mismo commit, título e índice incluidos.


## Estado

Recorrido hecho el 9-nov contra la base local (gerente, ComunicArte Local, escritorio): Deals con alias `?owner=&leadQuality=` (redirige a `closer`/`calidad`, chips y popover correctos, fecha «Creado» + periodo en la URL), Leads con `?q=` que sobrevive a abrir un lead y volver por «← Leads · filtrados», y Calls, Students, Inbox y Bitácora abren sin error con los filtros de fecha. **Hallazgo del recorrido:** Calls reventaba (`CLAVES_DE_FECHA_LISTA is not iterable`): un valor exportado de un archivo `"use client"` llega al servidor como referencia, no como arreglo. La constante pasó a `lib/claves-de-fecha-lista.ts`. Ningún test lo veía.
