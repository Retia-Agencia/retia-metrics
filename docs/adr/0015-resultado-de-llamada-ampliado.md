# 0015 — La llamada dice qué pasó (ocho resultados); el motor decide qué significa para el deal

**Fecha:** 2026-09-16 · **Reescrito:** 2026-09-27 (consolida las enmiendas del 21 y el 24-sep y el
ADR retirado 0010) · **Estado:** aceptado; la regla de métricas del final es 🟡 propuesta

## Decidimos

**1. El resultado de una llamada es un tipo con ocho valores**, porque las métricas y el motor de
etapas deciden con él: `agendada`, `reagendada`, `cancelada`, `no_show`, `show`, `compromiso_pago`,
`cerrada`, `perdida`. `cancelada` (avisó antes) y `no_show` (no apareció) son distintos a propósito.

**2. Los motivos son catálogo** (`motivos`: dinero, horario, sin fit, viaje...), porque el equipo los
descubre sobre la marcha (ADR 0012).

**3. Una llamada cuelga de un deal** (`calls.deal_id`), no de una persona, y quien la hizo es una FK
a `users`. Un deal tiene todas las llamadas que haga falta y nunca se duplica. La única llamada sin
deal es la **suelta** que trae Calendly cuando no pudo emparejarla sin duda (ADR 0049).

**4. `show` no se teclea: sale de pegar el link de Grain.** Pegar el Grain es la afirmación de que la
llamada ocurrió. Para el caso raro de una llamada sin grabar existe marcar "sucedió". Los closers
confirmaron el 24-sep que graban todas.

**5. La llamada dice qué pasó; el motor decide qué significa.** Ningún resultado escribe la etapa por
su cuenta: todo pasa por `moverEtapa()` (ADR 0037).

| Resultado | Efecto en el deal |
|---|---|
| `agendada` | pasa a Agendado si estaba en Pendiente Setteo, En Contacto, Re-agenda, Próxima Cohorte o Seguimiento; en Atendido, Compromiso o Abonado se agrega y se avisa al dueño, sin cambiar la etapa |
| `reagendada` | la cita se movió antes de ocurrir: la llamada vieja queda `reagendada`, nace una nueva y el deal sigue en Agendado |
| `cancelada`, `no_show` | pasa a Pendiente Re-agenda, con ese motivo, si estaba en Agendado |
| `show` | pasa a Atendido |
| `compromiso_pago` | pasa a Compromiso Verbal (producto y fecha límite de pago, ADR 0053) |
| `cerrada` | pasa a Abonado o Completo **cuando se registra el abono**: la plata mueve la etapa |
| `perdida` | pasa a Cierre Perdido, con motivo |

La tabla completa de transiciones está en `docs/structure.md` (el motor de etapas).

## 🟡 Propuesta que falta cerrar

`compromiso_pago`, `cerrada` y `perdida` repiten lo que dicen las etapas 6, 7 y 10. Si se anula un
abono, la llamada sigue diciendo `cerrada` y el deal ya no está en Abonado: dos respuestas a la misma
pregunta. Regla propuesta: **el show se cuenta en las llamadas; el cierre se cuenta en los deals.**
Ningún % de cierre se calcula contando llamadas `cerrada`.
