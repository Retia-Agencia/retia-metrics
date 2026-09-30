---
id: 127
etapa: E5
serves: "operations.md §12.3 nivel 3 · ADR 0059 punto 2 · ticket 078"
depends: [078]
status: todo
---

# 127 — Deshacer la migración de un programa por su huella

## Objetivo

Que el peor escenario del corte (la migración se aplicó en producción, quedó mal y los closers todavía no
trabajan encima) se resuelva con **un comando probado**, no con un script escrito con prisa ese día ni con
un `pg_dump` que también se lleva lo que entró por el webhook en esas horas (`operations.md` §12.3).

## Alcance

- **Dentro:** un script `npm run migracion:deshacer -- --programa <slug> [--aplicar] [--local]` que borra de
  UN programa lo que escribió la migración, y nada más:
  - los deals con `huella_migracion`, con su `deal_etapa_historial` y sus `deal_actividades`;
  - los abonos con `huella_migracion`;
  - las llamadas con `huella_fila` que empieza con `sheets:`;
  - las filas de `rarezas_migracion` del programa.
- **Dentro:** **ensayo por defecto**, como el importador: todo en una transacción que se deshace, imprimiendo
  solo conteos. Borra de verdad solo con `--aplicar` y con el ok de Mani. Exige `SCRIPT_ACTOR_EMAIL`
  (ADR 0029) y deja su rastro en `change_log`.
- **Dentro:** **se niega** (y dice por qué) si alguien ya trabajó sobre lo migrado: un abono, una llamada o
  una actividad **sin** huella colgada de un deal migrado, o una fila de `deal_etapa_historial` con usuario
  (una persona movió la etapa). En ese caso es el nivel 4 de la reversa: se anula fila por fila (ADR 0038).
- **Dentro:** tests en PGlite (migrar con `importarGestion`, deshacer, conteos en cero, lo del webhook
  intacto; y la negativa cuando hay trabajo encima) y una prueba en la base local de Docker.
- **Fuera:** leads y envíos: la migración de gestión no los crea (el lead lo manda el formulario, ADR 0004).
- **Fuera:** deshacer después de que los closers trabajaron: eso se anula, no se borra.

## Por qué borrar aquí no rompe la regla de "no se borra lo que se usó"

La regla (ADR 0026, enmienda del 0012) protege el historial de algo que **pasó**. Una migración que se
aplicó mal y nadie tocó no es historia del negocio: es un error de carga detectado antes de abrir. Por eso el
script solo existe para el nivel 3 y se niega en cuanto hay trabajo encima.

## Done cuando

- [ ] Ensayo y `--aplicar` probados en PGlite y en la base local.
- [ ] Deshacer deja los conteos del programa como antes de migrar, y lo que entró por el webhook intacto.
- [ ] Con trabajo encima, se niega con el motivo y no borra nada.
- [ ] `operations.md` §12.3 nivel 3 apunta al comando.

## Kiro

Sí para el código y los tests. Correrlo en producción, solo la sesión principal con el ok de Mani.
