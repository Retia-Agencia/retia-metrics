# 0015 — El resultado de llamada suma compromiso_pago y cancelada; los motivos son catalogo

**Fecha:** 2026-09-16

Los reportes diarios de Retia (1 al 15 de septiembre) giran sobre dos situaciones que los seis
resultados actuales no pueden expresar:

- **Compromiso de pago:** la persona se presento, quiere entrar y promete pagar en una fecha
  ("1 compromiso de pago para el 25 de septiembre"). No es `cerrada` (no hay venta) ni `perdida`.
- **Cancelada:** la persona aviso antes que no llegaba ("cancelo el meet"). No es lo mismo que
  `no_show`, donde simplemente no aparecio.

**Decidimos ampliar `resultado_llamada`** (decision de Mani, 16 de septiembre):

| Resultado | Cuenta como show | Exige |
|---|---|---|
| `agendada` | no | |
| `show` | si | |
| `no_show` | no | |
| `cancelada` | no | |
| `reagendada` | no | `fechaSeguimiento` |
| `compromiso_pago` | si | `fechaSeguimiento` |
| `cerrada` | si | datos de venta + primer abono |
| `perdida` | segun el caso | `motivoId` |

Es un **tipo** (ADR 0012) porque las metricas de show y de cierre dependen de estos valores.

**Los motivos** (dinero, horario, sin fit, viaje, otro programa, sin respuesta...) **no** son
enum: son el catalogo `motivos` (instancia, ADR 0012), porque el equipo los descubre sobre la
marcha y el reporte los agrupa.

## Consecuencias

- `calls` suma `fechaSeguimiento` (timestamp, nullable) y `motivoId` (FK a `motivos`, nullable).
  `calls.motivoPerdida` (texto) queda solo para filas viejas de Sheets.
- La validacion zod del registro exige los campos de la tabla segun el resultado.
- La regla de negocio "show se deriva del resultado" de `context.md` se actualiza con
  `compromiso_pago`.

## Enmienda 2026-09-21 (plan v2, ADR 0037): los ocho resultados se conservan; la llamada cambia de padre

**Los ocho valores de `resultado_llamada` se conservan tal cual**, y siguen siendo un **tipo**: las
metricas de show y de cierre dependen de ellos. Los motivos siguen siendo catalogo.

Lo que cambia es **de que cuelga una llamada y que produce cada resultado**:

- `calls.person_id` pasa a `calls.deal_id`. Una llamada es de una **oportunidad**, no de una
  persona (ADR 0037). Una persona con dos deals tiene las llamadas de cada uno separadas, que es lo
  que hoy no se puede representar.
- **`agendada` la crea el sistema**, sin fecha, cuando el sync trae `estado = Con Calendly`
  (insumo §3.1). El closer la completa con el link de Calendly y la fecha al reclamar el deal.
- **`show` deja de teclearse: sale de pegar el link de Grain.** Pegar el Grain **es** la afirmacion
  de que la llamada sucedio: pone `resultado = show`, llena `fecha_llamada` si estaba vacia y mueve
  el deal a **Atendido**.
- **`no_show` y `cancelada` mueven el deal a Pendiente Re-agenda.** Siguen siendo dos resultados
  distintos por la razon original (aviso antes ≠ no aparecio), y ahora ademas los dos disparan el
  mismo movimiento.
- ⚠️ **Ningun movimiento de etapa se escribe aqui.** Todos pasan por `moverEtapa()` (ADR 0037): la
  llamada dice que paso, el motor decide que significa. Si el resultado moviera la etapa por su
  cuenta, habria dos implementaciones del mismo requisito, que es el bug del ADR 0024.
- `calls.fechaSeguimiento` se conserva y sigue siendo el dato que necesitaria un recordatorio.

---

## 🟡 Nota 2026-09-24: qué le hace cada resultado al deal (propuesta, se valida con los closers)

La tabla completa de transiciones propuesta está en el ticket 043 y en
`docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md` §2.5 y §2.6. Lo que toca a este ADR:

- `reagendada` (la cita se mueve antes de ocurrir) **no mueve el deal**: la Call vieja queda
  `reagendada` y nace una Call nueva con fecha.
- `no_show` y `cancelada` mueven a Pendiente Re-agenda **solo si el deal está en Agendado**. En una
  segunda llamada sobre un deal ya Atendido, marcan la Call y el deal no retrocede.
- `compromiso_pago`, `cerrada` y `perdida` repiten lo que dicen las etapas 6, 7 y 10. Regla propuesta:
  **el show se cuenta en las llamadas; el cierre se cuenta en los deals** (ADR 0037: una venta es un
  deal en Abonado o Completo). Ningún % de cierre se calcula contando llamadas `cerrada`.
- Después de pegar el Grain, el closer elige una de cinco salidas: pagó ahora, compromiso,
  seguimiento (se queda en Atendido con fecha), próxima cohorte o perdido. No existe "no cerró" sin
  decir qué sigue.

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
