# 0125 — El programa de una fila hija lo garantiza la base

- **Estado:** aceptada · 9-nov-2026 (migraciones 0128 y 0129 aplicadas en producción)
- **Enmienda:** ADR 0043 (el programa es frontera) y ADR 0048 (alcance), que pasan de «el tipo de la consulta» a «la base»
- **Relacionadas:** ADR 0005 (la garantía vive en un índice), ADR 0012, ADR 0026 (no se borra lo que ya se usó), ADR 0115, ticket 394, auditoría 385 F3-03 y F3-17

## Contexto

La frontera de programa en las tablas hijas (`lead_contactos`, `deals`, `calls`, `abonos`, `eventos_meta`) vivía solo en el código: `program_id` está denormalizado a propósito y nada impedía que apuntara a un padre de otro programa. Medido el 9-nov en producción (solo SELECT): 0 filas divergen en las seis relaciones (4.062 leads, 4.066 deals, 1.130 llamadas, 82 abonos). Además `programs` borraba en cascada hacia `leads`, `deals`, `calls`, `abonos`, `cohorts` y `sources`, contra el ADR 0026, y los hijos de esos hijos ya eran `restrict`, así que un `DELETE` de programa habría fallado a medias.

## Decisión

1. **M4, migración 0128.** `UNIQUE (id, program_id)` en `leads`, `deals` y `cohorts`, y cada FK simple se reemplaza por una compuesta que incluye `program_id`: `lead_contactos` y `deals` hacia `leads`; `deals` hacia `cohorts`; `calls`, `abonos` y `eventos_meta` hacia `deals`. Con `cohort_id` o `deal_id` nulos la FK no se evalúa (MATCH SIMPLE), que es lo correcto: una llamada puede no tener deal y un deal puede no tener cohorte. `ON DELETE` se conserva (`cascade` en contactos, `restrict` en el resto). La migración no limpia nada: endurece. Va con `lock_timeout` 5 s, los `UNIQUE` primero y cada `DROP` junto a su `ADD` en la misma transacción. Se usa constraint normal y no `CREATE UNIQUE INDEX CONCURRENTLY`: el repo migra en transacción y las tablas tienen miles de filas, no millones.
2. **M5, migración 0129.** `programs` hacia `leads`, `deals`, `calls`, `abonos`, `cohorts` y `sources`: de `cascade` a `restrict`. Un `DELETE` de un programa con historia falla de entrada. Queda `cascade` donde la fila es atributo del padre (`lead_contactos` con su lead, `miembros_programa`, `plataformas_programa`, `recursos`, `enlaces_pago`, `sync_runs`). Migración separada de M4 para poder revertir una sin la otra.
3. Fuera de alcance, a propósito: `notificaciones_calendly` y `avisos_estudiante_nuevo` también tienen `program_id` y `deal_id` sin FK compuesta, y `calls.cohort_id` (`set null` no se lleva con una FK compuesta). Se anotan como candidatas, no se tocan aquí.

## Consecuencias

Insertar un hijo de otro programa falla con 23503 y el nombre de la FK (`deals_lead_programa_fk`, `abonos_deal_programa_fk`, etc.). Un escritor nuevo de una tabla hija no necesita acordarse de la regla; una tabla hija nueva con `program_id` y padre propio debe declarar la FK compuesta. Probado en `tests/programa-garantizado.test.ts` en los dos sentidos (el hijo ajeno choca, el propio convive; un programa con leads o cohortes no se borra, uno vacío sí).
