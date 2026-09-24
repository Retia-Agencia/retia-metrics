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

---

## 🟡 Propuesta 2026-09-24: la tabla de transiciones completa (se valida con los closers)

La tabla de arriba tiene los huecos que encontró la revisión del 22-sep (D2). La propuesta completa,
con cada transición justificada (T1 a T23, P, R, A1, A2), está en `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md` §2.5. **No se congela en código
hasta que los closers la validen.** Resumen de lo que cambia:

| # | Etapa | Siguientes propuestas |
|---|---|---|
| 1 | Pendiente Setteo | 2, 4, 10 |
| 2 | En Contacto | 4, 6, 7, 8, 9, 10 |
| 3 | Pendiente Re-agenda | 4, 5, 10 |
| 4 | Agendado | 3, 5, 10 (y 4 → 4 cuando la cita se mueve) |
| 5 | Atendido | 6, 7, 8, 9, 10 (y 5 → 5 con fecha de seguimiento) |
| 6 | Compromiso Verbal | 5 (retroceso con motivo), 7, 8, 9, 10 |
| 7 | Abonado | 8, 10; y vuelve a la etapa previa si se anula su único abono |
| 8 | Completo | **terminal**; vuelve a 7 solo si se anula un abono y reaparece saldo |
| 9 | Próxima Cohorte | 2, 4, 10 |
| 10 | Cierre Perdido | recuperable **solo hacia 2, 4 o 9**, con motivo |

- **Completo es terminal y no llega a Cierre Perdido:** un reembolso es otro flujo. Resuelve la
  contradicción de "Perdido desde las nueve" del "Done cuando" de arriba: Perdido es alcanzable desde
  las **ocho etapas abiertas** (1 a 7 y 9).
- **Los retrocesos son una segunda lista explícita** (6 → 5, A1, A2), no una excepción a la lista
  blanca.
- **Ninguna regla compara números de etapa** ("4 o más"): se nombran las etapas una por una.
- El test de las 100 combinaciones se conserva, sobre la tabla que quede.

---

## ✅ Decisión 2026-09-24 (Mani, se valida con los closers): Seguimiento y "un deal, muchas llamadas"

- **Seguimiento es una etapa propia (la 11)**, después de Atendido: la llamada ocurrió y hay que volver a
  contactarlo. Separa lo que salió bien (Compromiso, pago) de lo que hay que re-contactar. Reemplaza la
  propuesta anterior de "quedarse en Atendido con fecha". El `pgEnum` gana un valor (migración de la
  sesión principal). El número no es el orden: va después de Atendido.
- **Un deal tiene muchas llamadas y nunca se duplica.** Si una llamada falla (no-show, cancelada, u
  otra llamada necesaria), el deal pasa a Re-agenda **con motivo** (5 → 3 incluido). Una llamada nueva
  de un lead con deal abierto **se agrega y se avisa al dueño**; en 1, 2, 3, 9 u 11 el deal pasa a
  Agendado, en 5, 6 o 7 la etapa no cambia.
- **La conversión cuenta deals distintos** que llegaron a una etapa, no entradas: el ir y volver no infla.
- Transiciones nuevas: T24 (5 → 11), T25 (11 → 6), T26 (11 → 7 u 8), T27 (11 → 4), T28 (11 → 9), T29
  (5 → 3 con motivo); T11 queda reemplazada y T15 pasa a 6 → 11. Perdido llega también desde 11. Tabla
  completa en `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md` §2.5 y §2.6.
- **Reemplaza** lo dicho antes en este documento sobre "la segunda llamada no hace retroceder".

## ✅ Reunión con los closers 2026-09-24 ([reunión con los closers del 24-sep](../insumos/fleeting/2026-09-24-reunion-closers-crm.md), resumen en la propuesta §0)

- **Las 11 etapas quedan validadas** (incluida Seguimiento): nadie pidió quitar ni agregar. Ya no
  hace falta esperar a los closers para tomar este ticket.
- ✅ **Mani adoptó la tabla propuesta tal cual el 24-sep** (cierra D2). La tabla de arriba es la que se
  construye, incluidos T5, T7, T9, T14, T15, T17, T19-T21, T28, A1, A2 y R hacia 2, 4 o 9.
- ✅ **ADR 0053:** la "fecha prometida" de T12 y T25 es `deals.fecha_limite_pago`, no la primera cuota
  pactada. El requisito de Compromiso Verbal es producto + fecha límite de pago.
