---
id: 073
etapa: E6
serves: "plan v2 §6 etapa 6 · tarea E6-5 · insumo §2.2 y §4.3"
depends: [072]
status: done
---

# 073 — Ficha del Lead: todos sus envios, con el diff entre ellos

## Objetivo

Que se pueda ver, de una persona, **todo lo que dijo y cuando lo dijo**. Reemplaza a
`/personas/[id]`.

## Alcance

- **Dentro:** los envios en orden (por `posicion_en_hoja`, no por fecha: los parciales llevan
  fecha placeholder), con **el diff entre uno y el siguiente**. 🎯 Ahi es donde se ve "en julio
  decia que ganaba X y en septiembre Y", que es informacion comercial de verdad y hoy no existe.
- **Dentro:** los contactos (correos y telefonos) con **de que envio llego cada uno**.
- **Dentro:** los deals abiertos y **los cerrados**: reaplicar abre deal nuevo y los anteriores se
  ven (ADR 0037).
- **Dentro:** las respuestas no promovidas del `jsonb`, legibles, con su encabezado.
- **Dentro:** la marca "unido por telefono" y la de "desaparecio de la hoja", visibles.
- **Fuera:** editar el lead a mano. Lo que viene de la hoja lo manda la hoja (ADR 0004).

## Done cuando

- [x] Un lead con tres envios muestra los tres y las diferencias entre ellos.
- [x] Una columna que no existia en el envio viejo se ve como "no habia", no como vacia.
- [x] Los deals cerrados se ven sin tener que buscarlos.
- [ ] Recorrido visual con clic en todo lo que se abre (lo hace la sesion principal: el worktree no corre `next dev`).

## Kiro

Si, con revision visual.

## Hecho (2-oct, rama `ticket-073`)

- **Ruta:** `/p/[programa]/leads/[id]` (`app/(app)/p/[programa]/leads/[id]/page.tsx`). Misma guarda y
  alcance que la ficha del deal: `paginaConRol` + `rolDeVista` + `programaVisiblePorSlug`; un id que no
  es uuid, un lead inexistente o de otro programa es 404 sin decir cual. Solo lectura.
- **Lectura:** `fichaDeLead(db, programId, leadId)` en `lib/queries/ficha-lead.ts`, con tres funciones
  puras probadas aparte: `ordenarEnvios` (posicion en la hoja; lo del webhook despues, por llegada; la
  fecha nunca ordena), `camposDelEnvio` (promovidos + respuestas crudas con su encabezado; los UTM salen
  por `utmsDelEnvio` y las llaves `utm_*` de `respuestas` no se repiten) y `diferenciasEntreEnvios`
  (valor de tres formas: `no_habia`, `vacio`, `valor`; "no habia" contra "vacio" no es un cambio, una
  pregunta que desaparece si).
- **Pantalla:** `components/leads/ficha-lead.tsx`, server components (cero estado de cliente): cabecera
  con las marcas (alta manual, estado, lead quality/value, **unido por telefono**, abandono el
  formulario), envios del mas reciente al primero con su diff y `<details>` nativo para todas las
  respuestas, deals en dos grupos (abiertos; cerrados y anulados, el anulado tachado y sin tono) con
  enlace a su ficha y el envio que lo abrio, y contactos con "llego en el envio #n" o "agregado a mano".
- **`/personas/[id]` redirige** a la ficha dentro del programa (`slugDelLeadVisible`, con la funcion de
  alcance): los enlaces viejos (buscador de Personas, migracion, entregas del webhook) siguen llegando.
  Se borraron `historialDePersona`, `components/historial-persona.tsx` y su test; la prueba de frontera
  de `tests/alcance-de-sesion.test.ts` pasa a `slugDelLeadVisible`. La tab Leads, los posibles
  duplicados y la ficha del deal ("Ver la ficha del lead") enlazan directo a la ficha nueva.
- **Tests:** `tests/ficha-lead.test.ts` (12) y las guardas de las dos rutas en `tests/paginas.test.ts`.
- 🔴 **"Desaparecio de la hoja" no se construyo:** no hay dato que lo diga. El sync se retiro el 28-sep
  (ticket 108) y ninguna columna registra que una fila dejo de estar en la hoja; construirlo pediria
  esquema y un proceso que vuelva a leer la hoja. Con el corte a webhook la marca pierde sentido;
  queda para que Mani decida si se retira del alcance.
- **Lo que la ficha vieja mostraba y la nueva no:** la lista de llamadas del lead. Las llamadas cuelgan
  del deal (ADR 0037) y se ven en la ficha de cada deal, a un clic.

