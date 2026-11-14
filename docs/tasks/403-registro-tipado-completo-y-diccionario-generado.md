---
id: 403
etapa: hub
serves: "Auditoría 385 H-29 · docs/contrato-metricas-y-datos.md §8 · ADR 0120"
depends: [397, 389, 390, 391, 404, 392, 393, 351, 355]
status: done
---

# 403 — Registro tipado completo y diccionario generado

Hijo del [385](./385-mcp-integridad-de-tools-de-metricas.md) (plan F7 en [`docs/auditoria-datos-2026-11/f7-plan.md`](../auditoria-datos-2026-11/f7-plan.md)). Reglas: ADR 0115.

## Por qué

El ADR 0120 dejó un esqueleto con 5 conceptos y 35 pendientes. Cada hijo migra los suyos; este cierra el resto.

**Absorbe el 413 (Mani, 10-nov).** El audit total del Hub, la parte gerencial y Pauta (`docs/paid-media-excels-2026-11-10.md` §9) vive
aquí y no en un ticket aparte. La F0 (medición) está en [`docs/audit-hub-2026-11-10.md`](../audit-hub-2026-11-10.md) y mostró dos
cosas que el alcance original no cubría: (1) el trinquete vigila solo el vocabulario del Hub (43 claves), y la tabla semanal de Pauta,
el semáforo y la mitad del MCP quedan fuera; (2) el registro dice qué función define cada cifra, pero nada obliga a una superficie a
usarla, y por eso la tabla de Pauta calcula show, cierre y agenda → venta por su cuenta (I-1) y hay dos ROAS con el mismo rótulo (I-2).

**Fases:** F0 medir (**cerrada el 10-nov**: inventario de las cuatro superficies, I-1 a I-8 medidos, paridades, y `pauta_roas` del MCP arreglado con su test) · F1 decisiones de Mani (D-A a D-D del audit, con N8) · F2 ampliar el vocabulario a Pauta,
semáforo y MCP, subiendo el tope a la vista · F3 un guardián de consumo: un test de paridad por concepto que corre todas las
superficies que lo muestran sobre una base sembrada con los casos que las harían divergir (N2) · F4 fichas, dorados y retiro de lo
muerto · F5 cierre.

## Alcance

**Cubre:** H-29, contrato §8 puntos 1 a 4 (registro contra diccionario, un guardián por concepto, dorados ampliados, endurecer los guardianes), y el §9 de `docs/paid-media-excels-2026-11-10.md` (ex 413).

**Archivos calientes** (donde chocan dos sesiones): `lib/metricas/registro.ts`, `pendientes.ts`, `docs/metricas.md` §3.0 y §3.1, `tests/registro-de-metricas.test.ts`.

**Migración:** Ninguna.

## Fuera

Lo que pertenece a otro hijo del 385 (ver `docs/auditoria-datos-2026-11/f7-plan.md` §1: una causa, un ticket). Este ticket no migra conceptos del registro que no toca.

## Done cuando

- [x] `PENDIENTES_DE_REGISTRO` vacío y `TOPE_DE_PENDIENTES` en 0; el trinquete se retira o queda en 0. *(10-nov: el registro se indexa por `ClaveDeConcepto = ClaveDeMetrica | ClaveDePauta`; 10 fichas de Pauta con el hecho `gasto`, 13 del Hub con `parametro`/`plan`/`deal`; tabla semanal y objetivos apuntan a una ficha; tope total 29 → 0, `tests/registro-de-metricas.test.ts` en verde.)*
- [x] §3.1 de `docs/metricas.md` sin las columnas que ya genera §3.0. *(10-nov: Métrica, Fórmula, Estado; el test lo vigila.)*
- [x] Números dorados ampliados a gasto y ROAS, semáforo y CSV, sobre base sembrada. *(10-nov: `tests/numeros-dorados-pauta.test.ts`, esperados escritos a mano: inversión, agendas, costo por agenda del Hub (CRM) y del semáforo (Meta), ROAS, profit, CPM, CTR, landing, frecuencia y las celdas del CSV. «Semáforo» es el costo por agenda de la ventana; el texto de WhatsApp sigue en `tests/semaforo-endpoint.test.ts`.)*
- [x] Un guardián por concepto que hoy no lo tiene: show y ocurrió, cita sin resultado, lead y registro, agenda, "sin UTM". *(10-nov: show/ocurrió y cita sin resultado ya los cubría el guardián N1 de `tests/resultados-de-llamada.test.ts`; agenda, el de `tests/agendas-una-pregunta.test.ts`; nuevos `tests/lead-y-registro-guardian.test.ts` y `tests/sin-utm-guardian.test.ts`, mordidos en los dos sentidos, con 4 y 9 excepciones nombradas y con razón; dos son deuda real: `inbox-perdidos-en-calendly.tsx` e `inbox-sin-dueno.tsx` infieren «Sin UTM» de tres campos nulos.)*
- [x] Funciones inexistentes o sin llamador de H-29 (`tasaDelDia`, `hechos/abono.ts`, `hechos-embudo.ts`, `embudoPorCanal`, `dealsPerdidosPorMotivo`, `periodoAnterior`, `colorDeCupos`) borradas o con su llamador. *(10-nov: `hechos/abono.ts` retirado; las otras seis ya no existían, grep limpio.)*
- [x] Ex 413: toda cifra visible del Hub, `/hub`, MCP, WhatsApp, CSV y PDF con sus cinco columnas en el audit (rótulo, función, fila de `metricas.md`, clave, test, lista); I-1 a I-8 con decisión escrita.
- [x] Cada clave de los cuatro vocabularios (Hub, tabla semanal de Pauta, semáforo y objetivos, MCP) tiene ficha, o está en el trinquete con el tope a la vista.
- [x] Un test de paridad por concepto que compara todas las superficies que lo muestran; con I-1 sin arreglar, el de show y cierre falla. *(10-nov: show, cierre, ROAS y costo por agenda en `tests/paridad-pauta-comercial.test.ts`; show, agenda y cita sin resultado en `tests/resultados-de-llamada-paridad.test.ts`; lead, Hub contra MCP, en `tests/lead-y-registro-paridad.test.ts` (y cifra contra lista en `metricas-con-filas`); registros en `tests/lista-de-envios.test.ts`; «sin UTM», SQL contra TypeScript, en `tests/atribucion-canal-sql.test.ts`.)*
- [x] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y el ADR afectado quedan reescritos en el mismo commit, título e índice incluidos.

**Estado al 10-nov (cierre).** Todas las casillas están marcadas (arriba, con su evidencia). Hechas: F0 a F5: audit, D-A a D-E, vocabulario único, trinquete en 0, dorados de Pauta, guardianes de lead/registro y «sin UTM», paridad por concepto. **Migración 0133 aplicada en producción el 10-nov** (con el ok de Mani): el enum `metrica_objetivo` ya no tiene `agendas_por_dia`, `costo_por_lead` ni `costo_por_venta`, y el CHECK de moneda incluye `inversion`. **Falta solo el checkpoint verde y su tag** para poner `status: done` (N9: el tracker y el archivo cambian juntos). **Deuda nombrada:** `inbox-perdidos-en-calendly.tsx` e `inbox-sin-dueno.tsx` infieren «Sin UTM» de tres campos nulos (se corrige con el guardián de «sin UTM» a la vista). El Hub de todos los programas con la Pauta vieja pasó al ticket [422](./422-hub-de-todos-los-programas-pauta.md). El traspaso de los textos de Alejandro (`explicaciones-de-pauta.ts` → fichas) se hace cuando su 419 ya no use el puente.
