---
id: 362
etapa: plataforma
serves: "ADR 0115 N8, N9 · auditoría 30-oct K-01 a K-11"
depends: []
status: todo
---

# 362 — Documentos sin contradicciones, y el tracker que no miente

Auditoría: [`docs/auditoria-metricas-2026-10-30.md`](../auditoria-metricas-2026-10-30.md). Reglas: ADR 0115.

## Por qué

- **K-01:** el costo por agenda divide por las agendas de Meta desde el 16-oct (`lib/semaforo/costo-por-agenda.ts:221`),
  pero el título del ADR 0088, su índice, `hub.md` H-4, `overview.md` §11 y `analytics.md` §6 dicen "agendas del CRM";
  `metricas.md` marca ✅ un costo por agenda del Hub que no existe.
- **K-02:** `metricas.md` §3.5 D2 dice que no hay fórmula por cita; existe desde el 24-oct (299).
- **K-03:** `AGENTS.md` manda a `analytics.md` §6 para las fórmulas, declaradas historia, que ya difieren.
- **K-04:** `AGENTS.md` y `structure.md:120` dicen que `estados_llegada` sigue en el esquema (la borró la 0059), que
  Canales vive en Ajustes (es un redirect) y que el ADR 0054 cierra D4 (retirado; vige el 0069).
- **K-05:** el 350 cerrado con sus casillas vacías; 143, 152, 156 y 157 `[x]` en el tracker y `en curso` en su archivo.
- **K-06:** `structure.md` §8-9 y `overview.md` describen el Dashboard. **K-07:** seis contra siete escalones.
- **K-09:** la traza por envío o por venta. **K-10:** tres reglas de precedencia; GC-45 sin nota de superado.
- **K-11:** leyenda de estado de `metricas.md` incompleta.

## Alcance

1. Corregir cada choque según N8: el ADR vigente manda; título e índice del ADR 0088 y del 0109 con su enmienda;
   `metricas.md` con dos filas de costo por agenda (semáforo con Meta, Hub con CRM en 🟡 hasta el 249), D2 enmendada, la
   traza con su universo y la leyenda solo ✅/🟡.
2. `AGENTS.md`: fórmulas → `metricas.md`; `analytics.md` solo para la reunión y DP-1 a DP-25; quitar las frases de
   estado que envejecieron (K-04) y dejar la jerarquía de N8.
3. `structure.md` §8-9 y `overview.md` con el Hub; regenerar `docs/manuales/mapa-crm.html`.
4. `comercial.md`: nota de GC-44/45 superados por el ADR 0086.
5. `tests/tracker-coherente.test.ts` (N9): el estado de cada fila del tracker coincide con el `status:` de su archivo, y
   un ticket `done` no tiene casillas `[ ]` en su "Done cuando".

## Done cuando

- [x] Grep: "agendas del CRM" ya no describe el costo por agenda del semáforo en ningún doc; "seis escalones" no aparece.
      Evidencia: `grep -rn "agendas del CRM\|seis escalones" docs AGENTS.md` solo deja la auditoría, este ticket, el
      handoff (historia) y frases que hablan del Hub o del control.
- [x] `tests/tracker-coherente.test.ts` en verde y mordido (una fila desfasada lo hace fallar). Evidencia: 9 de 9;
      con el 247 a `en curso` en su archivo falla por el 247, y sin la excepción del 143 falla por el 143.
- [x] `docs/manuales/mapa-crm.html` regenerado: actores y matriz con el Hub (overview §4, structure §8). Los
      componentes salen de `plan.md` §4, que este ticket no tocó.
- [x] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y cualquier ADR que cambie quedan reescritos en el mismo commit, título e índice incluidos.

## Cierre (30-oct, sesión del 362)

- K-01, K-02, K-03, K-04, K-06, K-07, K-09, K-10 y K-11 corregidos según N8, cada afirmación contra el código:
  `lib/semaforo/costo-por-agenda.ts` (divide por `agendasMeta`; nadie fuera del semáforo lo llama),
  `lib/queries/escalera.ts` (`ESCALONES`, siete), `lib/queries/origen.ts` (`trazaPaid` suma envíos),
  `drizzle/0059_retirar-estados-llegada.sql`, `app/(app)/ajustes/canales/page.tsx` (redirect),
  `app/(app)/p/[programa]/metas/page.tsx` (redirect), `lib/nav.ts` (`SECCIONES_DEL_HUB`).
- El título del ADR 0088 cambió; el nombre del archivo no, para no romper enlaces.
- **K-05, lo que el test encontró y NO se corrigió aquí** (lo pone al día Mani en el checkpoint):
  - Estado distinto entre tracker y archivo: 143, 152, 156, 157 (done contra en curso), 258 (`v1 done` contra
    `en curso`), 281 (`en main` contra `todo`), 314 (`en producción` contra `doing`), 308, 322 y 328 (`en curso` contra
    `todo`).
  - `done` con casillas vacías en su "Done cuando": el 350 y 81 tickets cerrados antes de la N9 (lista congelada
    `CERRADOS_ANTES_DE_N9_SIN_CASILLAS` en el test). Mani decide si se marcan con su evidencia o se reabren.
- Fuera de alcance, para otro ticket: comentarios de código que todavía hablan de `estados_llegada`
  (`lib/ingesta/adaptador-typeform.ts`, `estado.ts`, `calificacion.ts`, `tests/ingesta-estado.test.ts:44`); `/hub`
  ("todos") se guarda con `paginaConRol("gerente", "closer")`, así que el paid trafficker que entra por la vieja
  `/ajustes/canales` (redirect a `/hub?seccion=origen`) no pasa la guarda; y el closer sí ve "todos" aunque el Hub
  de un programa le responde 404 (ADR 0082). Ninguno se midió en el navegador.
