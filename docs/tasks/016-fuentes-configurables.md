---
id: 016
fase: F0
serves: "ADR 0012, ADR 0019 — una fuente se prueba antes de activarse; spec §5 criterio 4"
depends: [014]
status: done
---

# 016 — Plantilla de lead y fuentes configurables, con prueba antes de activar

## Objetivo
Un gerente conecta la hoja de un programa nuevo (ID, pestaña, mapeo) desde la app, y el sistema
le dice en ese momento si el mapeo cuadra.

## Alcance
- Dentro: `/ajustes/fuentes` deja de ser solo lectura para gerentes: crear, editar, desactivar.
- Dentro: botón "Probar": lee los encabezados con la cuenta de servicio y corre
  `resolverColumnas`. Muestra qué columna tomó cada campo, o el `MapeoInvalidoError`.
- Dentro: una fuente solo se puede activar si su última prueba pasó.
- Dentro (ADR 0019): plantilla de lead por programa (migracion en `programs`, primero en `dev`).
  El mapeo se combina campo por campo: fuente → plantilla del programa → `MAPEO_FORMULARIO`.
- Dentro: la pantalla muestra de donde salio cada columna (fuente, programa o defecto).
- Dentro: tests de la combinacion (un ajuste de fuente gana; un campo sin ajuste hereda).
- Dentro: instrucciones en pantalla: compartir la hoja con la cuenta de servicio.
- Fuera: tipos de fuente nuevos (Typeform) — eso es código, con su ADR.

## Done cuando
- [ ] Un programa nuevo con dos hojas se configura con una sola plantilla, y una de las hojas
      ajusta un solo campo sin repetir el resto.
- [ ] Una hoja con un encabezado faltante no se puede activar y el mensaje dice cuál falta.
- [ ] El ID completo de la hoja no se muestra entero en pantalla (S-13): se trunca igual que en
      `docs/estructura-bbdd.md`.
- [ ] Los encabezados leídos no se guardan en logs públicos (ver comentario en `api/cron/sync`).

## Notas
Puede esperar si el plazo aprieta: hoy los dos programas ya tienen su fuente y el mapeo por
texto aguanta sus diferencias. Es lo que evita estandarizar hojas cuando llegue un programa nuevo.
