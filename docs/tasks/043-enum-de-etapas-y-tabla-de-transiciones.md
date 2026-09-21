---
id: 043
etapa: E2
serves: "plan v2 §6 etapa 2 · tarea E2-1 · ADR 0037, insumo §3"
depends: [042]
status: todo
---

# 043 — Las diez etapas como tipo, y la tabla de transiciones permitidas

## Objetivo

Fijar en el codigo cuales son las diez etapas y **que movimiento entre ellas es legal**, como dato
puro: una tabla que se lee, no una cadena de `if`.

## Las diez etapas y sus siguientes (insumo §3)

| # | Etapa | Siguientes |
|---|---|---|
| 1 | Pendiente Setteo | 2, 10 |
| 2 | En Contacto | 4, 6, 10 |
| 3 | Pendiente Re-agenda | 4, 10 |
| 4 | Agendado | 3, 5, 10 |
| 5 | Atendido | 6, 7, 10 |
| 6 | Compromiso Verbal | 7, 10 |
| 7 | Abonado | 8, 10 |
| 8 | Completo | terminal |
| 9 | Proxima Cohorte | 2, 4, 10 |
| 10 | Cierre Perdido | recuperable a cualquier etapa, con motivo |

## Alcance

- **Dentro:** el `pgEnum` de las diez etapas y el modulo `lib/deals/etapas.ts` con la tabla de
  transiciones como estructura de datos exportada.
- **Dentro:** los tests que recorren la tabla entera, en los dos sentidos.
- **Fuera:** validar requisitos (ticket 044), mover nada (ticket 045), pantallas.

## Por que son tipos y no catalogo

El codigo **decide** con ellas: Students es `etapa in (Abonado, Completo)`, la cartera vencida
mira Abonado, y los movimientos automaticos del sync preguntan por valores concretos. Eso es la
regla del ADR 0012, no una excepcion a ella. No se contradice con que `lead.estado` sea texto:
**nadie decide con el estado, todo decide con la etapa** (ADR 0032, ADR 0037).

## Done cuando

- [ ] Las diez etapas existen como `pgEnum` y `deals.etapa` lo usa.
- [ ] La tabla de transiciones es dato, no codigo ramificado, y esta en un solo lugar.
- [ ] Un test recorre las 100 combinaciones: las permitidas pasan y las prohibidas se rechazan.
- [ ] Cierre Perdido es alcanzable desde las nueve, y la recuperacion desde el a cualquiera.

## Kiro

Si, la tabla y sus tests, con revision. El diseno del contrato, no.
