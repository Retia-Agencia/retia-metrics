---
id: 127
etapa: E5
serves: "operations.md §12.3 nivel 3 · ADR 0059 punto 2 · ticket 078"
depends: [078]
status: done
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

- [x] Ensayo y `--aplicar` probados en PGlite y en la base local.
- [x] Deshacer deja los conteos del programa como antes de migrar, y lo que entró por el webhook intacto.
- [x] Con trabajo encima, se niega con el motivo y no borra nada.
- [x] `operations.md` §12.3 nivel 3 apunta al comando.

## Kiro

Sí para el código y los tests. Correrlo en producción, solo la sesión principal con el ok de Mani.

## Cierre (30-sep, Alejo)

- `lib/migracion/deshacer.ts` (`deshacerMigracion`) y `npm run migracion:deshacer -- --programa <slug> [--aplicar] [--local]`.
  Los deals migrados se bloquean con `for update`; las FK `restrict` tumban la transacción si algo se cuela.
- **Cómo sabe que alguien trabajó encima:** deal, abono o llamada migrados que estén anulados; un abono sin huella o una
  llamada que no sea `sheets:` colgados de un deal migrado; una actividad con usuario; una fila de historial con `de` o
  con usuario (la migración solo escribe la de nacimiento); cuotas pactadas; o una fila de `change_log` de un registro
  migrado con otra hora que su alta (el alta escribe todo en una transacción, así que comparte `detectado_en`: un reclamo
  o una edición posterior se ve). Límite conocido: una nota del SISTEMA (`user_id` nulo) sobre un deal migrado no se
  distingue de una nota de la hoja.
- **Rastro:** una fila `reversa_migracion` en `change_log` por deal, abono, llamada y actividad borrados, con la huella
  como valor anterior. El historial de etapas y las rarezas se van sin fila propia.
- **Guardián nuevo:** solo este módulo hace `.delete(` sobre deals, llamadas, abonos, actividades o historial.
- **Probado:** 12 tests en PGlite (`tests/migracion-deshacer.test.ts`). En la base local de Docker, con el template real de
  Tactical y 300 leads sembrados para que cruzaran: la importación dejó 300 deals, el ensayo no borró nada, un reclamo
  real (`reclamarDeal`) hizo que se negara, y sin él `--aplicar` borró 300 deals, 300 filas de historial, 315 notas,
  7 abonos, 229 llamadas y 1.761 rarezas, dejando el programa como estaba sembrado y ComunicArte intacto.
