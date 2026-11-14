---
id: 390
etapa: hub
serves: "Auditoría 385 F3-02, F2-05, F2-04 · ADR 0115 N3, N6"
depends: [353]
status: en main
---

# 390 — Captura del resultado de la cita

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md) (plan F7 en [`docs/auditoria-datos-2026-11/f7-plan.md`](../auditoria-datos-2026-11/f7-plan.md)). Reglas: ADR 0115.

## Por qué

`calls.resultado` es `NOT NULL DEFAULT 'agendada'`, así que "agendada" y "no sé qué pasó" son el mismo valor. 730 citas pasadas siguen así (610 de octubre); en octubre solo 158 de 784 tienen resultado. Los % de show y de cierre salen sobre el 15 a 20 % restante y el Hub los marca "parcial". Es de captura, no de fórmula (F2-05). El 353 ya dejó el predicado en `lib/deals/resultados-de-llamada.ts` y unificó Inbox y bandera. A verificar antes de abrir: si F2-04 (la cita suelta sin resultado no cuenta como "por marcar" y las de deals ya cerrados quedan fuera: Confianza 34 contra 38) sigue vigente tras el 353; si no, queda solo la captura.

## Alcance

**Cubre:** F3-02, F2-05, F2-04 (residuo tras el 353), C-02 del 30-oct (cobertura del resultado).

**Archivos calientes** (donde chocan dos sesiones): `lib/deals/resultados-de-llamada.ts`, `components/` de acciones de llamada, `lib/queries/inbox.ts`, `lib/mi-espacio/notificaciones.ts`.

**Migración:** Ninguna, por decisión de F3 §1: "sin resultado" se deriva (`agendada` con `fecha_agenda` pasada).

## Fuera

Lo que pertenece a otro hijo del 385 (ver `docs/auditoria-datos-2026-11/f7-plan.md` §1: una causa, un ticket). Este ticket no migra conceptos del registro que no toca.

## Done cuando

- [x] Decisión de Mani registrada: ¿la cita suelta sin resultado cuenta como "por marcar"?
- [x] Un mecanismo de captura que empuje al closer a marcar (recordatorio en Mi espacio o la bandeja, con conteo por closer); no una reja que bloquee, porque un cobro real no se frena por un dato de configuración (misma lógica del ADR 0034).
- [ ] La cobertura sube medida: citas pasadas sin resultado por semana antes y después, por programa.
- [ ] El Hub dice "parcial" con base y faltan en toda razón que dependa del resultado (cierra con el 351).
- [x] **(Enmienda 13-nov.) Los dos guardianes que el contrato sigue listando como "solo propuestos"** para este concepto
  (`docs/contrato-metricas-y-datos.md`, "Pendientes (🟡)", puntos 1 y 2; H-4 de
  `docs/reportes/revision-hub-metricas-mcp-2026-11-13.md`):
  1. **Un guardián por concepto para show ("ocurrió") y para cita sin resultado.** Molde: `tests/venta-una-definicion.test.ts`
     y `tests/sin-utm-guardian.test.ts`. Recorre `lib/`, `app/`, `components/` y `scripts/` y falla si alguien reescribe el
     predicado fuera del módulo dueño, el que nombra la tabla "Conceptos" de `docs/metricas.md` §0 (medido el 13-nov:
     `ocurrioSql` y `noAsistioSql` en `lib/deals/resultados-de-llamada.ts`; `citaVencidaSinResultado` en
     `lib/queries/metricas-filtros.ts`, con su gemela `citaCuentaComoPorMarcar`). Olores a cazar: comparar
     `calls.resultado` contra `"show"` o `"agendada"` a mano, o `fecha_agenda < now()` suelto. Excepciones nombradas con su razón;
     mordido en los dos sentidos.
  2. **Números dorados de Hub › Comercial:** citas, realizadas, no asistió, sin resultado, asistencia, cierre de ventas y cita a
     venta, sobre una base sembrada a mano con los casos que las harían divergir (cita futura, cita pasada sin marcar, reagendada,
     cortesía, deal anulado con llamada vigente, llamada suelta, otro programa). Molde: `tests/numeros-dorados-pauta.test.ts`.
     El mismo dorado se compara contra `resumen_del_hub` del MCP y contra el texto del semáforo de WhatsApp donde aplique: tres
     superficies, un número.
  Al cerrarlos, pasar esas dos líneas de 🟡 a 🔒 en `docs/contrato-metricas-y-datos.md` en el mismo commit.
  13-nov: hecho en tests/show-y-sin-resultado-guardian.test.ts y tests/numeros-dorados-comercial.test.ts. Hallazgo: deuda que reescribe el predicado en `components/dashboard/hoy/citas.tsx`, `lib/queries/dashboard.ts`, `lib/queries/proyeccion-roas.ts` y `lib/queries/tasas-del-grupo.ts`; Hub y MCP no difieren en el dorado, y el semáforo no pinta estas cifras.
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y el ADR afectado quedan reescritos en el mismo commit, título e índice incluidos.
- [x] Registro: ficha de `citas_pendientes` y `llamadas_sin_resultado` en `lib/metricas/registro.ts` y su línea borrada de `lib/metricas/pendientes.ts` con `TOPE_DE_PENDIENTES` bajado.

