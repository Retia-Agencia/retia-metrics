---
id: 394
etapa: plataforma
serves: "Auditoría 385 F3-03, F3-17 · ADR 0043 · ADR 0048 · ADR 0026 · ADR 0125"
depends: []
status: done
---

# 394 — El programa lo garantiza la base

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md) (plan F7 en [`docs/auditoria-datos-2026-11/f7-plan.md`](../auditoria-datos-2026-11/f7-plan.md)). Reglas: ADR 0115.

## Por qué

La frontera de programa en tablas hijas (`lead_contactos`, `deals`, `calls`, `abonos`) vive solo en el código; `programs` borra en cascada hacia `leads`, `deals`, `calls`, `abonos`, `cohorts` y `sources`, contra "no se borra lo que ya se usó" (ADR 0026). Hoy 0 filas divergen: la migración no limpia nada, endurece. Una de las migraciones más riesgosas: va después de la ola 2 de código para no chocar con otros cambios de esquema.

## Alcance

**Cubre:** F3-03, F3-17.

**Archivos calientes** (donde chocan dos sesiones): `lib/db/schema.ts`, `drizzle/`, `tests/modelo-crm-indices.test.ts`.

**Migración:** M4 (`UNIQUE (id, program_id)` y FK compuestas; `drizzle-kit` suele expresar el cambio de FK con `DROP`/`ADD` en orden dudoso; `CREATE UNIQUE INDEX CONCURRENTLY` no corre dentro de la transacción de una migración: a verificar cómo lo aplica este repo) y M5 (`ON DELETE restrict` desde `programs`, migración separada de M4 para poder revertir). ADR 0125.

## Fuera

Lo que pertenece a otro hijo del 385 (ver `docs/auditoria-datos-2026-11/f7-plan.md` §1: una causa, un ticket). Este ticket no migra conceptos del registro que no toca.

## Done cuando

- [x] `UNIQUE (id, program_id)` en `leads`, `deals`, `cohorts` y las FK compuestas de §6.2 de F3, con test que intenta insertar un hijo de otro programa y falla.
- [x] `programs` hacia hijos con `restrict`; un `DELETE` de programa falla con mensaje claro.
- [x] Antes de aplicar: `pg_stat_activity` sin transacciones largas, SQL leído línea por línea, código desplegado.
- [x] Regla N8: ADR 0043 y 0048 enmendados (la frontera pasa a ser de la base), con título, índice, fila de `docs/metricas.md` y vocabulario de `overview.md` §11 en el mismo commit.

## Cierre (9-nov)

Migraciones 0128 (M4) y 0129 (M5) aplicadas en producción (ref `hfqmiyiuyqapdsbywrag`), sin transacciones largas y con `lock_timeout` 5 s; 6 relaciones medidas sin filas divergentes antes de aplicar; todas las restricciones validadas después. El SQL de `drizzle-kit` salía con los `UNIQUE` después de las FK que los referencian: se reordenó a mano. ADR 0125; `tests/programa-garantizado.test.ts`. Candidatas fuera de alcance: `notificaciones_calendly`, `avisos_estudiante_nuevo`.
