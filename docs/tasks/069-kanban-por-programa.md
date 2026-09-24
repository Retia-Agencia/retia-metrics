---
id: 069
etapa: E6
serves: "plan v2 §6 etapa 6 · tarea E6-1 · insumo §4.3, spec §2 (enmendada: el kanban entra)"
depends: [065]
status: todo
---

# 069 — Kanban por programa con las diez etapas

> ⚠️ **Antes de abrir este ticket hay que decidir la garantia de la etapa 6** (ver el ticket 075 y
> el plan v2 §11): **o entran tests de componente, o la garantia sigue siendo el recorrido visual
> a mano haciendo clic en todo lo que se abre**. Lo que no se vale es asumir que los tests
> actuales cubren esto.

## Objetivo

La vista principal del closer: diez columnas, tarjetas de deal, filtros por owner, cohorte, canal
y antiguedad.

## Alcance

- **Dentro:** el tablero, el arrastre entre columnas y los filtros.
- **Dentro:** **todo movimiento pasa por `moverEtapa()`**. Si el requisito falta, el arrastre se
  rechaza **mostrando el requisito que falta** (ticket 044), no un "no se puede".
- **Dentro:** los avisos en la tarjeta: compromiso verbal vencido en rojo, cartera vencida en
  rojo, lead "unido por telefono", lead que "desaparecio de la hoja" (ADR 0032).
- **Dentro:** el filtro sale de la **URL y nunca de la sesion** (ADR 0023).
- **Fuera:** calendario. Sigue fuera de la spec.

## ⚠️ El riesgo, dicho de frente

Este repo **no tiene tests de componentes**, y el 20-sep dos bugs pasaron con **669 tests en
verde**. Base UI **lanza en tiempo de ejecucion**, no en compilacion, cuando una parte vive fuera
de su contenedor: eso tumbo el layout entero al abrir un menu y estuvo roto dias. **Un Kanban con
arrastre, diez columnas y requisitos por etapa es la superficie mas grande de ese tipo que va a
tener el proyecto.**

## Done cuando

- [ ] Las diez columnas cargan con datos reales de `dev`.
- [ ] Arrastrar a una etapa cuyo requisito falta muestra **que falta**, y **la base no se mueve**.
- [ ] Arrastrar a una transicion prohibida se rechaza.
- [ ] **Recorrido visual hecho haciendo clic en todo lo que se abre**, con la consola del
      navegador abierta y sin errores.
- [ ] Probado en celular: un closer registra desde el telefono.

## Kiro

Si, **con revision visual obligatoria de cada entrega**.

---

## Enmienda 2026-09-24 (ADR 0050): el Kanban es la vista tablero de la tab Deals

La tab Deals tiene dos vistas: **tablero** (este ticket) y **tabla**, las dos dentro del programa del
selector (ticket 097). 🔴 La revisión del 22-sep (P1, sin decidir) recomienda que dependa de 045, 052 y
057 y no del 065, porque un tablero no necesita el embudo. Las tarjetas muestran también la llamada suelta pendiente y el
seguimiento vencido.

---

## ✅ Decisión 2026-09-24 (Mani, se valida con los closers): Seguimiento y "un deal, muchas llamadas"

- **Seguimiento es una etapa propia (la 11)**, después de Atendido: la llamada ocurrió y hay que volver a
  contactarlo. Separa lo que salió bien (Compromiso, pago) de lo que hay que re-contactar. Reemplaza la
  propuesta anterior de "quedarse en Atendido con fecha". El `pgEnum` gana un valor (migración de la
  sesión principal). El número no es el orden: va después de Atendido.
- **Un deal tiene muchas llamadas y nunca se duplica.** Si una llamada falla (no-show, cancelada, u
  otra llamada necesaria), el deal pasa a Re-agenda **con motivo** (5 → 3 incluido). Una llamada nueva
  de un lead con deal abierto **se agrega y se avisa al dueño**; en 1, 2, 3, 9 u 11 el deal pasa a
  Agendado, en 5, 6 o 7 la etapa no cambia.
- **La conversión cuenta deals distintos** que llegaron a una etapa, no entradas: el ir y volver no infla.
- Transiciones nuevas: T24 (5 → 11), T25 (11 → 6), T26 (11 → 7 u 8), T27 (11 → 4), T28 (11 → 9), T29
  (5 → 3 con motivo); T11 queda reemplazada y T15 pasa a 6 → 11. Perdido llega también desde 11. Tabla
  completa en `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md` §2.5 y §2.6.
- **Reemplaza** lo dicho antes en este documento sobre "la segunda llamada no hace retroceder".
