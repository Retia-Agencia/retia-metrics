---
id: 397
etapa: hub
serves: "Auditoría 385 F2-01 a F2-03, H-01 a H-11, H-24 · alcance 3 del 354 · ADR 0115 N4"
depends: [389, 390, 392, 393]
status: done
---

# 397 — Un nombre por concepto: glosario y rótulos

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md) (plan F7 en [`docs/auditoria-datos-2026-11/f7-plan.md`](../auditoria-datos-2026-11/f7-plan.md)). Reglas: ADR 0115.

## Por qué

Tres conceptos compartían rótulo con dos universos (ventas contra Cierre de ventas, leads y envíos, citas y citas agendadas) y el vocabulario solo lo usaban Hoy, Dinero y Metas; la lista detrás de la cifra, Comercial, Pauta, Origen, Mi espacio, WhatsApp y MCP tenían rótulos propios (H-24). Mani decidió que el Objetivo de leads por día se mide contra Leads (personas distintas del día), no contra Envíos.

## Alcance

**Cubre:** F2-01, F2-02, F2-03; H-01 a H-06, H-09 a H-11; la columna "Valor" del CSV de deals (que es `leads.lead_value`); **alcance 3 del 354** (decisión de Mani del 7-nov: dos cifras con nombre propio, "Envíos" por `hechos/envio.ts` y "Leads" por personas; `leadsDelRango` deja de llamarse así en pantalla).

**Archivos calientes** (donde chocan dos sesiones): `lib/vocabulario-metricas.ts`, `docs/overview.md` §11, `app/(app)/p/[programa]/hub/lista/page.tsx` (mapa `titulos`), `components/dashboard/operacion.tsx`, `lib/reporte-whatsapp/mensaje.ts`, `lib/mcp/herramientas/metricas.ts`, `lib/deals/deals-para-csv.ts`.

**Migración:** Ninguna.

## Fuera

Lo que pertenece a otro hijo del 385 (ver `docs/auditoria-datos-2026-11/f7-plan.md` §1: una causa, un ticket). Este ticket no migra conceptos del registro que no toca.

## Done cuando

- [x] Cada concepto con dos universos lo dice en su nombre ("Ventas del periodo" contra "Vendidas del grupo con cita", y Envíos, Leads y Agendas con su universo), en glosario, pantallas, WhatsApp y MCP.
- [x] El mapa `titulos` de la lista sale del vocabulario; no queda un literal con número fuera de él.
- [x] `rotulos-sinonimos-guardian` pasa de "ningún sinónimo nuevo" a "solo el nombre canónico" y vacía sus excepciones.
- [x] "Valor" del CSV de deals deja de ser `lead_value` o se renombra.
- [x] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y N4 del ADR quedan reescritos en el mismo commit. El título y el índice no cambian porque la regla N4 sigue siendo la misma; cambian sus nombres canónicos y superficies.
- [x] Registro: ficha de `registros`, `leads`, `agendadas`, `citas`, `shows`, `no_asistio`, `asistencia` y `cierre_de_ventas` en `lib/metricas/registro.ts` y su línea borrada de `lib/metricas/pendientes.ts` con `TOPE_DE_PENDIENTES` bajado.

## Pendiente

`leads_que_hacen_falta` y la proyección conservan su cálculo sobre Envíos. Este ticket solo cambia la ficha Objetivo de leads para compararla contra Leads (personas distintas); alinear la proyección requiere otra decisión y otro ticket.
