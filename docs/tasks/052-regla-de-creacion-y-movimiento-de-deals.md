---
id: 052
etapa: E3
serves: "plan v2 §6 etapa 3 · tarea E3-5 · insumo §3.1, ADR 0037"
depends: [051, 045]
status: todo
---

# 052 — La regla de creacion y movimiento de deals del sync

## Objetivo

Que el sync cree y mueva deals segun el `estado` que trae la hoja, **llamando al motor de la etapa
2** y nunca escribiendo `deals.etapa` por su cuenta.

## La tabla (insumo §3.1)

| Evento del sync | Movimiento |
|---|---|
| `estado` = Setteo No Calificado, Lead **sin deal abierto** | crea deal en **Pendiente Setteo** |
| `estado` = Con Calendly, Lead **sin deal abierto** | crea deal en **Agendado** + Call `agendada` sin fecha, **Unclaimed** |
| `estado` = Con Calendly, Lead con deal en 1, 2 o 9 | **mueve a Agendado** + crea la Call (🩸 **9 casos medidos** de Setteo → Calendly que hoy nadie ve) |
| `estado` = Descartado o vacio | **no crea deal**; el Lead queda con su tag |
| re-envio del mismo Lead con deal en 4 o mas | **no mueve**; notifica al owner y guarda el envio |

## Alcance

- **Dentro:** la regla completa, como funcion que decide y delega.
- **Dentro:** la Call `agendada` sin fecha la crea el sync (su forma es el ticket 057).
- **Dentro:** la notificacion al owner cuando un deal avanzado recibe un re-envio (el dato; el
  canal es de la etapa 6).
- **Fuera:** validar transiciones o requisitos. Eso ya lo hace `moverEtapa()`.

## La regla que no se rompe

⚠️ **Ni una sola escritura de `deals.etapa` en este ticket.** El sync es uno de los tres escritores
que el ADR 0037 nombra; si implementa el requisito por su cuenta, diverge del closer y del dinero
**en silencio**. El guardian del ticket 046 lo caza, pero el criterio esta aqui.

## Done cuando

- [ ] Cada fila de la tabla de arriba tiene su test.
- [ ] Los 9 casos de Setteo → Calendly de `dev` producen el movimiento y **su fila de historial**.
- [ ] Un `estado` Descartado no crea deal, ni siquiera cerrado.
- [ ] `grep` confirma que este modulo no escribe `deals.etapa`.

## Kiro

Si, con revision.
