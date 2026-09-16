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
