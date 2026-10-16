# 0092: Form30x es el tercer proveedor de formularios, y su API key se usa con un solo form

- **Estado:** aceptado, 15-oct-2026 (Mani, setup de AI Second Brain Jurídico de EstadoX). Se construye en el 271.
- **Confirma:** ADR 0055 (fuente webhook con secreto HMAC por fuente), ADR 0058 (el sobre crudo se guarda apenas la
  firma cuadra), ADR 0064 (varias fuentes activas por programa), ADR 0069 (el CRM decide la etapa con agenda, calidad
  y valor), ADR 0087 (los campos ocultos completos desde el primer día).

## Contexto

EstadoX abre el programa **AI Second Brain Jurídico** (SBJ). La operación iba a vivir en HubSpot con el assigner de
30X, pero HubSpot Support no ha respondido, así que la operación comercial se hace en el CRM de Retia. El formulario
no está en Typeform ni en Dapta: está en **Form30x** (`form.30x.com`), el constructor de formularios propio de 30X.
La documentación (leída el 15-oct) y el form real (leído por la API, solo GET) dicen:

- **Webhook:** `POST` con `X-Form30x-Event` y `X-Form30x-Signature: sha256=<HMAC-SHA256 del cuerpo crudo>`, con
  secreto `whsec_…`. Reintenta una vez a los ~1,5 s. La doc **no dice si el HMAC va en hex o en base64**.
- **Payload:** `event` (`response.completed`), `formId`, `responseId`, `submittedAt`, `answers[]` (`fieldRef`, `type`,
  `question`, `value`, y en las de opción `label` y `choices`), `hidden`, `score`, `tags`, `variables`. Los ids de
  opción son únicos **solo dentro de su campo**: se lee `label` o se mapea por `(fieldRef, id)`.
- **La respuesta de Calendly** trae `{ scheduled, event, invitee }` con las URIs completas de la API de Calendly,
  y el uuid del invitado incluido. Alcanza para que el 052 lea esa cita exacta (ADR 0057).
- **Parciales:** el form los guarda (`partialSubmissions: true`, `completed: false` en la API), pero la doc solo
  promete el webhook en `response.completed`.
- **API REST** (`https://form.30x.com/api/v1`, `Authorization: Bearer f30x_live_…`): `GET /forms/:id/responses`
  devuelve el mismo formato que el webhook. **Una key lee y edita CUALQUIER form de la compañía** (30X y EstadoX).
  Los scopes separan lectura de escritura, no un form de otro.
- **El form de SBJ empuja a HubSpot** por su `salesFlow` (pipeline, team, producto
  `segundocerebrojuridico_noviembre_2026`, USD 1.750). Es la integración de 30X y sigue viva.

## Decisión

1. **Form30x entra como un proveedor más del registro `PROVEEDORES`** (`lib/ingesta/proveedores.ts`): header
   `x-form30x-signature`, verificación en tiempo constante, adaptador `entradaDesdeForm30x` y un valor nuevo en el
   enum `proveedor_formulario` (migración). Mismo molde que Dapta (ticket 130). La codificación de la firma se fija
   con una entrega real, no se adivina: mientras no esté medida (fase A del 271), la verificación acepta hex o base64
   y anota cuál cuadró, y el programa sigue inactivo. Con la medida, la otra se quita.
2. **El correo sale de la respuesta `type: "email"`**, sin mapeo (`correoPorDefecto: true`), igual que Dapta. Las
   opciones se leen por `label`, nunca por el id de la opción.
3. **La calidad y el valor salen de `tags`**, que el form calcula con sus `scoreTagRules` sobre `score`
   (`High`/`Low` y los niveles de valor). El adaptador los traduce a `lead_quality` y `lead_value`. La variable
   `tag_lead_quality` que trae el form hoy es un texto fijo en `High` y **no se lee**: miente para los descalificados.
4. **El estándar de puntaje es el mismo de todos los formularios** (`docs/dapta/README.md`): `score` = puntos de valor
   − 100 × descalificantes, con los puntos y los −100 puestos en las opciones. El form de SBJ hoy se aparta (ingreso
   sin puntos, −129 en inversión, situación por cargo); se corrige en el form, con el ok de Mani, antes del primer
   envío real.
5. **Los parciales llegan solo si Form30x los manda por webhook.** Si no, SBJ no tiene la etapa Potencial: es un
   hecho del proveedor, se dice en la pantalla del programa y no se rellena consultando la API.
6. **La API key (`FORM_30X_API_KEY`) es de dev, y se usa con UN solo form:** el de título exacto
   `AI Second Brain Jurídico | Registro | EstadoX` (id `cmulcaari04c001s6m0x1ats6`). Todo script la usa con ese id
   explícito, nunca lista y recorre. Leer ese form es libre; escribir en él pide el ok de Mani; **tocar cualquier
   otro form está prohibido**. Ninguna ruta de la app la lee: para recibir leads basta el webhook.
7. **El `salesFlow` del form hacia HubSpot no se toca.** El CRM recibe en paralelo, como una fuente más. Si 30X lo
   apaga, es decisión de ellos.

## Consecuencias

- Un proveedor nuevo es un archivo, un test del contrato de proveedores y una migración aditiva (`ALTER TYPE ... ADD
  VALUE`). Nada del motor de etapas cambia.
- Una key de Form30x filtrada o mal usada edita formularios de 30X y EstadoX que no son de Retia, y un form editado
  por API se ve igual que uno bueno. Por eso la regla del punto 6 vive en `AGENTS.md` y no en este ADR.
- Si HubSpot y el CRM operan a la vez, un lead puede tener dos dueños en dos sistemas. Cuál manda lo decide la
  operación (EstadoX), no el código.
