---
id: 141
etapa: NC1
serves: "comercial.md §9.4 · ADR 0067"
depends: [136]
status: done
---

# 141 — Filtros de fecha relativos en las listas de deals y de leads

## Objetivo

Filtrar las listas por fecha de creación, última actividad y cierre con el mismo selector del dashboard.

## Alcance

- **Dentro:** el selector del 136 (solo el rango A, sin comparación) en la lista de deals sobre creado, última
  actividad y cierre; en la base de leads (072) sobre creado y último envío.
- **Dentro:** los filtros en la URL, sin datos personales.
- **Dentro:** "última actividad" sale de UNA función (la misma que decide "estancado" en el Inbox), no de una
  copia.
- **Fuera:** la lista de leads en sí (072, carril de Alejo): este ticket le agrega el filtro. Coordinar con
  Alejo antes de tocar sus archivos.

## Done cuando

- [x] "Ayer" a las 11 pm de Bogotá trae los de ayer de Bogotá, no los de UTC (test).
- [x] La última actividad de la lista y la del Inbox salen de la misma función.
- [x] Recorrido visual de las dos listas con cada atajo (por servidor y por teclado; falta confirmar con un clic de ratón humano).

## Codex

Sí, esfuerzo `low`.

## Hecho (1-oct, Alejo)

- **Deals (Kanban):** `fecha=creado|actividad|cierre` más el selector del 136 en modo `soloA`.
  - Creado: `fechaAnclaDealCreado`, la del 138 (fecha del envío de origen o su alta).
  - Cierre: `cerradosEn` en `lib/queries/metricas-filtros.ts`, la primera entrada a Abonado, Completo o Cierre
    Perdido después de la última reapertura. Un perdido que se recupera y se vende cierra el día de la venta; un deal
    abierto no tiene cierre.
  - Actividad: `ultimaActividadPorDeal`, que pasó del Inbox a `lib/queries/ultima-actividad.ts` y la importan los
    dos. La lista le pasa `hasta = ahora`, así que una cita futura no cuenta como actividad; el Inbox la sigue
    contando para "estancado".
- **Leads:** `fecha=creado|ultimo_envio`. Creado es la primera aplicación o, en un alta manual, su alta. Se quitaron
  los Desde/Hasta sueltos; el formulario GET conserva el filtro de fecha en inputs ocultos.
- `filtroDeFechaDeLaUrl` (`lib/periodo.ts`): sin `fecha` no hay filtro; sin atajos de cohorte en las listas.
  `SelectorPeriodo` borra `pagina` al cambiar el periodo. "Limpiar" de Deals aparece también con solo la fecha.
- **Recorrido (dev:local, base de Docker):** cada atajo en las dos listas por el servidor, y los conteos cuadran
  contra el total (deals: creado hoy 21 + mes pasado 107 = 128; cierre 11 + 14 = los 25 cerrados; leads: sin deal
  31 + con deal 128 = 159). Interacción: los clics de la extensión de Chrome no llegaban a la página (cero eventos,
  también en combos viejos), así que se manejó con teclado y `click()` desde JavaScript: el combo de campo navega,
  el diálogo en modo solo A sale sin B ni cohortes, y el atajo filtra. Pendiente un clic humano de confirmación.
- Revisión: subagente de Claude (Codex sin cuota); sus 5 hallazgos aplicados.
- Tests: `tests/filtros-fecha-listas.test.ts`.
