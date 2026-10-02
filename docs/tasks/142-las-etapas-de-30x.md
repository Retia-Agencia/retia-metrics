---
id: 142
etapa: NC2
serves: "comercial.md R-1, GC-01, GC-03, GC-04, §4"
depends: [QD-8]
status: done
---

# 142 — Las etapas de 30X: enum, transiciones, requisitos y la traducción en una migración

**Bloqueado por:** QD-1 (dónde van Pendiente Re-agenda, Seguimiento y Próxima Cohorte; qué distingue
Potencial, Registrado, En gestión y Contactado) y **QD-8 (el manual de gestión comercial)**. Sin el manual
las reglas de movimiento no se pueden reescribir. No se toca nada de etapas antes.

> **1-oct (Mani, `comercial.md` §7.0):** QD-1 contestada: cada etapa se define como en `insumos/hubspot-30x-workflow.md` §3, y Pendiente Re-agenda, Seguimiento y Próxima Cohorte son **estados dentro del deal**, no etapas (cómo se modelan: QM-10, ADR antes de este ticket). QD-2: descartados y setteo a la cola del setter (propuesta: En gestión), cerrados a ganado en su cohorte. Sigue esperando el manual de Alejo (QD-8).

> **1-oct, QM-10 cerrada por el [ADR 0070](../adr/0070-re-agenda-seguimiento-y-proxima-cohorte-son-pendientes-del-deal.md):**
> Re-agenda, Seguimiento y Próxima Cohorte son **Pendientes** del deal: `deals.pendiente`, un `pgEnum` nullable de
> tres valores, a lo sumo uno por deal. El deal se queda en su etapa (salvo el retroceso de Compromiso Verbal, que
> vuelve a la etapa previa del historial). Solo `moverEtapa()` escribe etapa y pendiente, y cada movimiento deja
> huella en `deal_etapa_historial`. Este ticket ya no espera la QM-10; sigue esperando el manual (QD-8).

> **2-oct, desbloqueado:** el manual de gestión comercial (QD-8) quedó aprobado y sus dudas, contestadas en el
> [ADR 0071](../adr/0071-como-se-mueve-un-deal-por-las-etapas-de-30x.md): primera actividad → En gestión, contacto
> logrado → Contactado, Calificado con dos entradas, deal a mano en En gestión, seis botones en Atendido, los tres
> intentos se cuentan y alertan (con el 128), la cortesía es un deal con 100% de descuento y marca (el motor acepta
> valor 0 solo con ella), y el Parcial que desiste es Cierre perdido. Las reglas por etapa están en el manual §3 y §4;
> el norte de 30X, en `insumos/30x-ciclo-de-vida.md`.

> **2-oct, [ADR 0072](../adr/0072-una-pregunta-por-etapa-mueve-el-deal.md):** cada etapa tiene UNA pregunta cuya
> respuesta es la flecha (tabla en el ADR, punto 1); el Kanban se arrastra y soltar abre esa pregunta con lo que el deal
> tiene y le falta; Seguimiento también en Calificado (ya contactado) y en Compromiso Verbal; el área declarada se pide
> al entrar a Atendido; nada automatizado. El orden de la cola (Lead Value, días en la etapa, última actividad, próximo
> paso) es del hub del closer, no de este ticket.

