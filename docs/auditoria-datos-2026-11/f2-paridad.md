# F2 — Paridad cruzada contra la base (ticket 385)

- **Fecha:** 7-nov-2026, 15:00 a 16:30 (Bogotá). **Base:** producción, solo lectura (`BEGIN READ ONLY`). Nada se escribió.
- **Privacidad:** solo conteos, montos e ids recortados.
- **Método:** `SELECT` escritos a mano sobre las tablas (`deals`, `deal_etapa_historial`, `calls`, `abonos`, `leads`, `submissions`), sin importar nada de `lib/queries/`. Se compararon contra los números dorados de `f0-linea-base.md` para los 4 programas activos en dos periodos: `mes_cerrado` (2026-10-01 a 2026-10-31) y `custom14` (2026-10-24 a 2026-11-06). `mes_en_curso` no se reconstruyó (misma consulta, otro rango).
- **Límite de independencia:** el SQL es independiente, pero la regla de venta (primera entrada a Abonado o Completo tras la última reversa, sin cortesías ni anulados) se tomó leyendo `metricas-filtros.ts`. Si esa regla fuera el error, esta prueba no lo vería. Lo que sí prueba: que cada superficie implementa esa regla sin desviarse.
- **Aviso de reloj:** el 7-nov se registraron 4 abonos después de la línea base (13:59 Bogotá el último). Ninguno cae en los dos periodos medidos.

## 1. Lo que cuadra exactamente

Ventas, valor vendido, caja (por moneda), agendas, canceladas, shows y leads dan **idénticos** a Hub, MCP y `consultar_metrica` en los 4 programas y los 2 periodos (32 cifras por programa y periodo, 0 diferencias). Students también: el recaudado de cada programa es la suma de abonos de ticket vigentes de sus ventas (Comunicarte 25.505, Confianza 3.946 USD; Tactical 20.425 más un abono de 375 registrado después de la línea base).

Con esto, **ninguna de las divergencias de abajo es un error de cálculo**: son definiciones distintas con el mismo nombre o con nombres distintos.

## 2. Divergencias

Escala: crítica, alta, media, baja. Clases del ticket: *dos conceptos con el mismo nombre* (A), *dos definiciones vivas* (B), *mismo concepto con dos nombres* (C), *dato faltante en la captura* (D), *esperado y mal explicado* (E).

| Id | Severidad | Clase | Qué | Cifras (octubre) | Hallazgo de F1 |
|---|---|---|---|---|---|
| F2-01 | **Alta** | A | **Caso 0 resuelto.** "Ventas" (17) y "% de cierre" (33,3 % = 11 ÷ 33) miden universos distintos con casi el mismo rótulo. De las 17 ventas de Tactical, **11 tienen una cita ocurrida en octubre** (entran al grupo) y **6 no tienen ninguna cita registrada** (ventas sin llamada). El grupo: 33 deals con cita ocurrida, 11 vendidos hoy. | Tactical: 17 contra 11 de 33 | H-01 |
| F2-02 | **Alta** | B | **"Leads" tiene tres universos con cifras muy distintas.** Hub: personas con `entrada = formulario` por `fecha_primera_aplicacion`. Lista Leads: sin filtro de entrada y con `coalesce(primera aplicación, created_at)`. Registros: envíos completos. | Comunicarte 927 / 1.108 / 985; Confianza **428 / 664 / 442 (+55 %)**; Tactical 764 / 932 / 809 | H-04 |
| F2-03 | Media | A | **"Agendas": por fecha de cita contra creadas.** Mismo rótulo en superficies distintas del mismo periodo. | Comunicarte 313 / 348; Confianza 108 / 123; Tactical 360 / 406 (+11 % a +14 %) | H-02 |
| F2-04 | Media | B | **"Cita sin resultado" excluye lo que el Hub no mira.** El Hub (`citaVencidaSinResultado`) deja fuera citas sin deal y de deals ya cerrados. Reconstrucción sin ese filtro: Confianza 38 contra 34 del Hub (3 en deals perdidos, 1 suelta); Tactical 304 contra 303 (1 en un deal ya completo). Es el subconteo que se infería en F1; la cita suelta sin resultado es justamente un dato por marcar y el Hub no la cuenta. | Confianza 34 / 38; Tactical 303 / 304 | H-07 |
| F2-05 | Media | E | **Cobertura del resultado de la cita.** La captura es el problema de fondo, no el predicado: Comunicarte 265 de 313 citas sin resultado; Tactical 303 de 360. Los % de show y de cierre salen sobre el 15 al 20 % restante, y el Hub los marca "parcial". | Comunicarte 85 %; Tactical 84 %; Confianza 31 % sin resultado | F3-02 |
| F2-06 | Baja | B | **Dinero: Hub contra Students.** Hoy coinciden porque no hay ventas sin valor vendido (0). La diferencia de tratamiento que describe H-05 (el Hub las excluye, Students suma su abonado) es **latente**: aparece con la primera venta sin valor. | Sin efecto hoy | H-05 |
| F2-07 | Baja | E | **Doc desfasado:** AGENTS.md y el ADR 0048 dicen "5 correos de 4.818 están en los dos programas". Hoy son **49 correos** con leads en más de un programa. Son dos leads distintos, como debe ser; lo que cambió es la magnitud que justifica el aviso `otrosProgramasDelCorreo`. | 49 correos | — |

