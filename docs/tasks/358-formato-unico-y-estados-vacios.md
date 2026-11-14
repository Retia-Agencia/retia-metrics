---
id: 358
etapa: hub
serves: "ADR 0115 N5 (formato) · auditoría 30-oct G-09, G-10, G-12, R-12, U-04, U-13, U-20, U-22"
depends: [374]
status: todo
---

# 358 — Formato único, insignias únicas y la regla del vacío

> **Enmendado el 3-nov (fase 2):** la parte del Hub (formato y regla del vacío en el Hub y sus listas) la hace el [374](./374-el-hub-habla-un-solo-idioma.md). Aquí queda el resto: WhatsApp, Mi espacio, listas operativas, insignias de calidad (DA-7).

Auditoría: [`docs/auditoria-metricas-2026-10-30.md`](../auditoria-metricas-2026-10-30.md). Reglas: ADR 0115.

## Por qué

- **G-12:** "62,5%" (`pct`) contra "5,00 %" (`programa/page.tsx:360`, `operacion.tsx:19`); "COP 1.234" contra "1.234 COP"
  (`objetivos-de-la-cohorte.tsx:74`) contra "$1.234 COP" (WhatsApp); ROAS sin unidad; cuatro helpers locales de
  porcentaje; "—", "0", "Sin dato", "sin pauta", "Ninguno por ahora" sin regla.
- **G-09:** el resultado de llamada vive en dos mapeos (`lib/deals/estado-de-llamada.ts` y `lib/queries/llamadas.ts:30`)
  y sale "No-show" con guion en `operacion.tsx:125`.
- **G-10:** la calidad del lead tiene tres nombres ("Calidad", "Estado de llegada", `calificacion`) y tres variants de
  badge (`neutro`, `info`, `secondary`), en inglés crudo.
- **U-20:** el semáforo imprime el enum crudo (`problema`) en un badge y "09h".

## Decisión abierta

- **DA-7:** ¿High/Mid/Low se traducen? Viene así del formulario; decide Gerencia.

## Alcance

1. `pct`, `usd`, `cop`, `razon` (con "×") y `fecha`/`hora` de `lib/format.ts` como única forma de escribir esos datos,
   también en WhatsApp. Se borran los helpers locales.
2. La regla del vacío (N5) en `docs/structure.md` §9 y en un componente: "—" no se puede calcular, "0" es cero, "Sin
   datos" aún no hay periodo medido.
3. Un mapeo por dominio en `lib/` (resultado de llamada, semáforo, tipo de nota) y `<InsigniaDeCalidad>` en
   `components/leads/`, usados en todas las pantallas.
4. Guardián: un helper local de porcentaje o moneda, o un segundo `Record<Resultado, string>`, falla.

## Done cuando

- [ ] `tests/format.test.ts` cubre `razon` y la regla del vacío.
- [ ] Guardián mordido en los dos sentidos.
- [ ] Recorrido: la calidad se ve igual en Leads, Deals y la ficha; el semáforo con el mismo vocabulario en UI y WhatsApp.
- [x] **(Enmienda 13-nov; hecho el 14-nov, `13bb32d8`.) El mensaje de WhatsApp consume el registro de métricas, y un test lo exige.** Es el punto 4 de
  "Pendientes (🟡)" de `docs/contrato-metricas-y-datos.md` (H-4 de `docs/reportes/revision-hub-metricas-mcp-2026-11-13.md`): la
  Cifra y el MCP ya leen `lib/metricas/registro.ts`; `lib/reporte-whatsapp/` no (medido el 13-nov: `mensaje.ts` no importa ni el
  vocabulario ni el registro; `horas-de-agenda.ts` solo una constante de explicación). Alcance:
  (a) cada cifra del mensaje toma su rótulo de `lib/vocabulario-metricas.ts` y su formato de `lib/format.ts`; (b) un test recorre
  las métricas encendidas del contrato (`lib/reporte-whatsapp/contrato.ts`) y falla si una no apunta a un concepto registrado
  (molde: `CONCEPTO_DE_OBJETIVO` en `lib/metricas/pendientes.ts`, exhaustivo en compilación); (c) un dorado: el mismo día
  sembrado da el mismo número en el mensaje y en Hub › Pauta. **Ojo, decisión de Mani del 10-nov (DM-1):** el reporte de
  WhatsApp no cambió de palabras cuando el semáforo pasó a En meta / En seguimiento / Rezagado. Si este ticket las unifica, es
  un cambio visible para el grupo: se confirma con Mani antes y se coordina con Juanito, que manda el texto tal cual.
- [x] **(Enmienda 13-nov; hecho el 14-nov, `f8ded346`.) El título del ADR que cita una fila de `docs/metricas.md` coincide con el título del ADR.** Punto 3 de
  los pendientes del contrato (hoy revisión manual). Test chico: para cada fila que cite "ADR NNNN", el archivo existe en
  `docs/adr/` y no está en el índice de retirados.
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y cualquier ADR que cambie quedan reescritos en el mismo commit, título e índice incluidos.