**9-nov (revisión N9):** quedan abiertas la 3.ª casilla (medir la cobertura antes y después: hay que esperar semanas de uso del chip) y la 4.ª (el Hub dice «parcial» en toda razón que dependa del resultado: cierra con el 351). Por eso NO es `done`.

**13-nov, cobertura medida (solo lectura a producción; citas vigentes con `fecha_agenda` pasada, semana de Bogotá; % con resultado = `resultado` distinto de `agendada`).** El chip entró el 7-nov (`c8944917`), así que la semana del 9-nov es la única con el chip y todavía no madura (la gente marca días después).
| Programa | 5-oct | 12-oct | 19-oct | 26-oct | 2-nov | 9-nov |
|---|---|---|---|---|---|---|
| Comunicarte | 27 % de 88 | 24 % de 80 | 22 % de 76 | 19 % de 67 | 12 % de 50 | 10 % de 48 |
| Tactical Investor | 35 % de 69 | 30 % de 96 | 20 % de 83 | 5 % de 94 | 10 % de 59 | 8 % de 80 |
| Comunícate con Confianza | 100 % de 2 | 57 % de 7 | 68 % de 57 | 67 % de 49 | 76 % de 37 | 30 % de 27 |
Lectura: **no hay subida medible todavía**; Comunicarte y Tactical siguen en 8 a 12 % en las semanas recientes y las más viejas tienen más resultado solo porque tuvieron más tiempo. Confianza ya marcaba. La casilla 3 sigue abierta: repetir la consulta hacia el 21-nov (dos semanas con el chip) y comparar la semana del 2-nov contra la del 16-nov. Consulta: citas por `program_id` y `date_trunc('week', fecha_agenda at time zone 'America/Bogota')`, `anulado_en is null`.

## Para Alejo (carril P), 14-nov: el «parcial» del Hub (casilla 4)
**Qué falta.** `lib/queries/tasas-del-grupo.ts` ya devuelve `razonShow` con base, faltan y `estadoDeCobertura` (ticket 351, probado en `tests/tasas-del-grupo.test.ts`), y el MCP conserva `{valor, cobertura}`. Lo que no está comprobado es que **toda razón del Hub que dependa del resultado de la cita** (asistencia, % de show, cierre de ventas, cita a venta, ROAS que usa ventas con cita) se pinte en pantalla con «parcial · N de M» o «—» y nunca el número a secas, **en las pantallas nuevas del 419 E-3** (Comercial, Dinero, Hoy), que son tuyas.
**Cómo.** Al pasar cada pestaña a la Cifra (E-3), la cifra recibe su `RazonConCobertura` (`lib/cobertura.ts`) y la Cifra muestra la cobertura; agregar a tu test de la pestaña un caso con 3 de 10 citas resueltas que espere «parcial» con base y faltan.
**Cierra.** La casilla 4 de este ticket y la 351. Hoy la cobertura es baja (Comunicarte y Tactical 8 a 12 % con resultado), así que **se va a ver «parcial» en casi todo hasta que suba la captura**: es lo correcto, no un error.
