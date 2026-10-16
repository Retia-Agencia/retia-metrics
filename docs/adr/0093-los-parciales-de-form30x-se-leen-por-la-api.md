# 0093: Los parciales de Form30x se leen por la API cada 30 minutos, con la key de la compañía

- **Estado:** aceptado, 15-oct-2026 (Mani, después de la prueba de SBJ). Se construye en el 272.
- **Enmienda:** ADR 0092, puntos 5 y 6 (decían que sin webhook de parciales SBJ no tenía Potencial, y que ninguna
  ruta de la app leía la key).
- **Confirma:** ADR 0058 (el sobre crudo se guarda antes de procesar), ADR 0069 (un parcial nace en Potencial), ADR
  0073 (el completo sube la puerta del mismo deal).

## Contexto

La prueba del 15-oct (noche) midió que Form30x **guarda** el parcial (`completed: false` en
`GET /forms/:id/responses`, con sus `tags` ya calculados) pero el webhook **solo dispara `response.completed`**. Quien
deja el formulario a medias es justo el lead que el closer quiere recuperar (Potencial). Mani pidió dos cosas: leerlos
por la API para no perderlos, y pedirle a 30X que el webhook también mande parciales.

Dos hechos ponen el límite:

- **No existen keys de solo lectura por form.** Los scopes de Form30x son `forms:read`, `forms:write` y
  `responses:read`, todos de la compañía entera; según Mani, en la práctica solo hay la key que ya tenemos, que lee y
  edita todos los forms de 30X y EstadoX. Mani asume el riesgo de subirla.
- **Vercel Hobby solo permite crons diarios**, y los dos que hay ya están en uso (comprobantes y pauta).

## Decisión

1. **La key vive en Vercel como `FORM_30X_API_KEY`** (solo producción, no en la base: es una sola para el sistema,
   no una fila editable). **La lee UN solo módulo, `lib/form30x/api.ts`**, que solo expone la lectura de respuestas
   de un form por id (`GET /forms/:id/responses`). No hay en el código ningún `PATCH`, `PUT`, `POST` ni `DELETE` hacia
   Form30x, y un guardián lo vigila: ningún otro archivo nombra la variable ni el host de la API.
2. **El form que se lee lo dice la fuente** (`sources.form30x_form_id`, columna nueva), nunca un literal en el código
   (ADR 0012). Solo se leen las fuentes `form30x` activas que lo tengan.
3. **Cada 30 minutos lo dispara GitHub Actions** (workflow programado del repo, gratis) contra
   `POST /api/cron/form30x`, protegida con `CRON_SECRET` como los otros crons. Un retraso del programador de GitHub
   solo atrasa el parcial; no lo pierde. **Corre en los minutos 13 y 43** (`13,43 * * * *`, 16-oct), no en `:00` y
   `:30`: GitHub dice que el schedule es "best effort" y que se atrasa o se salta con carga alta, que se concentra al
   empezar la hora. El primer `*/30` no disparó ni una vez en ~90 min tras arreglar el YAML (las manuales sí). Si
   GitHub sigue sin ser confiable, la alternativa es `pg_cron` + `pg_net` en Supabase ($0, sin proveedor nuevo, pero
   infraestructura fuera del repo y el secreto en la base); Vercel Pro (R3 de `docs/plan.md` §7) cuesta USD 20 por
   usuario al mes, y un cron externo (cron-job.org) le entrega `CRON_SECRET` a un tercero. Ningún runner se da por
   confiable: un aviso de lectura vieja en Webhook Health tiene que delatar al que se caiga.
4. **Se lee una ventana de 48 horas** por `submittedAt`, de la más nueva hacia atrás, siguiendo el cursor. Cada
   respuesta entra por la MISMA puerta que el webhook (sobre crudo con origen `form30x_api` y el adaptador del 271),
   así que la idempotencia de la ingesta `(fuente, token, es_parcial)` evita duplicados. Una respuesta que ya entró
   no escribe otro sobre.
5. **Se leen también los completos**, como red de seguridad: si una entrega del webhook se pierde, el completo
   entra igual en la siguiente lectura. Si el webhook ya lo trajo, no pasa nada.
6. **Un parcial sin correo no entra** (el lead no tiene identidad). Como la ventana es de 48 h, entra en una lectura
   posterior si la persona sigue llenando.
7. **Cuando 30X mande parciales por webhook, la lectura sigue** como red de seguridad de los dos. El 272 no depende
   de esa conversación.

## Consecuencias

- Quien tenga acceso al proyecto de Vercel puede leer una key que edita todos los formularios de 30X y EstadoX. Es
  el riesgo que Mani aceptó; la mitigación es que el código no tenga forma de escribir (punto 1) y que la regla viva
  en `AGENTS.md`.
- Un parcial llega al CRM en menos de media hora, no al instante.
- Si Form30x cambia el formato de `/responses`, el adaptador falla y el sobre queda con error (ADR 0058); no se
  pierde nada y se ve en Webhook Health.
