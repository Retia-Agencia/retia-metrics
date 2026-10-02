# 0074 — Lo propio del closer lo edita el closer; lo que decide acceso o atribución, quien administra

- **Estado:** aceptado · 2-oct-2026 (Mani). Se construye en el [152](../tasks/152-el-closer-asigna-su-calendly.md).
- **Enmienda:** ticket 096 / ADR 0049 en un punto: la cuenta de Calendly de una membresía ya no la asigna solo quien
  administra; también la asigna el closer dueño de esa membresía.
- **Confirma:** ADR 0030 (el `closer_id` lo decide quien administra), ADR 0003 y 0025 (los roles y las membresías los
  decide quien administra).

## Contexto

Con cinco closers, y dos más que entran, cada dato personal de un closer pasaba por el gerente o el developer: la
cuenta de Calendly de cada programa se asignaba en `/ajustes/usuarios`. Mani (2-oct): *"cae mucho trabajo sobre el
gerente / dev teniendo que estar actualizando datos de otras personas"*.

## Decisión

1. **La regla:** un dato que describe al closer y no cambia de quién es el trabajo de otro lo edita el propio closer.
   Un dato que da acceso (rol, membresía a un programa) o que reparte el crédito de llamadas y ventas (`closer_id`)
   lo sigue editando quien administra (`esAdministrador`).
2. **La cuenta de Calendly de cada membresía es del closer.** La asigna y la cambia él mismo desde `/perfil`, una por
   programa donde tiene membresía activa. Quien administra la sigue pudiendo cambiar en `/ajustes/usuarios`.
3. **Las rejas no se aflojan:**
   - La membresía se resuelve con la sesión, no con el input: un closer solo toca las suyas (lo mismo que el 031).
   - La lista válida la vuelve a pedir el servidor a la organización de Calendly del programa; lo que mande el
     cliente no se cree (igual que hoy).
   - El índice único por `(programa, lower(calendly_email))` impide tomar una cuenta que ya tiene otro closer.
   - Cada cambio va a `change_log` con quién lo hizo.
4. **El riesgo que queda, aceptado:** un closer podría tomar una cuenta todavía libre que es de otra persona. Con
   siete closers se ve en el log y se corrige; no justifica una aprobación.

## Consecuencias

- `asignarCalendlyDeMembresia` acepta como actor al dueño de la membresía además de quien administra; la pregunta
  "¿puede tocar esta membresía?" vive en `lib/auth/roles.ts` o junto a la mutación, no en la pantalla.
- Un dato nuevo del closer se clasifica con la regla del punto 1 antes de decidir quién lo edita.
