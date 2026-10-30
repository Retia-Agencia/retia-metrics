---
id: 356
etapa: dinero
serves: "ADR 0115 N6 · auditoría 30-oct C-09, C-16"
depends: []
status: todo
---

# 356 — La comisión siempre congelada, y quién es "el closer" de cada cifra

Auditoría: [`docs/auditoria-metricas-2026-10-30.md`](../auditoria-metricas-2026-10-30.md). Reglas: ADR 0115.

## Por qué

- **C-09:** 16 de 32 ventas vigentes de ComunicArte y 9 de 18 de Tactical no tienen `comision_porcentaje` (comprobado el
  30-oct). `moverEtapa` (`lib/deals/mover-etapa.ts:~327`) solo lo congela si el programa lo tenía al vender, y
  `comisionDeDeal` (`lib/queries/comision.ts:16`) devuelve `null`. La comisión de octubre visible se queda corta unos
  USD 702 (ComunicArte) y USD 790 (Tactical) con el % actual del programa.
- **C-16:** en Mis métricas, citas y shows van por quien tomó la llamada, cierres y comisión por el dueño actual del deal,
  y caja por quien tecleó el abono; 3 ventas de ComunicArte no tienen dueño y no entran en ninguna comisión individual.

## Decisión abierta

- **DA-9:** backfill del % de las 25 ventas sin % con el % vigente del programa el día de la venta. Escribe en la base:
  **pide el ok de Mani**, por el molde de rastro (ADR 0042).

## Alcance

1. Reja en `moverEtapa`: no se entra a Abonado o Completo si el programa no tiene % de comisión; el error dice dónde se
   configura (N6).
2. Script de backfill según DA-9, con `change_log`.
3. Cada columna de Mis métricas y del comparativo dice en su "Cómo se calcula" a quién se acredita; las ventas sin dueño
   salen como fila "Sin closer" visible.

## Done cuando

- [x] Test: mover a Abonado en un programa sin % se rechaza y la base no se mueve. (`tests/mover-etapa.test.ts`, "no vende si el programa no tiene porcentaje de comisión")
- [ ] Tras el backfill (con ok), `count(*) where comision_porcentaje is null` en ventas vigentes = 0. Script listo: `npm run rellenar:comision-ventas` (ensayo) y `-- --aplicar`; probado en `tests/rellenar-comision.test.ts`. Ensayo de solo lectura en producción (30-oct): rellenaría 16 ventas de ComunicArte al 10,04 % y 9 de Tactical al 6,67 %; Comunícate con Confianza ya está completo. **Espera el ok de Mani (DA-9).**
- [x] La fila "Sin closer" aparece cuando hay ventas sin dueño. (`tests/vista-dashboard.test.ts`, "muestra las ventas sin dueño en una fila sin closer")
- [x] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y cualquier ADR que cambie quedan reescritos en el mismo commit, título e índice incluidos.

> 30-oct: "AI Second Brain Jurídico" estaba activo y sin %; la reja le habría bloqueado la primera venta. Mani pidió 8 % y se cargó en producción por `editarPrograma` (queda en `change_log`).
