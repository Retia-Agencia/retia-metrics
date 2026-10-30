---
id: 352
etapa: hub
serves: "ADR 0115 N1, N2 · auditoría 30-oct C-07, C-08, C-12, C-17, C-18, R-03, R-09"
depends: []
status: todo
---

# 352 — La venta tiene una definición, y la cohorte una cuenta

Auditoría: [`docs/auditoria-metricas-2026-10-30.md`](../auditoria-metricas-2026-10-30.md). Reglas: ADR 0115.

## Por qué

- **C-07 / R-03:** "venta" se cuenta con tres reglas: por evento (`ventasConDiaEn`/`vendidosEn`, historial), por evento +
  etapa actual (`ventasDeCohorte`, `dashboard.ts:708`; `alertas.ts:144`) y solo por etapa actual (`tasas-del-grupo.ts:150`,
  `estudiantes.ts`). Hoy coinciden porque ningún vendido se ha perdido; el primero que pase a Cierre Perdido seguirá
  contando en Mes, Ventas, comisión y escalera, y no en la cohorte ni en el % de cierre.
- **C-08:** ComunicArte C3: Cupos › Cohorte cuenta 32 y Proyección 27 en la misma pantalla (5 ventas anteriores a
  `fecha_inicio_ventas`; Cupos no tiene límite inferior, `proyeccion.ts:~430` sí).
- **C-12:** el cumplimiento de "Cupos del día" divide las ventas de hoy por una meta que ya las descontó: sube sin tope.
- **R-09:** "faltan ÷ días hábiles" y el cumplimiento lineal se calculan tres veces, con bordes distintos (desde hoy o
  desde mañana; el último día da el faltante entero en una y "no disponible" en otra).
- **C-17 / C-18:** `MUESTRA_MINIMA_CONVERSION = 20` y `DIAS_PARA_MADURAR = 30` en código; "leads requeridos por día"
  divide agendas de la cohorte entre registros del programa entero.

## Decisiones abiertas (frenan el ticket hasta que Mani decida)

- **DA-1:** ¿una venta que luego pasa a Cierre Perdido sigue contando? Propuesta: **sí, por evento**, porque es lo que ya
  dicen `metricas.md` §1.4 y el ADR 0038, y lo que usan Ventas, Mes, escalera y ROAS. "Vendidos que siguen vendidos"
  sería otra métrica con otro nombre.
- **DA-2:** ¿las ventas anteriores al inicio de ventas cuentan para la cohorte? Decide Gerencia. Mientras tanto, Cupos y
  Proyección usan la misma función para no diferir.
- **DA-5:** el cumplimiento del día se mide contra la meta de apertura del día. Propuesta: sí.

## Alcance

1. Una función de venta (SQL y TS gemelas) según DA-1, y que `ventasDeCohorte`, `alertas.ts`, `tasas-del-grupo.ts`,
   `estudiantes.ts` y `ficha-deal.ts` la importen. Se actualiza el comentario de `dashboard.ts:694-701`.
2. Una función `ventasDeLaCohorte(cohorte, hasta)` según DA-2, usada por Cupos, meta de hoy y Proyección.
3. La meta de hoy y el esperado lineal en `lib/dias-habiles.ts`, con el borde explícito; `proyeccion.ts`, `dashboard.ts`,
   `metas.ts` y `alertas.ts` la importan. Meta de apertura del día para el cumplimiento (DA-5).
4. La muestra mínima y los días de madurez pasan a ser datos del programa (C-1); las constantes de operación quedan con
   nombre.
5. "Leads requeridos por día" con numerador y denominador del mismo universo.
6. Guardián (N1): fuera del módulo, nadie escribe `inArray(deals.etapa, ETAPAS_VENDIDAS)` para contar ventas.

## Done cuando

- [ ] Test de paridad: un deal Abonado → Cierre Perdido da el mismo conteo en Mes, Cohorte, alertas, % de cierre y
  escalera.
- [ ] Test: con una venta anterior al inicio de ventas, Cupos y Proyección dan la misma cifra.
- [ ] Test: vender 4 con meta de apertura 2 da cumplimiento 200 %, no 333 %.
- [ ] Test: el último día hábil, meta de hoy y ventas requeridas por día dan lo mismo.
- [ ] Guardián del predicado de venta mordido en los dos sentidos.
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y cualquier ADR que cambie quedan reescritos en el mismo commit, título e índice incluidos.
