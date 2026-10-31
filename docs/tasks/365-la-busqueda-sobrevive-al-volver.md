---
id: 365
etapa: crm
serves: "Michael Castellanos, Daily Tech del 31-oct · A-172 · A-105 (la pieza de búsqueda y filtros) · ticket 'que toda lista sepa volver' (`enlaceConVuelta`)"
depends: []
status: done
---

# 365 — La búsqueda de una lista sobrevive al abrir una ficha y volver

## Por qué (dicho en la reunión, 31-oct; causa sin leer en el código todavía)

Michael busca en Leads (un nombre, o el número de un lead), abre una ficha y al volver **la búsqueda se borró**: tiene
que escribirla otra vez. Mani lo ubicó como tema de migas de pan (breadcrumb): el "volver" no restituye la búsqueda.
Michael: es un cambio chico que vuelve la lista mucho más útil.

## Alcance (ampliado el 31-oct por Mani: regla de todo el CRM)

**Regla:** abrir una pestaña, una pantalla, una ficha o un pop-up y volver (con "Volver", la miga de pan o el Atrás del
navegador, sin importar cuántos saltos seguidos) deja a la persona en el MISMO estado: búsqueda, filtros, orden,
página, pestaña/sección, vista y scroll.

**Decisiones (Mani, 31-oct):**

1. La búsqueda por texto viaja en la URL como `?q=`, igual que ya hacen Calls, Students, Media y Notificaciones
   (`BuscadorUrl`). Esto **enmienda** la regla "ningún dato personal en URLs" de `AGENTS.md` y el comentario de
   `lib/queries/leads.ts` ("nunca viaja en la URL"): ADR nuevo con el siguiente número libre, y se reescriben en el mismo
   commit la regla de AGENTS.md y ese comentario. Los identificadores en rutas siguen siendo ids opacos.
2. "Volver" usa el historial real del navegador (`router.back()`) cuando la página anterior es de la app, y cae a
   `?desde=` (`destinoDeVolver`) solo si se entró directo por enlace o en pestaña nueva. Así N saltos vuelven N pasos.

**Dónde se pierde hoy (leído en el código):**

- Leads: `BuscadorDeLeads` guarda el texto en `useState` y consulta por server action; el panel y el texto mueren al
  navegar. Deals: `BuscadorDeDeals` + `BusquedaDeDeals` (contexto en memoria con `idsVisibles`), igual.
- `Volver` es un `<Link href={desde}>`: empuja una entrada nueva en vez de retroceder, y `desde` es de un solo salto.
- Cambiar de programa (`rutaAlCambiarDePrograma`) suelta los filtros a propósito (son del programa anterior); eso se
  mantiene, pero el Atrás del navegador debe regresar al estado previo.

**Trabajo:**

1. Leads y Deals pasan a `?q=` (pieza `BuscadorUrl`, filtrado en el servidor con `leadsQueCasan`); se retiran los dos
   buscadores en memoria y el contexto. Una sola pieza de búsqueda para todas las listas.
2. `Volver` (y las migas) con `router.back()` cuando hay entrada previa de la app; fallback a `desde`.
3. Auditar y cubrir TODO estado de vista que hoy vive solo en memoria: pestañas/secciones, vista Tabla/Kanban, orden,
   página, filtros, selectores de periodo; pasan a la URL (con `router.push`, para que Atrás los recupere) o se
   documenta por qué no. Restaurar el scroll de la lista al volver.
4. Diálogos/pop-ups que abren una ficha o cambian la URL: cerrar y volver no pierden el estado de la lista.

## Fuera de alcance

- Recordar la búsqueda entre sesiones o al cambiar de programa.
- Guardar búsquedas con nombre.

## Done cuando

- [x] Buscar en Leads y en Deals, abrir una ficha y volver deja búsqueda, filtros, orden, página y scroll como estaban.
- [x] Lo mismo en Calls, Students, Inbox, Media y Hub (pestañas y listas), con varios saltos seguidos.
- [x] Tests: "volver" conserva `q` y demás parámetros; sin búsqueda no agrega nada a la URL; guardián de que ninguna
      pantalla mantiene un buscador de lista en `useState`.
- [x] ADR de la excepción de `?q=` escrito, AGENTS.md y comentario de `lib/queries/leads.ts` reescritos.
- [x] `npm run build`, typecheck y lint limpios (31-oct, worktree limpio).
- [ ] Recorrido en navegador con `dev:local` (pendiente: Docker apagado el 31-oct; lo hace Mani a mano: búsqueda + filtros + orden + página en Leads/Deals/Calls/Students, abrir ficha, Volver y Atrás varios saltos, scroll del Kanban).
