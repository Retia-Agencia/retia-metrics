---
id: 027
fase: F2
serves: "ADR 0022; spec §1 pilar 2 — meta y meta dinámica"
depends: [014]
status: done
---

# 027 — Ventana de venta de la cohorte

## Objetivo
Cada cohorte declara entre qué dos días vende, para que los días hábiles y la meta dinámica del
dashboard salgan de un dato y no de una regla inventada.

## Alcance
- Dentro: `cohorts.fechaInicioVentas` (date, nullable) y el `CHECK`
  `estado <> 'activo' OR fecha_inicio_ventas IS NOT NULL` (ADR 0005: la garantía vive en la base).
- Dentro: en la misma migración, corregir `fechaCierreVentas` de Comunicarte C2 a `2026-09-21` y
  sembrar el inicio de las dos C2 activas: Comunicarte `2026-08-14`, Tactical `2026-08-19`
  (valores del reporte diario, ver la tabla del ADR 0022).
- Dentro: el esquema zod de la cohorte y el formulario de `/ajustes/programas/[slug]` suman el
  campo. Activar una cohorte sin inicio de ventas da 400 con mensaje claro, nunca 500.
- Dentro: `scripts/seed-datos.ts` siembra las dos fechas de cada cohorte.
- Dentro: borrar del esquema el comentario "cada cohorte se vende hasta el mismo día en que
  arranca clases, inclusive" (Comunicarte lo desmiente).
- Fuera: las consultas que usan la ventana (004) y la UI del dashboard (005).

## Done cuando
- [x] Una cohorte nueva se crea con inicio y cierre de ventas desde `/ajustes/programas/[slug]`.
- [x] Activar una cohorte sin inicio de ventas falla con 400; el `CHECK` lo rechaza también si la
      validación se salta.
- [x] Una cohorte cerrada puede quedar sin inicio de ventas (las dos C1).
- [x] Con Comunicarte C2 (14-ago a 21-sep) `diasHabilesEntre` da 27 y el 15-sep es el día 23; con
      Tactical C2 (19-ago a 29-sep) da 30 y el 15-sep es el día 20. Son los números del reporte.
- [x] `npm test`, `npm run typecheck` y `npm run lint` limpios.

## Notas
La migración la genera y aplica la sesión principal, no un subagente (`AGENTS.md`). Primero `dev`,
después `production` con el ok de Mani; la corrección del cierre de Comunicarte C2 toca datos que
ya existen en las dos ramas.
