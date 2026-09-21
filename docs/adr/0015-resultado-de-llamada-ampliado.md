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
