# 0131 — Lo que nadie lee se borra de la base: seis migraciones, cada una con su respaldo

- **Estado:** aceptada · 14-nov-2026 (Mani, aplicadas con su ok una por una)
- **Relacionadas:** ADR 0115 N7 (reemplazar es borrar), ADR 0012 (instancias en la base, tipos en el código), ADR 0087 (el canal sale de una regla), ADR 0005 (índices únicos), ticket 401, auditoría 385 F3 (`docs/auditoria-datos-2026-11/`)

## Contexto

La auditoría 385 midió columnas, tablas e índices que el código ya no leía o que nunca se llenaron. Un campo sin lector no
da error y engaña: parece un dato y no lo es (por ejemplo, `leads.estado` valía `cola_setteo` en el 100 % de las filas).
El ticket 401 los retiró en seis migraciones, una por grupo, para poder revertir. Antes citaba por error el ADR 0126, que es el del ROAS proyectado.

## Decisión

1. **Primero el código deja de leer y escribir, después va la migración.** El guardián `tests/columnas-sin-lector-guardian.test.ts` lista lo que sigue vivo sin lector y ya no tiene excepciones zombi.
2. **Cada migración se lee a mano antes de aplicarla**, con `lock_timeout 5s` y sin `CASCADE`. El `generate` de drizzle puso el `DROP CONSTRAINT` después del `DROP TABLE ... CASCADE` en la 0139 (caso 0020); se reescribió en orden.
3. **Lo que tenía datos se respalda y se anota; lo vacío no.** La cohorte de una llamada es la de su deal (dos copias viejas decían C3 y el deal ya está en C4).

| Migración | Qué sale | Datos que tenía |
|---|---|---|
| 0141 (M9) | `leads`: `estado`, `cohort_id`, `cargo`, `empresa`, `ciudad`, `pais`, `ingreso_declarado`, `urgencia`, `por_que_aplico`, `motivo_descarte`, `raw`, e índices `leads_programa_estado_idx` y `leads_cohorte_idx` | 0 filas con valor; `estado` constante |
| 0142 (M10) | `calls`: `cohort_id`, `closer_id`, `motivo_perdida`, índice `calls_cohorte_closer_idx` | `closer_id` y `motivo_perdida` 0; `cohort_id` 740, copia del deal |
| 0137 (M11) | `submissions`: `estado_hoja`, `posicion_en_hoja`, `version_puntaje` | `estado_hoja` igual a `calificacion` en las 3.218 filas |
| 0138 (M12) | `users.calendly_email`, `programs.record_personas_por_dia_habil` | 0 de 28; récord 73 Comunicarte y 30 Tactical, sin lector |
| 0139 (M13) | `sync_runs`, `change_log.sync_run_id`, tipo `estado_sync` | tabla vacía |
| 0140 (M14) | `canales`, `areas`, tipo `formato_utm` | 26 y 3 filas; respaldo en `docs/auditoria-datos-2026-11/canales-y-areas-antes-de-m14.json` |

4. **`change_log` conserva su historia** (incluidas las filas de `canales` y `areas`).

## Consecuencias

- Una columna nueva sin lector la caza el guardián; no se agrega "por si acaso".
- La cohorte, el closer y el motivo de una llamada se leen solo de `deals.cohort_id`, `calls.closer_user_id` y `calls.motivo_id`.
