# 0057 — El programa lleva su formulario y su token de Calendly

- **Estado:** aceptada · 28-sep-2026 (Mani)
- **Relacionadas:** ADR 0012 (instancias en la base), ADR 0049 (Calendly), ADR 0054 (el agendo),
  ADR 0055 (el secreto del webhook, que es el precedente), tickets 092, 100 y 109

## Contexto

Mani, 28-sep: *"para crear un programa en el CRM, sí o sí toca asociarle su forms link base y su
Calendly access token"*. Hoy `programs` no tiene ninguno de los dos.

El token hace falta para leer la fecha de una cita. El link que Typeform guarda de la pregunta de
Calendly **no trae la fecha**: es `https://calendly.com/d/<evento>/<nombre>/invitees/<uuid>`
(verificado en la hoja de Tactical). Se probó el 28-sep con los tokens reales: los dos son de rol
`owner` en su organización (ven las citas de todos los closers), cada organización tiene un solo tipo
de evento, y los 10 ids de invitado tomados de la hoja aparecieron en la API **con su fecha**.

## Decisión

1. **`programs` guarda la URL base de su formulario y su token de Calendly.** Un programa **no se
   activa** sin los dos: la reja responde 422 y la fila no se mueve, como una fuente webhook activa sin
   secreto (ticket 105).
2. **El token vive en la base, no en variables de entorno.** Si viviera en Vercel, crear un programa
   pediría tocar Vercel y redesplegar, y eso rompe el criterio de aceptación 4 ("un programa nuevo sin
   tocar código") y el ADR 0012. Es la **segunda excepción nombrada** a "secretos solo en `.env.local`
   y en Vercel", con las mismas reglas que el secreto del webhook: lo escribe **una sola función**, se
   muestra una vez al guardarlo, **nunca** pasa por el molde ni por `change_log`, y ninguna lectura del
   catálogo ni de la pantalla lo devuelve. Un test lo muerde.
3. **Quién:** se edita en `/ajustes/programas`, que exige gerente (y el developer, ADR 0025).
4. **Cómo se lee una cita desde un envío:** se piden las citas de la organización filtradas por el
   correo del lead (viene en el mismo envío) y se toma la que tenga **el mismo uuid de invitado** que
   el link. El emparejamiento es por uuid, exacto; el correo solo acota la búsqueda. Si no aparece, la
   cita no se inventa: el envío entra y el rechazo queda visible.

## Consecuencias

- Los dos programas actuales no tienen ninguno de los dos valores: la columna nace nula, Mani los carga
  desde la app, y solo después un `CHECK` en la base puede exigirlos en todo programa activo (un
  `CHECK` se crea después de arreglar los datos).
- Mientras la pantalla no exista, los tokens viven en `.env.local` (`CALENDLY_TOKEN_COMUNICARTE`,
  `CALENDLY_TOKEN_TACTICAL`) solo para probar. Se borran de ahí al cargarlos en la app.
- Un token de Calendly es de una persona (el owner). Si esa persona sale de la organización, el token
  deja de servir: la app tiene que mostrar un error visible, no dejar de leer fechas en silencio.

## Enmienda 28-sep (cierre del 109 y del 052)

- **Hecho.** Los dos tokens se cargaron desde `/ajustes/programas` y se borraron de `.env.local`. El
  formulario los llama **Forms Link** y **Calendly Token**; el token se ve con puntos y nunca vuelve al
  navegador.
- **Migración 0031:** `programs.activo` nace en `false` y el CHECK
  `programs_activo_con_formulario_y_token` exige los dos valores en todo programa activo.
- **Punto 4, en el 052:** la cita se lee en la ruta del webhook, **antes** de la transacción de ingesta
  (`lib/calendly/resolver-cita.ts`). Una cita **cancelada**, no encontrada o un error de Calendly no
  llevan el deal a Agendado: queda en **Pendiente Setteo** con una nota (Mani, 28-sep). Esa nota la
  escribe el sistema en `deal_actividades` con `user_id` nulo (migración 0032); el sistema solo deja
  notas, nunca contactos (CHECK `deal_actividades_contacto_con_usuario`).
- Que el lead no se quede sin llamada para siempre es del 096: la llamada que llegue después desde
  Calendly se cuelga sola, y un closer puede asociarla a mano o volver a buscarla.

