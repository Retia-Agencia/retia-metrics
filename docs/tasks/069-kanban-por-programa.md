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