### Reproducción

```sql
-- F2-01: las ventas del mes de un programa, clasificadas por su relación con citas
with mv as (select h.deal_id, min(h.fecha) f from deal_etapa_historial h
  join deals d on d.id=h.deal_id and d.program_id=:programa and not d.cortesia and d.anulado_en is null
       and d.etapa in ('ganado_parcial','ganado_completo')
  where h.a in ('ganado_parcial','ganado_completo') group by h.deal_id),
v as (select deal_id from mv where (f at time zone 'America/Bogota')::date between :desde and :hasta)
select case when count(c.id)=0 then 'sin cita'
            when bool_or(c.resultado in ('show','compromiso_pago','cerrada','perdida')
                 and (c.fecha_agenda at time zone 'America/Bogota')::date between :desde and :hasta) then 'cita ocurrida en el rango'
            else 'cita fuera del rango o sin ocurrir' end clase, count(*)
from v left join calls c on c.deal_id=v.deal_id and c.anulado_en is null group by v.deal_id;
-- F2-02: leads de dos maneras
select count(*) filter (where entrada='formulario' and (fecha_primera_aplicacion at time zone 'America/Bogota')::date between :desde and :hasta) hub,
       count(*) filter (where (coalesce(fecha_primera_aplicacion, created_at) at time zone 'America/Bogota')::date between :desde and :hasta) lista
from leads where program_id=:programa;
-- F2-04: citas pasadas sin resultado, por clase de deal
select case when c.deal_id is null then 'suelta' when d.etapa in ('ganado_parcial','ganado_completo','cierre_perdido') then 'deal cerrado' else 'deal abierto' end, count(*)
from calls c left join deals d on d.id=c.deal_id
where c.program_id=:programa and c.anulado_en is null and c.resultado='agendada' and c.fecha_agenda<now()
  and (c.fecha_agenda at time zone 'America/Bogota')::date between :desde and :hasta group by 1;
```

## 3. Casos adversariales: qué se pudo probar con producción

| Caso | Dato en producción | Resultado |
|---|---|---|
| Registros anulados | 2 abonos anulados (1.494 USD), 0 ventas anuladas, 0 abonos de deals anulados | Caja y ventas excluyen los anulados en las 3 superficies. **Cuadra.** |
| Reversa de venta (Abonado a etapa abierta) | 2 movimientos de reversa | Las ventas del periodo cuadran con la regla de reversa. **Cuadra.** |
| Borde de fecha, 7 p. m. a medianoche | 3 ventas cuyo día en Bogotá difiere del día en UTC | Ninguna cambia las cifras de los periodos medidos. **Cuadra.** |
| Mismo correo en dos programas | 49 correos | Los leads por programa cuadran; no se cruzan. **Cuadra.** (ver F2-07) |
| Venta que pasa de Abonado a Cierre Perdido | **0** | No hay datos: no se puede probar con producción. |
| Venta sin cohorte, sin valor vendido, sin abono vigente, cortesía vendida | **0** de cada una | Sin datos. Las rejas de escritura (N6) están funcionando. |
| Abonos en otra moneda, abono adicional, devolución | **0** (los 76 abonos son USD y de concepto ticket) | Sin datos: la conversión con TRM no se ejerce con ningún registro real. |
| Rango que cruza cohortes, cohorte cerrada sin `fechaInicioVentas` | No reconstruido | **Pendiente.** |

**Consecuencia para F6:** 7 de los 11 casos adversariales que pide el ticket no existen en producción. Solo se pueden probar con una base sembrada, no con un volcado. Esto respalda la decisión abierta 2 (números dorados sobre base sembrada determinista).

## 4. Lo que F2 no cubrió

Metas del mes y de la cohorte, Pauta y ROAS, gasto convertido, Origen, el reporte de WhatsApp y el semáforo, los CSV, Mi espacio, las otras 9 herramientas del MCP, los filtros por closer y por cohorte, y el periodo `mes_en_curso`. Son la siguiente tanda de F2 si Mani la quiere antes de F4; ninguna cifra principal del Hub, Dinero o Students la necesita.

## 5. Qué cambia para lo que sigue

- **F4/F5:** F2-01, F2-02 y F2-03 se resuelven con nombres y universos, no con cálculos: tres conceptos que hoy comparten rótulo (ventas, leads, agendas) necesitan un nombre cada uno. F2-04 pide una decisión: ¿la cita suelta sin resultado cuenta como "por marcar"?
- **Decisión abierta 4 (frenar pantallas nuevas):** ninguna cifra principal está mal calculada, pero tres rótulos conviven con dos significados; una pantalla nueva debe usar los nombres que fijen F4/F5.
- **Decisión abierta 5:** el 353 (show y cita sin resultado) sigue siendo el de mayor palanca, porque F2-04 y F2-05 salen de ahí.
