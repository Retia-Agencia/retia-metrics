---
id: 278
etapa: plataforma
serves: "Todas las conexiones de un programa con servicios externos (tokens, llaves de API, secretos de webhook) se ven y se configuran en un solo lugar, y agregar una integración nueva es agregar un tipo, no una pantalla (Mani, 19-oct)"
depends: []
status: todo
---

# 278 — Programa › Integraciones

## Por qué

Hoy cada integración vive donde cayó cuando se construyó, con un molde de secreto copiado en cada lugar:

- Token de Calendly y su clave de firma: en `programs` (ADR 0057, ticket 109; 096).
- Token de Typeform: en `sources.typeform_token` (126 B).
- Secreto HMAC del webhook: en `sources.secreto_webhook` (ADR 0055, 105).
- Token de Meta: en `meta_conexiones`, uno global (ADR 0062, 119).
- Llave de Form30x: variable de Vercel (ADR 0093).
- Llave de la API de Dapta: hoy solo en el `~/.zshrc` de Mani (`DFORMS_API_KEY_<WORKSPACE>`), y la necesita el 279.

Mani (19-oct): *"que todo quede por programa, como una pestaña de integraciones, para que sea súper sencillo
agregar nuevas integraciones. Ahí podemos meter todos los tokens, APIs, webhooks. Hay que pensarlo muy bien."*

## Decidido con Mani (19-oct, `/grill-with-docs`) — ADR 0095

1. **Modelo:** tabla `integraciones`, una fila por `(programa, tipo)`; tipo `pgEnum` (`dapta`, `typeform`, `calendly`,
   `meta`); `secretos` jsonb (nunca se devuelve), `config` jsonb no secreta, `probada_en`.
2. **Entran Dapta, Typeform, Calendly y Meta.** Meta pasa a token **por programa** (el gasto de una cuenta se lee con
   el token de su programa). Fuera, como heredados con enlace: el HMAC de cada fuente y Form30x.
3. **Molde único en `lib/integraciones/`:** registro exhaustivo `INTEGRACIONES` (esquemas + `probar()`), un escritor
   que guarda solo si la prueba pasa y deja `change_log` con el valor oculto, un lector por tipo, test guardián. El
   HMAC de las fuentes usa el mismo helper de rastro oculto.
4. **Migración en dos pasos:** (1) crea la tabla y copia en SQL (`INSERT ... SELECT`); el código lee solo de
   `integraciones`; el CHECK `programs_activo_con_token` sale y lo verifica `reactivarPrograma`. (2) Tras verificar en
   producción citas, envíos y gasto, se borran `programs.calendly_token`, `programs.calendly_signing_key`,
   `sources.typeform_token` y `meta_conexiones`.
5. **La ve `configuraPrograma`** (gerente y developer) dentro del alcance del ADR 0094; se muerde forjando la petición.
6. **Se quita:** token de Typeform en cada fuente, tarjeta Calendly de Captación, tarjeta Cuentas de Meta de General y
   Ajustes › Meta entero. Meta en Integraciones trae su token, sus cuentas y "sincronizar ahora".

## Done cuando

ADR con el modelo; la pestaña Programa › Integraciones muestra cada integración con su estado (configurada o no, probada
cuándo) sin devolver nunca un secreto; la llave de Dapta se guarda ahí (desbloquea el 279); el molde de secreto vive en
un solo módulo con su guardián; y lo que se decida mover (Calendly, Typeform) se migró sin perder un envío ni una cita.
