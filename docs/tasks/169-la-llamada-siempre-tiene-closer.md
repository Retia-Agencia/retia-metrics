---
id: 169
etapa: O3
serves: "docs/anotaciones.md A-54, A-62 (host sin cuenta), A-67, A-69; ADR 0077 punto 5; ADR 0076"
depends: []
status: done
---

# 169 — La llamada siempre tiene closer, y el handoff se prueba en local

Sesión **S2** de la ola O3. **Prioridad de Mani:** el emparejamiento entre el dueño de la cita en Calendly y el
closer del CRM. Sin migración de esquema; el relleno de las llamadas existentes escribe en producción y **pide el ok
de Mani**.

## Por qué existe

En la ficha de una cita de Calendly sale "Sin closer". El audit (3-oct): la llamada nace sin `closer_user_id` a
propósito (`lib/calendly/colgar-llamada.ts`, comentario de la función de colgar) y el deal pasa al host
(`darDealAlHost`) solo si el host tiene su cuenta de Calendly en la membresía. Mani: *"las llamadas siempre deben
autoasignarse"*. Y el handoff del setter (157) no hay cómo verlo sin esperar una cita real.

## Alcance

1. **Closer automático (A-54, ADR 0077 punto 5).** En los cuatro caminos de una llamada (ADR 0076), cuando el host
   de la cita casa con la cuenta de Calendly de una membresía activa del programa (`closerHost`,
   `closersConCalendly`), la llamada se escribe con `closer_user_id` = ese usuario, en la misma transacción y con
   rastro (`crearConRastro` / `editarConRastro`). Una re-agenda con otro host cambia el closer de la llamada nueva,
   no el de la vieja. El setter sigue siendo `deals.setter_user_id` (ADR 0076), sin cambios.
2. **Host sin cuenta = rojo en el Inbox (A-62).** Si el host no casa con ninguna membresía, la llamada se guarda
   igual (nunca se pierde) y sale como urgente en el Inbox del programa: "La cita la hospeda {correo}, que no tiene
   cuenta en el CRM. Asígnala en el Equipo del programa." Al asignar esa cuenta (perfil o Equipo), las llamadas
   futuras casan solas; las ya guardadas se reasignan con el mismo relleno del punto 3.
3. **Relleno de lo que ya existe.** Un script en `scripts/` (por `lib/`, con `actorDelScript()`, ADR 0029) que pone
   `closer_user_id` en las llamadas de Calendly vigentes cuyo `calendly_host_email` casa con una membresía, y lista
   las que no casan. Primero corre en seco y muestra el conteo; `--aplicar` solo con el ok de Mani.
4. **La cuenta de Calendly se elige bien (A-67).** `components/calendly-membresias.tsx` (perfil y Ajustes →
   Usuarios hoy; el Equipo del programa con el 171):
   - El desplegable muestra **solo el correo**.
   - Ofrece solo las cuentas de la organización que **ninguna otra membresía del programa** tiene (la base ya lo
     impide con `miembros_programa_calendly_idx`; ahora la pantalla tampoco lo ofrece).
   - **Se guarda al elegir**, sin botón: el servidor comprueba contra Calendly y la fila muestra "Conectada" o el error.
   - El componente queda listo para usarse desde la sección Equipo del 171 (props, sin acoplarse al perfil).
5. **El handoff se reproduce en local (A-69).** `npm run simular:cita` (script nuevo) manda a `dev:local` un webhook
   `invitee.created` (y `invitee.canceled` con una bandera) **firmado** con la clave de firma del programa local, con
   el host, el correo del lead y la fecha que se le pasen. Solo corre contra una base local (`lib/db/es-local.ts`);
   contra cualquier otra se niega. Con él se recorre: setter con el deal → "Link enviado" → cita con host closer →
   el deal pasa al closer, la llamada tiene closer y "Setteado por" queda; host sin cuenta → rojo en el Inbox.
   Los mismos escenarios quedan como tests de la ruta real (`tests/handoff-setter.test.ts`,
   `tests/calendly-colgar-llamada.test.ts`).
