---
id: 075
etapa: E6
serves: "plan v2 §6 etapa 6 · tarea E6-8 · plan v2 §11 (pendiente transversal)"
depends: [069, 070, 071, 072, 073, 074]
status: todo
---

# 075 — Revision profunda de TODA la UI, no solo de lo nuevo

> **Mani, 21-sep:** *"la UI es otra cosa que me va a tocar definir luego de construir ya que es
> literal lo que el equipo va a ver. Debe ser lo mas amigable y facil de usar posible, enfocado a
> utilidad sobre todo."*

## Por que este ticket existe aparte de las pantallas nuevas

1. **La UI de hoy se construyo ticket por ticket, sobre el modelo viejo.** `/mi-dia`, `/personas`,
   `/programas/[slug]` y `/nerd-stats` nacieron para persona → llamada → venta. Despues de la
   etapa 5 van a funcionar sobre deals **con la forma de la epoca anterior**. Eso produce una app
   que funciona y **se siente cosida**.
2. **Nunca ha existido un criterio de UI escrito para este repo.** Hay ADRs para el dinero, los
   roles, la vigencia y el catalogo. Para la interfaz, ninguno: cada pantalla resuelve la
   navegacion, los vacios y los errores a su manera.
3. **El equipo real todavia no la ha usado.** Cero closers, cero registros. La primera revision con
   criterio de usabilidad va a encontrar cosas que ningun test ve.

## Que cubre, como minimo

- Navegacion y jerarquia entre pantallas.
- Que ve alguien que abre la app **por primera vez**.
- Los **estados vacios** y los **mensajes de error**.
- El flujo completo de un closer en un dia **sin tener que acordarse de nada**.
- El **celular**: un closer registra un abono desde el telefono en mitad de una llamada.
- La consistencia de los componentes entre pantallas.

## ⚠️ La decision que hay que tomar al abrir esta etapa

**O entran tests de componente, o la garantia sigue siendo el recorrido visual a mano.** No se
vale asumir que los tests actuales cubren esto:

- El 20-sep **dos bugs pasaron con 669 tests en verde**, y los dos eran codigo que ningun test
  podia ver: un `disabled` mal escrito que dejo un boton muerto, y una funcion de `lib/` **que
  nadie llamaba** y estaba mal desde el dia que se escribio.
- **Base UI lanza en tiempo de ejecucion, no en compilacion.** Un `DropdownMenuLabel` fuera de su
  `Menu.Group` tumbo la pagina entera **al abrir el menu**, con 543 tests en verde, y estuvo roto
  dias.
- **Cargar una pantalla no es probarla.** Lo que rompe son las **interacciones**: abrir un menu,
  desplegar un select, abrir un dialogo. **Hay que hacer clic en todo lo que se abre y mirar la
  consola.**
- **Y para una regla de permiso, hacer clic tampoco alcanza: hay que forjar la peticion.** Mirar
  que el boton no aparezca prueba lo unico que un atacante no hace.

## Done cuando

- [ ] La decision sobre tests de componente esta **tomada y escrita** (si entran, con su ADR).
- [ ] Recorrido completo de la app **haciendo clic en todo lo que se abre**, con la consola
      abierta, en escritorio y en celular.
- [ ] Los estados vacios de cada pantalla dicen que hacer, no solo que no hay nada.
- [ ] Existe un criterio de UI escrito para este repo, aunque sea corto.

## Kiro

Parcial. El inventario y los arreglos si; el criterio, no.