> **2-oct, sesión de Mani (en curso, rama `142-etapas-30x`, worktree `.claude/worktrees/142`):**
> - ✅ **Esquema y migración 0058 hechos** (commit `fe64ded` en la rama, **sin aplicar**): once etapas de 30X, enum
>   `pendiente_deal`, `deals.pendiente`, `deals.cortesia`, `tipo_actividad` + `intento`, historial con
>   `pendiente_de`/`pendiente_a`. La migración se reescribió a mano sobre el borrador de drizzle-kit (casteaba los
>   valores viejos y fallaba): columnas a texto, traducción, tipo nuevo. Probada en PGlite con 11 casos de la forma
>   vieja. Producción hoy (medido, solo lectura): 145 en Pendiente Setteo → 115+28 Registrado, 3 Potencial, 3
>   Calificado (por el envío de origen, ADR 0069); 2 en Re-agenda → Agendado + pendiente `reagenda`; 93 Agendado.
>   `estados_llegada`: Pendiente Setteo alta → Calificado, normal → Registrado.
> - **Decidido por Mani:** las de ganado se llaman `ganado_parcial` / `ganado_completo`; el área declarada al entrar a
>   Atendido (ADR 0072 p6) **va al 143** (choca con el paso a Atendido por Grain, que hace el sistema); el 142 se
>   parte en **tres tandas de Codex** sobre la misma rama: (1) el motor en `lib/deals/`, (2) el resto de consumidores
>   y tests hasta typecheck verde + reescribir `structure.md` §3.1, (3) la UI: la pregunta de la etapa en la ficha y al
>   soltar en el Kanban (ADR 0072 p1 y p2).
> - **Brief de la tanda 1 listo:** [`142-brief-codex-tanda-1.md`](./142-brief-codex-tanda-1.md) (tabla de flechas E1
>   a E13, RETRO, P, R, A1, A2 y de pendientes PR1, PR2, PS1 a PS3, PC, RET, con todas las decisiones). **No se
>   despachó** (Mani cortó por usage). Las tandas 2 y 3 se escriben al revisar la 1.
> - 🔴 **Abierto, no bloquea la tanda 1:** la cortesía (ADR 0071 p10) no tiene flecha a ganado (a ganado solo se
>   entra con un abono y una cortesía no tiene). El 142 solo crea la columna; el flujo y su exclusión de ventas y
>   comisión necesitan decisión de Mani (¿abono de 0 con marca, o flecha propia?).
> - **Cierre del 142:** typecheck, lint y tests de las tres tandas; con el ok de Mani, aplicar 0058 en producción
>   (`SET lock_timeout`, mirar `pg_stat_activity` antes) **en el mismo momento** que se empuja la rama a `main`: el
>   código viejo no lee el enum nuevo y el nuevo no lee el viejo. Hoy los closers aún no trabajan en el CRM (el
>   corte es después), así que la ventana es tolerable.

> **2-oct (madrugada), las tres tandas hechas en la rama `142-etapas-30x`:**
> - **Tanda 1** (Codex, `75dfe98`): el motor. Codex había borrado tests de reglas vivas (abonos 31 → 4); se le devolvió
>   y los restauró (441 tests). E7 pasó de "sistema" a "ambos" (error del brief: el historial perdía quién agregó la llamada).
> - **Tanda 2** (Codex hasta quedarse sin cuota, cerrada por Claude, `8acf69d`): consumidores, `structure.md` §3, notas
>   del sistema en el log del deal (Mani, 2-oct). Se restauró el camino PR2 de `marcarFallida` (Atendido + Re-agenda con
>   motivo), que la tanda 1 había perdido sin que sus tests lo vieran.
> - **Tanda 3** (Claude): la pregunta de la etapa en ficha, Kanban y Calls; `revisarMovimiento` (ensayo del motor);
>   "Negocia" en Contactado (Mani, 2-oct, ADR 0072 enmendado). Recorrido en el navegador contra la base local, sin errores
>   de consola.
> - **0058 corregida** antes de aplicarse: un deal que nació directo en Re-agenda o Seguimiento caía en la puerta
>   (Registrado + Re-agenda, combinación que el motor no produce). Producción no tiene ese caso hoy (3 en Re-agenda,
>   los 3 venían de Agendado, medido en solo lectura); test en `tests/migracion-0058.test.ts`. Probada en Postgres 17
>   real con la base local. ⚠️ Una base local que ya aplicó la 0058 vieja no la vuelve a correr.
> - ✅ **En `main` y 0058 aplicada en producción** el mismo momento (ok de Mani por `/goal`, 2-oct). Falta el checkpoint
>   verde que lo incluya para marcarlo `done`. La cortesía (ADR 0071 p10) sigue sin decidir.

## Objetivo

Que `deals.etapa` tenga las once etapas de 30X (`comercial.md` §4) y que `moverEtapa()` las mueva con los
requisitos remapeados.

## Alcance (al desbloquear, se precisa con `/grill-with-docs` y un ADR que reemplace partes del 0037 y el 0056)

