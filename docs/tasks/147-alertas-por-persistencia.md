---
id: 147
etapa: NC2
serves: "comercial.md GC-39, GC-40"
depends: [136]
status: done
---

# 147 — Alertas por días hábiles seguidos bajo el umbral

**Bloqueado por:** QD-6 (de qué métricas son los umbrales y cuántos días seguidos disparan la alerta).

> **1-oct (Mani, `comercial.md` §7.0):** QD-6, **5 días hábiles** seguidos por debajo, **configurable**. Falta qué métricas llevan umbral (QM-11; recomendación: las del semáforo de la meta, DP-24). Carril de Alejo en NC2.

> **4-oct (Mani): desbloqueado.** QM-11: llevan umbral y alerta **solo las métricas del semáforo de la meta**
> (DP-24). No se inventan umbrales para otras.

## Objetivo

Una métrica caída un día no es alerta; caída N días hábiles seguidos sí (*"5 días seguidos, paila"*). Los
umbrales son filas (DP-23) que Dani carga mientras lo usa en el daily. Se calcula al leer.

## Nota de cierre (5-oct, Alejo + Claude; ok de Mani a la migración por Alejo)

- **Decidido con Alejo (5-oct):** llevan umbral la **meta del mes** (146) y la **meta de la cohorte** (020), las dos
  únicas del semáforo que existen hoy; las de Pauta se suman cuando exista el 122. Se configuran en **Programa ›
  Ventas** (ADR 0077).
- **Migración 0067** (`umbrales_alerta` + enum `metrica_con_umbral`): solo agrega, con `lock_timeout`. Aplicada en
  producción el 5-oct (ref `hfqmiyiuyqapdsbywrag`; antes, la 0066 era la última y no había transacciones largas). Uno por
  programa y métrica (índice único); aceptable 1 a 100 % y días 1 a 30 (CHECK).
- `lib/catalogo/umbrales.ts`: `guardarUmbral` por el molde (crea, edita, activa y desactiva con `change_log`), solo
  `esAdministrador`; `umbralesDelPrograma` lee uno solo.
- `lib/queries/alertas.ts`: cumplimiento al cierre de cada **día hábil cerrado** (hoy no cuenta), racha hacia atrás,
  dispara al llegar a los días configurados; un día sin esperado corta la racha. La meta del mes usa
  `armarMetasDelMes` con las ventas hasta ese día (`leerCohortesYVentas`, extraído de `metas.ts`); la de la cohorte
  usa el mismo conjunto de vendidos que el Pulso, con el día de su venta.
- Pantallas: `components/dashboard/alertas.tsx` al final del Pulso (disparada en peligro, racha en curso en alerta, y
  cada día con su cumplimiento); formulario en Programa › Ventas, en lectura para quien no administra.
- Tests: `tests/alertas.test.ts` (días hábiles cerrados, racha, corte, rastro, 403 del closer, validación, frontera de
  programa, desactivar, y paridad con el Pulso con una venta que pasó a Cierre Perdido). `paginas.test.ts` mockea la
  lectura. Typecheck, lint, `npm run build`.
- Recorrido en `dev:local` (con la 0067 aplicada a la base local): umbral guardado con clic (fila y `change_log`), el
  Pulso con la alerta y sus cinco días, 375 px sin desborde. **Forjado:** `guardarUmbralAccion` invocada a mano con
  sesión de closer responde "Solo quien administra cambia los umbrales." y la base no se mueve.
- **Revisión del cadenero:** la meta de la cohorte contaba ventas por historial y el Pulso por etapa actual (una
  venta perdida o anterior al corte de lectura las separaba): ahora usa el mismo conjunto, con test de paridad. El
  mensaje del aceptable decía 1 a 100 y aceptaba 0,5: ahora el mínimo es 1.
- **CI rojo de `06d7acc`:** la 0067 creó la tabla sin RLS (ADR 0047; lo cazó `rls-en-todas-las-tablas`, que en local no corrí). Arreglado con la **0068** (`ENABLE ROW LEVEL SECURITY`), aplicada en producción el mismo día: ninguna tabla de `public` queda sin RLS. Lección: una migración que crea tabla corre ese guardián antes de aplicarse.
- **Falta:** el checkpoint; que Dani cargue los umbrales reales (GC-39); y el 191 (banderas del Pulso), que ya puede
  arrancar.

## Cierre (checkpoint, 5-oct)

Checkpoint `cp-20261005-1` sobre `d974c76`: CI verde (suite completa, Postgres real y build), deploy de
producción en Vercel correcto, fuentes recibiendo y sin sobres crudos con error real (los 5 pendientes son entregas
de prueba que no se ingieren a propósito).
