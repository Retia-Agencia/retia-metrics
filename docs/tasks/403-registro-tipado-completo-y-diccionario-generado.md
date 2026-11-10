---
id: 403
etapa: hub
serves: "Auditoría 385 H-29 · docs/contrato-metricas-y-datos.md §8 · ADR 0120"
depends: [397, 389, 390, 391, 404, 392, 393, 351, 355]
status: en curso
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

- [ ] `PENDIENTES_DE_REGISTRO` vacío y `TOPE_DE_PENDIENTES` en 0; el trinquete se retira o queda en 0.
- [ ] §3.1 de `docs/metricas.md` sin las columnas que ya genera §3.0.
- [ ] Números dorados ampliados a gasto y ROAS, semáforo y CSV, sobre base sembrada.
- [ ] Un guardián por concepto que hoy no lo tiene: show y ocurrió, cita sin resultado, lead y registro, agenda, "sin UTM".
- [ ] Funciones inexistentes o sin llamador de H-29 (`tasaDelDia`, `hechos/abono.ts`, `hechos-embudo.ts`, `embudoPorCanal`, `dealsPerdidosPorMotivo`, `periodoAnterior`, `colorDeCupos`) borradas o con su llamador.
- [ ] Ex 413: toda cifra visible del Hub, `/hub`, MCP, WhatsApp, CSV y PDF con sus cinco columnas en el audit (rótulo, función, fila de `metricas.md`, clave, test, lista); I-1 a I-8 con decisión escrita.
- [ ] Cada clave de los cuatro vocabularios (Hub, tabla semanal de Pauta, semáforo y objetivos, MCP) tiene ficha, o está en el trinquete con el tope a la vista.
- [ ] Un test de paridad por concepto que compara todas las superficies que lo muestran; con I-1 sin arreglar, el de show y cierre falla.
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y el ADR afectado quedan reescritos en el mismo commit, título e índice incluidos.
