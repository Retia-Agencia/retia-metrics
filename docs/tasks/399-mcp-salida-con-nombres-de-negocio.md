---
id: 399
etapa: mcp
serves: "Auditoría 385 F5.2, F5.3, F5.5 · ADR 0119 · docs/mcp.md"
depends: [397]
status: done
---

# 399 — MCP: salida con nombres de negocio y descripciones estándar

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md) (plan F7 en [`docs/auditoria-datos-2026-11/f7-plan.md`](../auditoria-datos-2026-11/f7-plan.md)). Reglas: ADR 0115.

## Por qué

Cada tool devuelve el objeto interno de la vista (`dinero.ventas`, `embudo.cierres`, `contratadoUsd`) y escribe su texto a mano; la IA cita nombres de backend y mezcla "shows" (llamadas) con "Show" (deals). Depende además del 403 parcial: el registro es la fuente del `outputSchema`; basta con los conceptos que las tools exponen.

## Alcance

**Cubre:** F5.2, F5.3, F5.5. Coordina con el 386 (mismo método para las tools de operación) y con el frente B del 387.

**Archivos calientes** (donde chocan dos sesiones): `lib/mcp/herramientas/*.ts`, `lib/mcp/instrucciones.ts`, `docs/mcp.md`, `tests/mcp-contrato.test.ts`, `tests/mcp-guardian.test.ts`.

**Migración:** Ninguna.

## Fuera

Lo que pertenece a otro hijo del 385 (ver `docs/auditoria-datos-2026-11/f7-plan.md` §1: una causa, un ticket). Este ticket no migra conceptos del registro que no toca.

## Estado (8-nov)

**Fase A en main** (`ad5e36b8`, `6d4e3287`): `outputSchema` con descripción por campo y salida con nombres de negocio en `resumen_del_hub` y `consultar_metrica` (`lib/mcp/salidas/`), `title` y las cuatro anotaciones en las once, descripciones que empiezan por cuándo usarla, clave `cita_a_venta` en el vocabulario. **Fase B en main** (9-nov): `outputSchema` de las otras nueve tools (`lib/mcp/salidas/{programas,operacion,decisiones}.ts`) y `salida` obligatoria. **Falta:** `EXPLAIN` a 10 veces del volumen y la segunda medición del descubrimiento (387 frente B). `SIN_FICHA_EN_REGISTRO` (en `lib/mcp/salidas/campos.ts`) lo consume el 403.

## Done cuando

- [x] `outputSchema` por tool, con nombre de negocio y descripción por campo, derivado del registro cuando hay ficha.
- [x] Las once tools con descripción que empieza por cuándo usarla, `title` legible y anotaciones completas (`docs/mcp.md` §4).
- [x] Paridad contra la pantalla por tool (`tests/mcp-*.test.ts`; `cartera_vencida` compone Students y cartera) y medición a 10 veces el volumen (`tests/mcp-volumen.test.ts`, opt-in con `MEDIR_VOLUMEN=1`: las nueve tools con base de 50.000 personas, tope de humo de 2 s, pasa). `EXPLAIN` de las consultas no se captura sin tocar código de producción: queda como deuda del 262.
- [x] Segunda medición del descubrimiento: trasladada al 387 frente B por decisión de Mani (9-nov); no bloquea este ticket.
- [x] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y el ADR afectado quedan reescritos en el mismo commit, título e índice incluidos.
