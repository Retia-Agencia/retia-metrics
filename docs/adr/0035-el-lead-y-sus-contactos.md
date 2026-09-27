# 0035 — El Lead es una persona dentro de un programa; el correo manda y el teléfono une y marca

**Fecha:** 2026-09-21 · **Reescrito:** 2026-09-27 (el renombre `people` → `leads` ya se aplicó en la
migración 0020) · **Estado:** aceptado

## Decidimos

**1. El Lead es una persona dentro de un programa** (tabla `leads`). La llave es
`(program_id, correo_principal)`, única en la base (ADR 0005). La misma persona en dos programas son
**dos Leads** y no se deduplican entre sí: el programa es frontera (ADR 0043).

**2. Un Lead puede tener varios correos y teléfonos: tabla `lead_contactos`**
`(lead_id, program_id, tipo correo|telefono, valor, submission_id, es_principal, confirmado)`, única
sobre `(program_id, tipo, valor)`. Cada contacto sabe de qué envío llegó, así que *"¿desde cuándo
tenemos este número?"* es una consulta. `program_id` va denormalizado a propósito, para que el índice
único haga cumplir la frontera.

**3. El correo manda. El teléfono UNE Y MARCA; nunca fusiona a ciegas.** Un envío con el mismo correo
es el mismo Lead. Un envío con teléfono igual y correo distinto se suma al Lead existente **marcado
como "unido por teléfono"**. Un gerente resuelve la marca: **separar** (vuelve a ser un Lead propio con
su historial) o **dejar unido** (queda registrado quién lo confirmó). Mientras tanto el deal funciona
normal: la marca es un aviso, no una reja.

**Por qué no fusionar y ya:** fusionar dos personas **no se puede deshacer mirando los datos**. El
error de no fusionar es visible (dos tarjetas parecidas); el de fusionar es invisible y permanente.
Cuando el costo de los dos errores es asimétrico, se elige el reversible. Medido: **37 teléfonos de
Tactical tienen más de un correo** (pareja, socio, el celular de la casa), y el script de la hoja
fusionaba por teléfono.

**4. El dueño no es del Lead, es del Deal** (ADR 0037).

**Implementado:** `resolverIdentidad` en `lib/ingesta/identidad.ts`, cableada en `ingerirEntradas`.

## Abierto

- Qué hace la app con un Lead marcado que nadie resuelve. Si la lista de posibles duplicados crece
  sin que nadie la mire, falta un recordatorio, no una regla.
- `leads.estado` es texto desde la migración 0020; si se retira en favor de `calificacion` es la
  decisión D4 (`docs/plan.md` §7).

## Descartado

**Una entidad "persona" global por encima de los Leads:** resolvería "la misma persona en dos
programas", que nadie pidió resolver. Medido el 21-sep: 5 correos de 4.823 estaban en los dos
programas (ADR 0043).
