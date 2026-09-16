---
id: 016
fase: F0
serves: "ADR 0012 — una fuente se prueba antes de activarse; spec §5 criterio 4"
depends: [014]
status: todo
---

# 016 — Fuentes de leads configurables, con prueba antes de activar

## Objetivo
Un gerente conecta la hoja de un programa nuevo (ID, pestaña, mapeo) desde la app, y el sistema
le dice en ese momento si el mapeo cuadra.

## Alcance
- Dentro: `/ajustes/fuentes` deja de ser solo lectura para gerentes: crear, editar, desactivar.
- Dentro: botón "Probar": lee los encabezados con la cuenta de servicio y corre
  `resolverColumnas`. Muestra qué columna tomó cada campo, o el `MapeoInvalidoError`.
- Dentro: una fuente solo se puede activar si su última prueba pasó.
- Dentro: el mapeo por defecto es `MAPEO_FORMULARIO`; se puede ajustar por fuente.
- Dentro: instrucciones en pantalla: compartir la hoja con la cuenta de servicio.
- Fuera: tipos de fuente nuevos (Typeform) — eso es código, con su ADR.

## Done cuando
- [ ] Una hoja con un encabezado faltante no se puede activar y el mensaje dice cuál falta.
- [ ] El ID completo de la hoja no se muestra entero en pantalla (S-13): se trunca igual que en
      `docs/estructura-bbdd.md`.
- [ ] Los encabezados leídos no se guardan en logs públicos (ver comentario en `api/cron/sync`).

## Notas
Puede esperar si el plazo aprieta: hoy los dos programas ya tienen su fuente.