- **Los pendientes (ADR 0070):** el enum `pendiente_deal` y la columna `deals.pendiente`; `deal_etapa_historial`
  gana el pendiente de antes y el de después; las flechas que ponen, cambian y quitan un pendiente (punto 6 y 7
  del ADR) reemplazan a T6, T7, T8, T15, T19 a T29 y el destino 9 de la R; `ETAPAS_QUE_UNA_CITA_MUEVE_A_AGENDADO`
  pasa a "setteo o con pendiente"; la mudanza de cohorte al retomar un Próxima Cohorte (punto 8); el guardián
  del 046 cubre `pendiente` igual que `etapa`; el Inbox y el Kanban leen el pendiente.
- El enum, `mapa-transiciones.ts`, `requisitos.ts`, el Kanban, el Inbox, el embudo y toda consulta que nombre
  una etapa.
- **Una sola migración** que traduce `deals.etapa`, `deal_etapa_historial` y `estados_llegada.etapa_entrada`
  (117). El historial se traduce, no se reescribe a mano. Un deal en `pendiente_reagenda`, `seguimiento` o
  `proxima_cohorte` queda en la etapa de 30X de la última etapa en que estuvo antes de entrar ahí, con su
  pendiente (ADR 0070, Consecuencias).
- Lo que no cambia: `moverEtapa()` único escritor, anulado no es Cierre Perdido (ADR 0038), venta = las dos
  etapas de ganado, el valor vendido obligatorio al entrar a ganado (ADR 0065), Atendido sin Grain (ADR 0066), re-agenda siempre con motivo, Seguimiento con fecha y Próxima Cohorte con
  cohorte de origen y destino (ADR 0070).
- Después: el `--aplicar` del 078 (R-11) y las secciones del dashboard (148).

## Cierre (2-oct, madrugada)

Contra el Alcance, punto por punto:

- [x] **Los pendientes (ADR 0070):** `pendiente_deal`, `deals.pendiente`, historial con `pendiente_de`/`pendiente_a`;
  flechas PR1, PR2, PS1 a PS3, PC y RET (`lib/deals/etapas.ts`); `unaCitaMueveAAgendado` = setteo o Agendado/Atendido
  con pendiente; mudanza de cohorte con `change_log` salvo en Cierre perdido; el guardián del 046 cubre `pendiente`;
  Inbox y Kanban leen el pendiente.
- [x] El enum, `mapa-transiciones.ts`, `requisitos.ts`, Kanban, Inbox, embudo y toda consulta con etapa: typecheck del
  repo entero en cero; ningún literal viejo fuera de la traducción histórica (`rg`).
- [x] **Una sola migración** (0058) que traduce deals, historial y `estados_llegada`; aplicada en producción el 2-oct
  (59 migraciones). Medido después: 144 Registrado, 3 Potencial, 3 Calificado, 93 Agendado y 3 Agendado + Re-agenda.
- [x] Lo que no cambia, sostenido por sus tests: `moverEtapa()` único escritor, anulado ≠ Cierre perdido, venta = las
  dos de ganado, valor vendido al entrar a ganado, Atendido sin Grain, re-agenda con motivo (PR2), Seguimiento con
  fecha, Próxima Cohorte con cohorte destino.
- [x] La pregunta de la etapa (ADR 0072 puntos 1 y 2) en la ficha, el Kanban y Calls, con la vista previa por ensayo
  del motor (`structure.md` §3.1.1).
- [x] Nivel 1 en verde, `next build` en verde, y el **CI de `b0b8d32` en verde con la suite completa** (145 archivos).
  `AGENTS.md` al día (build antes de empujar un cambio a un componente cliente).

**Quedó fuera, a propósito:** la cortesía (ADR 0071 p10, sin decidir); el área declarada al entrar a Atendido (143);
las alertas (128); el orden de la cola del closer (ADR 0072 p5). Deuda chica: `tests/142-nuevas-*.ts`.
**El tracker lo marca Mani en el próximo checkpoint** (`plan-reparto.md` §6); la punta `b0b8d32` ya está verde.

