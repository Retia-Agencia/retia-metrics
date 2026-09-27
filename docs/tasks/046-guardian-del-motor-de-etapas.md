---
id: 046
etapa: E2
serves: "plan v2 §6 etapa 2 · tarea E2-4 · invariante 3 del plan v2"
depends: [045]
status: done
---

# 046 — Guardian: ningun `update(deals).set({ etapa })` fuera del motor

## Objetivo

Que la regla del ticket 045 la haga cumplir un test y no la disciplina. Mismo molde que los
guardianes de `vigente`, `rolDeVista` e `identidad de closer`.

## Alcance

- **Dentro:** un test que recorre `lib/`, `app/`, `components/` y `scripts/` cadena de drizzle por
  cadena y falla si alguien escribe `deals.etapa` fuera de `lib/deals/etapas.ts`.
- **Dentro:** el mordisco en los **dos** sentidos.
- **Fuera:** cualquier otra regla. Un guardian que vigila dos cosas se desactiva por la mas ruidosa.

## Por que el mordisco no es opcional

**Un guardian que no se puede hacer fallar es decoracion** (invariante 3 del plan v2). El guardian
del molde de catalogo **paso en verde con un `DELETE` clandestino inyectado** y se endurecio el
20-sep: pedia que el archivo contuviera el nombre de la funcion, cuando lo que hay que exigir es
que **cada** escritura caiga dentro de ella.

Y la otra mitad del mordisco importa igual: **no marcar la solucion correcta**. Un guardian que
marca el codigo bueno se apaga en una semana.

## Done cuando

- [ ] Se inyecta un `update(deals).set({ etapa })` clandestino en un archivo cualquiera y el test
      **falla**.
- [ ] El test **no** marca `lib/deals/etapas.ts`.
- [ ] El mensaje del fallo dice que hacer (`usa moverEtapa()`), no solo que algo esta mal.

## Kiro

Si, con revision del mordisco.

---

## ✅ Cerrado 2026-09-27

- **`tests/motor-etapas-guardian.test.ts`** recorre `lib/`, `app/`, `components/` y `scripts/` y caza cuatro
  formas de escribir la etapa fuera de `lib/deals/mover-etapa.ts`: `.update(deals)` que toca `etapa`, SQL
  crudo (`update … deals … set … etapa`, tambien dentro de plantillas `sql`), `editarConRastro` sobre
  `deals` con `etapa`, y la llave del motor (`desdeElMotor: true`) usada fuera del motor. **No vacia las
  cadenas** (el SQL crudo vive ahi); solo quita los comentarios.
- **Segunda capa, en tiempo de ejecucion:** `crearConRastro` y `editarConRastro` rechazan `etapa` sobre
  `deals` salvo con la llave del motor, porque la etapa puede llegar dentro de una variable que ningun
  escaneo ve. Test en `tests/rastro-operativo.test.ts`.
- **Mordido en los dos sentidos:** un arbol temporal con las cuatro escrituras clandestinas (las caza) y
  con prosa, otras columnas y el motor (no los marca); y contra el repo real, inyectando un
  `update(deals).set({ etapa })` en `lib/`.
- El mensaje del fallo dice que hacer: usa `moverEtapa()`.