**14-nov (avance, sin cerrar casillas).** Hechos los dos tests que no necesitan decisión: `tests/reporte-whatsapp-registro.test.ts` (con `lib/reporte-whatsapp/conceptos.ts`: hoy el semáforo enciende una sola métrica tipada, `costo_por_agenda` → `costo_agenda_crm`; gasto y agendas del mensaje aún no son métricas con clave) y `tests/adr-de-las-filas.test.ts` (ningún ADR citado en `docs/metricas.md` falta ni está retirado). Siguen abiertas: (a) rótulos y formato del mensaje desde el vocabulario y `lib/format.ts` (cambio visible: confirmar con Mani y coordinar con Juanito) y (c) el dorado mensaje = Hub › Pauta.

**14-nov, DM-1 para confirmar con Mani:** hoy el mensaje de WhatsApp pinta 🟢🟡🔴 y "verde/amarillo/rojo" (`lib/reporte-whatsapp/mensaje.ts:8-16`), y el Hub dice En meta / En seguimiento / Rezagado (DM-1 del 10-nov). Unificar es un cambio **visible para el grupo**; Juanito manda el texto tal cual, así que no hay cambio en su código. Brief: `docs/agents/briefs-codex-14-nov.md`, B-3.

**14-nov, DM-1 resuelta por Mani:** **el mensaje de WhatsApp conserva 🟢🟡🔴 y Juanito sigue mandándolos.** No se cambian los rótulos de estado del mensaje. El Hub ya usa color por tono (`Badge` con `exito`, `alerta`, `peligro`) más las palabras En meta / En seguimiento / Rezagado: no hay nada que cambiar allá. Del 358 queda solo el formato (`lib/format.ts`), los nombres de las cifras desde el vocabulario y el dorado mensaje = Hub › Pauta.

**14-nov (tarde), la parte WhatsApp está hecha (`13bb32d8`, `f939b581`→`main`).**
- `lib/reporte-whatsapp/mensaje.ts`: el helper local `dinero()` ya no existe; dinero con `cop()` («COP 300.000», antes «$300.000 COP»), cantidades con `num()`, porcentaje con `pct()`, vacío «—» (antes «sin dato»). Rótulos desde el vocabulario: «Inversión», «Agendas según Meta», «Agendadas» (las del CRM) y «Costo por agenda (según Meta)». Los 🟢🟡🔴 y «verde/amarillo/rojo» NO cambiaron (DM-1).
- `lib/reporte-whatsapp/conceptos.ts`: además de la tabla del semáforo, `CONCEPTO_DE_CIFRA_DEL_REPORTE` (gasto → `inversion`, `agendas_meta` → `agendas_meta`). `tests/reporte-whatsapp-registro.test.ts` las valida.
- Dorado: `tests/numeros-dorados-whatsapp.test.ts` (molde `numeros-dorados-pauta`): el mismo día sembrado da el mismo gasto, agendas Meta, agendas CRM y costo por agenda en el mensaje y en `cargarPautaSemanal`.
- **Decisión de Mani (14-nov): el costo por agenda del semáforo es con las agendas de Meta (ADR 0088, enmienda del 16-oct).** El registro lo llamaba `costo_agenda_crm`, contra lo que se calcula (`costoPorAgendaDeVentana`, gasto ÷ agendas Meta). Corregido en `lib/reporte-whatsapp/conceptos.ts` y `CONCEPTO_DE_OBJETIVO.costo_por_agenda` (`lib/metricas/pendientes.ts`) → `costo_agenda_meta`. Ningún número ni color se movió. El costo por agenda del CRM sigue siendo otra métrica (`costo_agenda_crm`, Hub › Pauta, fila «General»).
- **Literales que el mensaje sigue escribiendo a mano porque no hay entrada de vocabulario equivalente:** «registros Meta», «reg» y «CPL» (bloque Lanzamiento), «Meta» / «aceptable» (umbrales), «Pausadas con gasto», «Trayectoria». Si se quiere cerrar del todo (a), hay que decidir sus nombres en `lib/vocabulario-metricas.ts`.
**Lo que SIGUE abierto del 358 (nada de esto es WhatsApp):** `tests/format.test.ts` con `razon` y la regla del vacío; el guardián de helpers locales de porcentaje/moneda y de un segundo `Record<Resultado, string>`; `<InsigniaDeCalidad>` y el mapeo de resultado de llamada/semáforo/tipo de nota por dominio; Mi espacio y listas operativas; DA-7 (¿High/Mid/Low se traducen?, decide Gerencia); la regla del vacío en `docs/structure.md` §9; la casilla del recorrido. La parte del Hub la hace el 374.
