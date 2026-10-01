---
id: 142
etapa: NC2
serves: "comercial.md R-1, GC-01, GC-03, GC-04, §4"
depends: [QM-10, QD-8]
status: bloqueado
---

# 142 — Las etapas de 30X: enum, transiciones, requisitos y la traducción en una migración

**Bloqueado por:** QD-1 (dónde van Pendiente Re-agenda, Seguimiento y Próxima Cohorte; qué distingue
Potencial, Registrado, En gestión y Contactado) y **QD-8 (el manual de gestión comercial)**. Sin el manual
las reglas de movimiento no se pueden reescribir. No se toca nada de etapas antes.

> **1-oct (Mani, `comercial.md` §7.0):** QD-1 contestada: cada etapa se define como en `insumos/hubspot-30x-workflow.md` §3, y Pendiente Re-agenda, Seguimiento y Próxima Cohorte son **estados dentro del deal**, no etapas (cómo se modelan: QM-10, ADR antes de este ticket). QD-2: descartados y setteo a la cola del setter (propuesta: En gestión), cerrados a ganado en su cohorte. Sigue esperando el manual de Alejo (QD-8).

## Objetivo

Que `deals.etapa` tenga las once etapas de 30X (`comercial.md` §4) y que `moverEtapa()` las mueva con los
requisitos remapeados.

## Alcance (al desbloquear, se precisa con `/grill-with-docs` y un ADR que reemplace partes del 0037 y el 0056)

- El enum, `mapa-transiciones.ts`, `requisitos.ts`, el Kanban, el Inbox, el embudo y toda consulta que nombre
  una etapa.
- **Una sola migración** que traduce `deals.etapa`, `deal_etapa_historial` y `estados_llegada.etapa_entrada`
  (117). El historial se traduce, no se reescribe a mano.
- Lo que no cambia: `moverEtapa()` único escritor, anulado no es Cierre Perdido (ADR 0038), venta = las dos
  etapas de ganado, el valor vendido obligatorio al entrar a ganado (ADR 0065), Atendido sin Grain (ADR 0066).
- Después: el `--aplicar` del 078 (R-11) y las secciones del dashboard (148).
