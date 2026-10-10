---
id: 075
etapa: E6
serves: "plan v2 §6 etapa 6 · tarea E6-8 · plan v2 §11 (pendiente transversal)"
depends: [069, 070, 071, 072, 073, 074]
status: en curso
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

---

## Nota 2026-09-24 (ADR 0050)

El criterio de navegación que faltaba ya existe: tabs por objeto, selector de programa, Inbox y
Dashboard. Esta revisión incluye además las tabs 095, 097, 098, 099 y 100.

## Observaciones de Mani, 28-sep (recorrido de `/ajustes/salud` y Personas)

Anotadas para atacarlas aquí, no antes: la UI se pule en esta etapa.

1. **El selector de programa no le gusta** (el `<select>` nativo arriba a la derecha de `/ajustes/salud`).
   Hoy cada pantalla por programa lo resuelve a su manera; conviene UN selector de programa común.
2. **La conciliación con Sheets muestra un bloque de tokens crudos**: no ocupa el ancho de la pantalla y
   no hace falta verlo de entrada. Lo crudo va **plegado** (desplegable) o **conciso y tabulado, estilo
   hoja** (filas y columnas), no como una lista de caracteres. De entrada: los conteos.
3. **"Personas" no le gusta cómo se ve, y se llama Leads**: la lista de pantallas ya dice "Leads, Deals,
   Calls, Students" (`docs/structure.md` §8), pero la navegación y la ruta siguen en `/personas`.
4. **Regla general que sale de 2:** el dato crudo en cualquier pantalla se muestra desplegable o
   tabulado, nunca en bruto de entrada.

---

## Anotaciones de UI (30-sep, Mani)

Este ticket recoge de [`docs/anotaciones.md`](../anotaciones.md): A-02, A-03, A-04 (closer sin membresía), A-05 (el hub del closer), A-06 (sin scroll infinito ni subsecciones apiladas), A-07 y A-08 (Kanban), A-12, A-13 (su construcción vive en el 128), A-15, A-16 y A-17 (Facturación de la ficha del deal, recorrido del 139, 1-oct), y los principios P-1 (el CRM trae el contexto, no se busca a mano) y P-2 como criterio de revisión de toda pantalla. El texto vive allá.

---

## Avance 9-oct (Alejo + Claude)

**Decisión de tests tomada: ADR 0083.** No entran tests de componente: entra un humo de Playwright
(`e2e/humo.spec.ts`, `npm run test:humo`) que entra con cada rol de la base local, recorre cada pantalla global,
cada tab de cada programa y la primera ficha de deal y de lead, hace clic en todo (botones, selects, menús,
plegables y un nivel dentro de cada diálogo) y falla con cualquier error de consola o de página, un 5xx, una sesión
perdida o menos de 3 pantallas probadas. Aborta en la red toda petición que no sea GET: ninguna server action llega
al servidor. Lo que una página escribe al renderizar un GET sí ocurre (abrir un deal propio lo marca visto), por eso
corre solo contra `dev:local`.

- **Mordido:** con el `DropdownMenuLabel` del 18-sep reintroducido fuera de su grupo, falla con
  `MenuGroupContext is missing`. Restaurado, pasa.
- **Primera corrida:** developer, closer y paid trafficker, en escritorio (1440×900) y celular (Pixel 7), **sin
  hallazgos**. Corrió contra una base local vieja (sin gerente, con un `pauta@` creado a mano); el seed ahora crea
  al paid trafficker, y un rol que falta hace fallar el humo en vez de saltarse.
- **Revisión del cadenero (9-oct, otra sesión):** aprobó el código de la app; pidió arreglar el humo (regex de
  nombres sin `\s`, verdes falsos por sesión perdida o rol faltante, filtro del corte demasiado ancho) y que el ADR
  dijera lo que el spec hace. Aplicado. Quedan como sugerencia: aprovechar en la ficha las `sugerencias` por teléfono
  que ya calcula `llamadasSueltasDelPrograma`, y que `saldoLegible` diga si el valor es cifra.
- El humo no ve: un botón que no hace lo que debe, los permisos (eso se muerde forjando la petición) ni la
  usabilidad. El recorrido a mano sigue para eso.

**Anotaciones de este ticket, verificadas en el código:**

| Id | Estado al 9-oct |
|---|---|
| A-02 | Parcial: las llamadas de la ficha abren su detalle (163); abonos y actividades no tienen vista propia |
| A-03 | **Reemplazada:** se arregló en la ficha, pero al rebasar sobre `main` el 219 (ADR 0081) ya había quitado "Agregar llamada": la cita se registra dentro de Mover. No se reintrodujo. Pendiente: ofrecer las sueltas del programa en el paso de la cita de Mover (`dialogo-mover.tsx`, archivo del carril de Mani) |
| A-06 | Criterio transversal: va al criterio de UI escrito (pendiente) |
| A-07 | Resuelta: columnas con scroll propio y totales en USD al pie (potencial y confirmado) |
| A-08 | Resuelta: el tablero se desplaza solo al arrastrar cerca del borde |
| A-12 | **Arreglada 9-oct:** la lista de Leads y Mi espacio muestran el teléfono en común lado a lado; ficha y lista lo sacan de `telefonosEnComun` |
| A-15 | Resuelta: "Cambiar cohorte" sale una sola vez |
| A-16 | Por revisar a 375 px en el recorrido a mano |
| A-17 | **Arreglada 9-oct:** Students ya no pinta el texto con `cifra` |

**Falta para cerrar:** el recorrido a mano (usabilidad, estados vacíos, el día de un closer, 375 px), el criterio
de UI escrito y lo que salga del recorrido. A-12 y A-17 quedaron arregladas el mismo 9-oct; A-03 pasa al paso de la cita de Mover. Meter el humo al CI queda como
paso siguiente del ADR 0083.
