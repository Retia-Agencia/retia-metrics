---
id: 005
fase: F2
serves: "spec §5 criterios 2 y 3"
depends: [004, 010]
status: done
---

# 005 — Dashboard real en /programas/[slug]

## Objetivo
Un closer o gerente abre el dashboard de cualquier programa y ve el día, la semana, la cohorte y
el mes, con filtro por fecha y closer.

## Alcance
- Dentro: reemplazar el `ProximaFase` de `/programas/[slug]` (ticket 010) con tarjetas y tablas
  del ticket 004. La descripción de la cohorte sale de la base, no de texto fijo.
- Dentro: selector de rango (hoy, esta semana, cohorte, mes, custom) y de closer.
- Fuera: historial de persona (006), snapshot (021), gráficas (se agregan si hacen falta, con su
  dependencia en ese momento).

## Done cuando
- [x] Un closer y un gerente ven los mismos números (ADR 0009).
- [x] El filtro cambia los números.
- [x] Todo monto lleva su moneda al lado.
- [x] Un programa creado desde `/ajustes` muestra su dashboard sin cambios de código.

## Cómo quedó (17-sep)

**El filtro por closer vive dentro de las consultas del 004, no en un módulo aparte.**
Decisión de Mani en esta sesión: quería todas las métricas a nivel individual, no solo el
comparativo. `lib/queries/dashboard.ts` pasó de `(programId, rango, db)` a un objeto
`Alcance = { programId, rango, closerId? }`, y cada consulta agrega una condición de closer
(`abonos.closerId`, `calls.closerId`, `sales.closerId`, `people.responsableCloserId`). Así la
regla de fecha en Bogotá y el agrupado por moneda tienen una sola implementación.

Tres cosas quedaron explícitas porque la base no las puede responder:

- **No hay meta individual.** La meta de cupos y la de leads/día son de la cohorte (ADR 0022).
  Con un closer seleccionado, `vistaDeCohorteActiva` agrega `vendidosDelCloser` (su
  contribución) y deja intactas la meta, la meta dinámica y el cumplimiento de la cohorte.
- **Los leads de un closer son las personas de las que es responsable** (ADR 0021). "Sin
  responsable" es válido, así que la suma de los closers no da el total del programa. La
  pantalla lo dice.
- **El comparativo entre closers nunca se filtra** (ADR 0009): el tipo de `embudoPorCloser` no
  admite `closerId`, no es una convención que haya que recordar.

**El rango vive en la URL** (`?rango=&desde=&hasta=&closer=`), resuelto por `lib/rangos.ts`
(puro). "Esta semana" y "este mes" van hasta hoy, no hasta el fin del periodo (decisión de Mani):
el dashboard es el reporte del día y los días futuros en cero ensucian las tasas. Un preset que
no se puede cumplir (cohorte sin ventana, fechas inválidas, rango invertido) cae a "hoy" y el
selector muestra "hoy": nunca dice que estás viendo algo distinto de lo que ves.

El filtro sale de la URL y nunca de la sesión: un closer que entra sin filtro ve el programa
completo. `armarVistaDelDashboard` no recibe rol ni sesión, así que no hay dónde esconder una
diferencia entre lo que ve un gerente y lo que ve un closer.

**Fuera:** pauta (no hay consulta del 004 que la lea) y formato humano de fechas (se muestran en
ISO).
