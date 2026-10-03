---
id: 169
etapa: O3
serves: "docs/anotaciones.md A-54, A-62 (host sin cuenta), A-67, A-69; ADR 0077 punto 5; ADR 0076"
depends: []
status: en curso (S2, sesión de Mani, 3-oct)
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

- Una cita con host registrado deja la llamada con closer y el deal con ese dueño; probado con `simular:cita` en
  `dev:local` y en tests de la ruta real.
- Una cita con host sin cuenta sale en rojo en el Inbox y no se pierde.
- El relleno en seco reporta cuántas llamadas casan y cuáles no; aplicado solo con el ok de Mani.
- El desplegable muestra solo correos libres y guarda al elegir; elegir una cuenta ya tomada, forjando la acción, da
  error sin mover la base.
- `npm run build` en verde; recorrido del handoff en `dev:local`, consola abierta.
