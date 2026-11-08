---
id: 388
etapa: hub
serves: "Auditoría 385 F2 (tanda 2) · ADR 0115 N2"
depends: []
status: todo
---

# 388 — F2 tanda 2: paridad de lo que F2 no cubrió

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md) (plan F7 en [`docs/auditoria-datos-2026-11/f7-plan.md`](../auditoria-datos-2026-11/f7-plan.md)). Reglas: ADR 0115.

## Por qué

F2 midió ventas, dinero, agendas, shows y leads. No midió metas, ROAS y gasto convertido, Origen, WhatsApp y semáforo, CSV, Mi espacio, las otras nueve tools ni el periodo `mes_en_curso`. Sin esto el 355 y el 395 trabajan a ciegas.

## Alcance

**Cubre:** Lo que F2 no vio (ver Alcance).

**Archivos calientes** (donde chocan dos sesiones): Ninguno (solo `docs/auditoria-datos-2026-11/f2b-paridad.md`).

**Migración:** Ninguna. Solo lectura (`BEGIN READ ONLY`, ref de la connection string verificado).

## Fuera

Lo que pertenece a otro hijo del 385 (ver `docs/auditoria-datos-2026-11/f7-plan.md` §1: una causa, un ticket). Este ticket no migra conceptos del registro que no toca.

## Done cuando

- [ ] Reconstrucción independiente por SQL de metas del mes y de la cohorte, ROAS, gasto convertido (Comunicarte tiene COP y USD el mismo programa), Origen, costo por agenda del semáforo y los tres CSV, contra lo que muestran Hub, MCP y WhatsApp.
- [ ] Verificado que ninguna suma agrupa Comunicarte COP con Comunicarte USD (insumo del 395).
- [ ] Cuántas ventas caen antes del primer día de gasto (cobertura del ROAS) por programa, y cuántos envíos pagos no tienen `utm_id` (F3-09), con conteo.
- [ ] Impacto de los 784 leads sin fecha en "Leads" y en las tasas por lead, por programa y mes (insumo del 389).
- [ ] Divergencias nuevas con su clase y severidad; si alguna es crítica, se abre ticket antes de seguir la ola 1.