6. **Manual (A-54).** En `docs/manuales/operacion-comercial.html`, la sección del setter explica quién queda como
   closer de la llamada, qué pasa si el host no tiene cuenta y dónde se asigna la cuenta. Y `docs/operations.md`
   §2.1 nombra `npm run simular:cita` como la prueba antes de compartir un link.

## Archivos

Suyos: `lib/calendly/*`, `lib/deals/handoff.ts`, `components/calendly-membresias.tsx`, `app/(app)/perfil/acciones.ts`
(solo la acción de Calendly), `lib/queries/inbox.ts` (solo el motivo "host sin cuenta"; el 168 agrega otro motivo:
cada uno el suyo, sin tocar el del otro), `scripts/simular-cita.ts`, el script de relleno, `package.json` (solo la
línea del script), el manual. **No toca** la página `/perfil` (172) ni la ficha del deal (168).

## Done cuando

- [ ] Una cita con host registrado deja la llamada con closer y el deal con ese dueño; probado con `simular:cita` en
  `dev:local` y en tests de la ruta real.
- [x] Una cita con host sin cuenta sale en rojo en el Inbox y no se pierde.
- [ ] El relleno en seco reporta cuántas llamadas casan y cuáles no; aplicado solo con el ok de Mani.
- [ ] El desplegable muestra solo correos libres y guarda al elegir; elegir una cuenta ya tomada, forjando la acción, da
  error sin mover la base.
- [ ] `npm run build` en verde; recorrido del handoff en `dev:local`, consola abierta.

## Nota de cierre (Codex)

La llamada ahora guarda como closer a la host cuya cuenta de Calendly casa con una membresía activa del programa en
la creación, el camino 052, la reagenda y la asignación de una suelta. Si no casa, queda en el bloque urgente del
Inbox. El selector ofrece solo cuentas libres del programa y guarda al cambiar; el servidor devuelve 409 si otra
membresía ya tomó la cuenta. Se agregaron el relleno con ensayo por defecto y `simular:cita`, además de las pruebas de
ruta firmada, rastro, vigencia y frontera por programa.

Verificado: `npm run typecheck`, `npm run lint` y 200 pruebas focalizadas en 11 archivos. El wrapper `npm test` no pudo
usar `ps` por la restricción del sandbox; los mismos archivos pasaron con Vitest y `--configLoader runner`. Quedan para
la sesión con Mani el relleno aplicado, el recorrido en `dev:local` y el build, que esta sesión tenía prohibido correr.

## Estado al empujar (S2, 3-oct)

- Hecho y comprobado por la sesión: typecheck, lint y `npm run build` en verde (build en el worktree con copia APFS).
  Los tests del ticket los corrió Codex (200 en 11 archivos, verdes); la sesión no los repitió porque la máquina
  tenía 8,5 GB de swap en uso (AGENTS.md): los valida el CI y el checkpoint.
- Revisión del diff contra el alcance: el closer se escribe en los caminos A, B/C, la reagenda y la suelta asignada,
  siempre con rastro y `vigente()`. La sesión pasó el bloque "Hosts sin cuenta" del Inbox a `Card` (Tinta, sin borde
  a mano).
- **Pendiente, sesión principal (Mani):** el recorrido del handoff en `dev:local` con `npm run simular:cita`
  (consola abierta), forjar la acción de Calendly con una cuenta tomada (409 y base quieta), y el relleno en seco
  contra producción (`npm run rellenar:closer-llamadas`, solo lee; `--aplicar` con el ok de Mani). Por eso quedan
  sin marcar el primero, el tercero, el cuarto y el quinto punto del "Done cuando".


## Cierre de la sesión central (3-oct)

CI verde en `eb99ffc` (dos excepciones nombradas en los guardianes de alcance y de la clave de firma) y checkpoint `cp-20261003-2`. Recorrido con `simular:cita` en `dev:local`: host registrada → el deal y la llamada pasan a ella y el setter queda; host sin cuenta → rojo en el Inbox. Relleno aplicado en producción con el ok de Mani: 134 llamadas, re-ensayo en 0. Hueco que cierra el pulido de la parte 1: al asignar una cuenta de Calendly, sus llamadas sin closer se asignan solas.
