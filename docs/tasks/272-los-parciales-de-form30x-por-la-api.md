---
id: 272
etapa: entrada
serves: "Los parciales de AI Second Brain Jurídico llegan al CRM como Potencial aunque Form30x no los mande por webhook (ADR 0093)"
depends: [271]
status: todo · espera la fase B del 271
---

# 272 — Los parciales de Form30x, por la API

## Por qué

Form30x guarda los parciales pero su webhook solo manda `response.completed` (medido el 15-oct, `docs/operations.md`
§2.2 paso 6). Sin esto, SBJ no tiene Potencial. Decisión en el ADR 0093.

## Qué

1. **Migración aditiva** (la genera y aplica la sesión principal, con el ok de Mani; `lock_timeout` al principio):
   `sources.form30x_form_id text` nullable. Editable en el formulario de la fuente solo si el proveedor es `form30x`.
2. **`lib/form30x/api.ts`:** el único lector de `FORM_30X_API_KEY`. Exporta solo
   `leerRespuestas(formId, cursor?)` → `GET https://form.30x.com/api/v1/forms/:id/responses?limit=200`. Sin la
   variable, lanza un error claro. Ningún otro método HTTP.
3. **`lib/ingesta/leer-form30x.ts`:** para cada fuente `form30x` activa con `form30x_form_id`, lee de la más nueva
   hacia atrás hasta salir de la ventana de 48 h. Cada respuesta se traduce al cuerpo del webhook (una función pura) y
   entra por la puerta del 271 como sobre crudo con origen `form30x_api`; `completed: false` es parcial. Si ya existe
   el envío `(fuente, responseId, es_parcial)`, se salta sin escribir sobre. Un parcial sin correo se salta.
   Devuelve un resumen (leídas, nuevas, saltadas, con error).
4. **`POST /api/cron/form30x`:** `CRON_SECRET` como `/api/cron/pauta`; responde el resumen sin datos personales.
5. **`.github/workflows/form30x.yml`:** `schedule: */30 * * * *` y `workflow_dispatch`, un `curl` con los secretos
   del repo `CRON_SECRET` y `CRM_URL`. Falla si la respuesta no es 200.
6. **Guardianes:** ningún archivo fuera de `lib/form30x/api.ts` nombra `FORM_30X_API_KEY` ni `form.30x.com/api`;
   ese archivo no contiene `PATCH`, `PUT`, `POST` ni `DELETE`.

## Configuración (Mani y la sesión, con el ok de Mani)

- `FORM_30X_API_KEY` en Vercel, solo producción (la sube la sesión desde `.env.local`, sin mostrarla).
- `CRON_SECRET` y `CRM_URL` como secretos del repo en GitHub.
- `form30x_form_id = cmulcaari04c001s6m0x1ats6` en la fuente de SBJ.

## Fuera de alcance

Escribir en Form30x. Leer forms que no estén en una fuente activa. Pedirle a 30X el webhook de parciales (lo habla
Mani).

## Done cuando

- Tests: la traducción de `/responses` al cuerpo del webhook con una respuesta real (datos personales cambiados), la
  ventana, el salto de lo ya ingerido, el parcial sin correo y los dos guardianes mordidos en los dos sentidos.
- En producción, el parcial de prueba del 15-oct (`completed: false`) entra como Potencial con la primera corrida del
  workflow (`workflow_dispatch`; si ya salió de la ventana, un parcial falso nuevo), y una segunda corrida no escribe nada nuevo.
