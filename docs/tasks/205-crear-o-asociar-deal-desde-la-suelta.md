---
id: 205
etapa: O7
serves: "docs/anotaciones.md A-108; enmienda el ticket 096 (ADR 0049 punto 7)"
depends: [096, 098, 157]
status: done
---

# 205 — Desde una llamada suelta se crea el deal o se asocia a uno existente

## Por qué existe

El 8-oct, después del reinicio en cero (203), Santiago Sierra agendó en Calendly de ComunicArte **sin enviar
nunca el formulario**. La llamada entró suelta (`sin_lead`) con su host como dueña, y no tenía salida: el
Inbox solo deja **asociar** una suelta a un deal abierto que ya exista, y para alguien que solo tiene la
cita no existe ninguno. La única ruta era crear el lead a mano en otra pantalla y volver.

## Decisión (Mani, 8-oct)

La suelta sigue siendo suelta, sin deal y con la host como dueña (como hoy). En "Sin deal" del Inbox cada
suelta ofrece **dos acciones, al mismo nivel**:

1. **Asociar a un deal** (existe: `asignarLlamadaSuelta`).
2. **Crear deal** (nuevo): una plantilla básica que crea el lead y su deal y cuelga la llamada en una sola
   operación.

## Alcance

- **Crear deal** abre un diálogo con el **correo de la llamada fijo** (no se edita: es la llave del dedup) y
  nombre y teléfono **prellenados** si la llamada ya los conoce por lo que Calendly mandó, editables.
- Una sola transacción: lead por `crearPersonaManual` (dedup por `(program_id, email)`), deal por
  `crearDealAMano` y la llamada colgada por el mismo camino de `asignarLlamadaSuelta` (Agendado y dueño = la
  host). Si cualquier paso falla, no queda nada a medias.
- Si el correo ya es de un lead **con** deal abierto, no se crea otro: el error `DealYaAbierto` se muestra
  como "Este correo ya tiene un deal: asócialo" y el diálogo ofrece asociarlo a ese.
- Permiso y alcance iguales a los de asociar (servidor, por el programa de la llamada; ajeno = 404).
- El lead nace **sin UTM**: es un hecho del lead, no un error.

## Done cuando

- [x] Las dos acciones en cada suelta del Inbox; la de crear deja el deal en Agendado con la host como dueña.
- [x] Tests: crea lead + deal + cuelga en una transacción; correo con deal abierto → 409 sin escribir nada;
      programa ajeno → 404; correo existente sin deal abierto reutiliza el lead.
- [x] typecheck, lint y build limpios.

## Cierre (15-oct)

Hecho en `40aeff2` (8-oct), dentro del checkpoint verde `cp-20261009-1`; el tracker lo tenía en `todo`.
`crearDealDesdeSuelta` (`lib/calendly/colgar-llamada.ts`) y su acción en el Inbox; tests en
`tests/calendly-colgar-llamada.test.ts`. El 409 muestra el mensaje de `crearDealAMano` y un botón
"Asignar a un deal" en vez del texto literal "asócialo"; la salida es la misma.
