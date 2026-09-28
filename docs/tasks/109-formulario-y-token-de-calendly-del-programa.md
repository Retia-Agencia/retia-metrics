---
id: 109
etapa: E3
serves: "ADR 0057 · criterio de aceptación 4 · desbloquea el 052 (Setteo → Agendado)"
depends: [105]
status: todo
---

# 109 — El programa lleva su formulario y su token de Calendly

## Objetivo

Que un programa no se pueda activar sin la URL base de su formulario y su token de Calendly, y que el
CRM pueda leer la fecha real de una cita a partir del link que manda Typeform (ADR 0057).

## Alcance

- **Migración (sesión principal):** `programs.form_url` y `programs.calendly_token`, nulas. Sin `CHECK`
  todavía: los dos programas activos no tienen valores.
- **La reja:** activar (o crear activo) un programa sin los dos es 422 y la fila no se mueve.
- **El token, como el secreto del webhook (105):** lo escribe solo una función (`guardarTokenCalendly`
  o similar), se muestra una vez, nunca pasa por el molde ni por `change_log`, y ninguna lectura lo
  devuelve. Test que lo muerda.
- **La pantalla:** en `/ajustes/programas` (gerente y developer), el campo del link y el del token.
- **La lectura de la cita:** una función de `lib/` que, con el token del programa, el correo del lead y
  el uuid del invitado del link, devuelve la fecha de la cita o `null`. Empareja por uuid, nunca solo
  por correo. Un error de la API (token vencido) es visible, no un `null` silencioso.
- **Enchufe con el 052:** con la fecha, la regla crea la llamada agendada y mueve Setteo → Agendado por
  el motor. Eso se cierra en el 052, no aquí.
- **Relación con el 092:** `form_url` es la misma columna que el 092 necesita para el generador de
  links. Si el 092 ya la creó, este ticket la usa.

## Done cuando

- [ ] Activar un programa sin link o sin token es 422 y la base no se mueve; con los dos, se activa.
- [ ] El token no aparece en el HTML de la pantalla, ni en `change_log`, ni en ninguna lectura del
      catálogo (test).
- [ ] La función de la cita devuelve la fecha real de un invitado de Tactical (probado a mano con el
      token real) y `null` para un uuid que no existe.
- [ ] `npm test`, `npm run typecheck`, `npm run lint` y `npm run build` limpios.
- [ ] Mani carga los dos tokens desde la app y se borran de `.env.local`.

## Kiro

Sí el código y los tests, con revisión. La migración la escribe y aplica la sesión principal.
