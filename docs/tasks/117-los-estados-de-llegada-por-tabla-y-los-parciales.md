---
id: 117
etapa: E6
serves: "ADR 0061 · docs/analytics.md PT-01, PT-02, PT-05, PT-06, PT-07"
depends: [115]
status: todo
---

# 117 — Los estados de llegada por tabla, y los envíos parciales por el webhook

## Objetivo

Que la etapa donde nace un deal salga de una **tabla por programa** y no de valores fijos en el código, y
que el CRM reciba el envío parcial previo al Calendly para no perder a quien llegó ahí y no agendó.

## 🩸 Por qué ahora

El 29-sep una edición del Typeform de Tactical quitó la variable `estado` y ningún envío abrió deal
entre las 11:40 y las 20:11 (23 envíos, 9 con cita), sin un solo error (`docs/analytics.md` §2.4). Hay un parche en el Typeform; este
ticket lo vuelve innecesario.

## Alcance

- **Dentro:** tabla `estados_llegada` por el molde de `lib/catalogo/` (ADR 0012): `program_id`, `valor`
  (como lo manda el formulario), `etapa_entrada` (Pendiente Setteo, Agendado o ninguna), `prioridad`
  (normal o alta), `alerta_minutos` (nulo = sin alerta), `activo`; único `(program_id, lower(valor))`.
  Pantalla en `/ajustes/fuentes` o en la ficha del programa (100), para quien administra.
- **Dentro:** siembra por la función del catálogo con `actorDelScript()` (ADR 0029), para los dos
  programas: `setteo_no_calificado` → Setteo normal · `con_calendly_sin_agenda` → Setteo alta, 5 minutos ·
  `con_calendly` → Agendado · `descartado` → Setteo normal mientras un formulario lo mande (Mani: todo el
  que llena el formulario es contacto).
- **Dentro:** `aplicarReglaDeDeal` decide con la fila de la tabla. `estadoConAgenda` sube a `con_calendly`
  **cualquier** valor cuando la pregunta de agenda trae link (hoy solo desde `setteo_no_calificado`).
- **Dentro:** vacío o desconocido → lead sin deal, contado como "sin estado" en la salud de la fuente
  (107, 110) y visible en Leads. Nunca un deal adivinado.
- **Dentro:** el webhook acepta `form_response_partial`: el adaptador lo guarda como `es_parcial = true`
  (ADR 0036, índice de la 0022). Un parcial sin `estado` (el del WhatsApp) no abre deal. El parcial con
  `con_calendly_sin_agenda` abre el deal en Pendiente Setteo; la completa con cita del mismo token lo mueve a
  Agendado por la regla de siempre (lead con deal abierto en 1).
- **Dentro:** verificar con el primer parcial real qué trae el payload (campos ocultos y variables, sobre
  todo `lead_value`) y anotarlo aquí.
- **Dentro:** reprocesar los 23 envíos de Tactical del 29-sep sin estado (11:40 a 20:11), con la regla nueva y el ok de
  Mani; los 9 con cita adoptan su llamada suelta. 4 de esos 23 leads ya tienen deal por un envío anterior: la regla
  de siempre decide (lead con deal abierto).
- **Fuera:** el urgente del Inbox (118). La configuración del Typeform (tarea O-7 de `docs/analytics.md`
  §7), que va **después** de este ticket en producción.

- **A tener en cuenta:** desde el 29-sep los dos Typeform mandan también la variable `etapa` (`Setteo` /
  `Agendado`), aparte de `estado` (`docs/analytics.md` §2.2, O-8). Llega en `respuestas` como
  `variable:etapa`. Si la tabla `estados_llegada` va a leerla, se decide aquí; mientras no, se ignora.

## Las reglas

- La regla de etapa no compara números de etapa ni textos fijos: lee la fila (ADR 0012).
- `regla-de-deals.ts` es del carril de Alejo y lo toca también el 115 (Mani): va después del 115.

## Done cuando

- [ ] Un valor nuevo en la tabla abre deals en su etapa sin tocar código, con test.
- [ ] Un envío sin estado o con un valor desconocido no abre deal y se cuenta, con test.
- [ ] Parcial `con_calendly_sin_agenda` y luego su completa con cita: un lead, un deal, que termina en
      Agendado con su llamada; con test.
- [ ] Parcial sin estado: lead sin deal, con test.
- [ ] Los 23 envíos reprocesados, verificado con una consulta.

## Kiro

Sí para el código y los tests, con revisión. La migración, la siembra y el reproceso en producción, la
sesión principal con el ok de Mani.
