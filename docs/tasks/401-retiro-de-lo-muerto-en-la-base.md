---
id: 401
etapa: plataforma
serves: "Auditoría 385 F3-04, F3-05, F3-06, F3-13 a F3-16 · ADR 0115 N7 · ADR 0126"
depends: [361, 391, 389]
status: todo
---

# 401 — Retiro de lo muerto en la base

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md) (plan F7 en [`docs/auditoria-datos-2026-11/f7-plan.md`](../auditoria-datos-2026-11/f7-plan.md)). Reglas: ADR 0115.

## Por qué

Columnas, tablas e índices que el código ya no lee o que nunca se llenaron (N7: reemplazar es borrar). Decisión previa de Mani: F3-08, `leads.pais` lo lee `lib/meta-capi/enviar.ts:30` y está vacío en 3.760 leads: ¿se llena en la ingesta o se quita la lectura? Define si `pais` entra a la lista de columnas muertas.

## Alcance

**Cubre:** F3-04 (`calls.cohort_id`, `calls_cohorte_closer_idx`), F3-05 segunda mitad (`calls.closer_id` y su fallback en 4 módulos, tras el 391), F3-06 (`leads.estado`, `leads.cohort_id` y 9 columnas de perfil), F3-13 (`submissions.posicion_en_hoja`, `version_puntaje`, `estado_hoja`), F3-14 (`users.calendly_email`, `programs.record_personas_por_dia_habil`), F3-15 (`sync_runs`, `change_log.sync_run_id`, `estadoSyncEnum`), F3-16 (`canales`, `areas`, `formatoUtmEnum`), `calls.motivo_perdida`, y los índices sobrantes `leads_cohorte_idx` y `leads_programa_estado_idx`.

**Archivos calientes** (donde chocan dos sesiones): `lib/db/schema.ts`, `drizzle/`, `lib/queries/fuentes.ts`, `lib/catalogo/canales.ts`, `lib/catalogo/areas.ts`, `lib/ingesta/mapeo-webhook.ts`, `lib/sheets/`, `tests/columnas-sin-lector-guardian`.

**Migración:** M9 a M14, una por grupo para poder revertir. ADR 0126. M9: `leads` (`estado`, `cohort_id`, 9 columnas de perfil, índices `leads_cohorte_idx` y `leads_programa_estado_idx`; confirmar antes que `leads_programa_email_idx` cubre las lecturas por `program_id`). M10: `calls` (`cohort_id`, `closer_id`, `motivo_perdida`, `calls_cohorte_closer_idx`; después del 391). M11: `submissions` (`posicion_en_hoja`, `version_puntaje`, `estado_hoja`, que es copia de `calificacion`: primero cambiar los lectores). M12: `users.calendly_email` y `programs.record_personas_por_dia_habil` (quitar antes la lectura de `scripts/seed-datos.ts`). M13: `sync_runs`, `change_log.sync_run_id`, `estadoSyncEnum` (riesgo de `DROP TABLE ... CASCADE`, caso 0020; quitar antes la lectura de `lib/queries/fuentes.ts`). M14: `canales`, `areas`, `formatoUtmEnum` (`change_log` conserva su historia; quitar molde, scripts de carga y `ajustes/areas` antes).

## Fuera

Lo que pertenece a otro hijo del 385 (ver `docs/auditoria-datos-2026-11/f7-plan.md` §1: una causa, un ticket). Este ticket no migra conceptos del registro que no toca.

## Done cuando

- [ ] Por cada grupo: el código deja de leer y escribir, se despliega, y solo después va la migración.
- [ ] El `drizzle-kit generate` de cada grupo leído a mano (los `DROP TABLE ... CASCADE` y los renombres falsos son el riesgo conocido, caso 0020).
- [ ] `change_log` conserva su historia (444 filas de `deal_actividades`, 130 de `canales`).
- [ ] `columnas-sin-lector-guardian` sin excepciones zombi.
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y el ADR afectado quedan reescritos en el mismo commit, título e índice incluidos.
