# Formularios de Dapta Forms

Los formularios de postulación en Dapta Forms se **generan** desde `generar-base.mjs`. No se arman a mano en
el editor. Replican la lógica de los Typeform (Tactical `GmPGBOf9`, ComunicArte `nkMLdeh8`) con los estados
del ADR 0061. El CRM los recibe con el ticket 130.

## Cómo está armado

Dapta no tiene variables libres como Typeform: tiene **un score** (puntos por opción) y **un outcome** (la
etiqueta final). Por eso el score guarda los dos ejes del Typeform:

- Cada respuesta que descalifica (ingreso bajo, "no es prioridad", "no cuento con los recursos") resta 100.
- Ingreso y situación profesional suman los `hvm_points` del Typeform (10, 20, 30).
- `score >= 0` quiere decir que la persona no tiene descalificantes, y entonces ve el Calendly (`hideWhen`
  sobre `@score`). Si tiene alguno, `hvm = score mod 100`.
- Los 12 outcomes son los rangos de score que reproducen el `lead_value` del Typeform. Su etiqueta es
  `<estado>|<lead_value>|<lead_quality>`, por ejemplo `con_calendly_sin_agenda|MUY ALTO VALOR|High` (`High` si no
  tiene descalificantes, `Low` si sí, como el `tag_lead_quality` del Typeform). El adaptador del 130 la parte.
- El `value` de cada opción es su misma etiqueta: Dapta manda el value en el webhook y así `respuestas` se lee
  igual que un Typeform. Ningún salto usa el value (van por `@score`), así que es seguro.
- El paso de agenda prellena Calendly con `prefillMap: { name: 'nombre', email: 'email' }`. Sin el mapa, Dapta solo
  prellena el nombre en pasos tipo `name`, y el nuestro es `text`. El correo prellenado es lo que deja al webhook
  de Calendly (096) colgar la cita del lead.
- El envío parcial va después de la pregunta 8 (inversión): es el parcial previo al Calendly del ADR 0061.

Se verificó contra el motor real de Dapta (`packages/engine/src/form-logic.ts`), con las 216 combinaciones de
respuestas de cada programa contra la lógica de su Typeform: cero diferencias. Mani revisó la lógica en el
editor el 30-sep.

## Programas

| Programa | Workspace de Dapta | Form id | Ticket | Rangos de ingreso |
|---|---|---|---|---|
| ComunicArte | Eventos ComunicArte SAS | `003e5f13-3b73-45cf-b922-d0504b5b8548` | USD 797 | los de su Typeform: descalifica menos de 1.500 |
| Memorable en Instagram & TikTok | Memorable en Instagram & TikTok | `36772ec5-c79e-45de-97fb-791b7cd8f668` | USD 1.200 | los de Tactical: descalifica menos de 1.000 |

Los dos están en **borrador, sin publicar**; se volvieron a subir con el generador actual el 30-sep.

## Antes de publicar uno

1. Conectar Calendly en Dapta y escoger el tipo de evento en la pregunta 9 (hoy `calendly.com/REEMPLAZAR`).
2. Poner las dos URLs de gracias en los outcomes (hoy `example.com/REEMPLAZAR-*`). Sin redirect, la
   persona vería la etiqueta `estado|lead_value` como título de la pantalla final.
3. **Anti-spam apagado:** con él prendido, Dapta no manda el parcial por webhook.
4. No borrar la pregunta 10: es el campo oculto `utm_id`, que se llena desde la URL.
5. La destinación webhook de Dapta con URL y **secreto** de la fuente del CRM. El secreto se genera en
   `/ajustes/fuentes` (se muestra una vez) y se pega a mano: nunca pasa por un chat ni un script. La URL es
   `/api/webhooks/formularios/<id de la fuente>`, y la fuente tiene que estar **activa** (inactiva = 404).
6. **No antes del 117:** hasta que el CRM traduzca `con_calendly_sin_agenda` por su tabla de estados, ese lead entra
   sin Estado y no abre deal.

## Lo que se sabe del webhook de Dapta (leído en su código, 30-sep)

- Firma `x-forms-signature: sha256=<hex>`; el secreto es opcional en Dapta, pero el CRM sin firma responde 401.
- `visit.pageUri` y `visit.pageName` llegan `null` cuando Dapta no los conoce; `visit.hutk` (cookie de HubSpot) no
  se guarda.
- La agenda llega como la **hora de inicio** de la cita (o `booked`), nunca como link. Dapta guarda el
  `inviteeUri` en su base, pero no lo manda: se le pidió (A9).
- Dapta le pasa a Calendly `utm_content = sessionId`, el mismo `submission.id` que el CRM usa como token. Es una
  llave exacta para emparejar la cita con el envío, sin depender del correo; nadie la usa todavía.
- Con el anti-spam prendido, el parcial se guarda pero no se entrega a ningún destino.
- **El botón "enviar prueba" de la destinación** manda un parcial firmado con `data.test: true`,
  `submission.id: "test-submission"` y `sample@example.com`. El CRM lo responde con 200 y lo deja en `sobres_crudos`
  con el error "Entrega de prueba de Dapta", **sin crear lead** (`esEntregaDePrueba`, 30-sep). Se puede usar para
  probar URL y secreto, con la fuente activa.
  **Probado el 30-sep en los dos programas:** firma buena, 200, sobre con ese error, cero envíos y cero leads. El
  cuerpo real (con el formulario sin publicar trae solo `data: { test: true }`) es `tests/fixtures/dapta-prueba-real.json`.

## Los formularios de Dapta no los creó el CRM

Se crearon a mano en el editor de Dapta el 30-sep (sesión 59) y se les cargó el JSON del generador. En el workspace
de ComunicArte hay además un formulario viejo, **"Postulación Método ComunicArte"** (18-sep), que no es de este
trabajo y no se toca. El enlace público del nuevo será `forms.dapta.ai/4bgty3/f/postulacion-evento-comunicarte`
(`4bgty3` es el código de la cuenta) cuando se publique.

## Fuentes en el CRM (30-sep: activas y con secreto, puestos por Mani en `/ajustes/fuentes`)

**El mapeo de una fuente Dapta va VACÍO.** El adaptador encuentra solo `nombre`, `email` y `whatsapp`; las UTM salen
de su lugar fijo, y el Estado, `lead_value`, `lead_quality` y el puntaje salen del outcome y del score, no del
mapeo (las llaves `puntaje`, `leadValue`, `leadQuality` y `agenda` de esa pantalla son de Typeform). Copiar el mapeo
de la fuente de Typeform (`correo: "correo electronico"`) haría que ningún lead encuentre su correo. Lo mismo si
el programa tuviera una plantilla de lead con títulos de Typeform: hoy ninguno tiene.

| Programa | Fuente | id |
|---|---|---|
| ComunicArte | Dapta - Postulación Evento Comunicarte | `58263e2b-4550-4045-ab97-147fdb1f55fe` |
| Memorable (programa `b5440788-5265-41ed-8a77-b4b0228038e5`, inactivo) | Dapta - Postulación Memorable | `867f29df-1be7-490e-823a-6e29f3cab4d2` |

## Un programa nuevo, o un cambio

1. Agregar o editar su bloque en `PROGRAMAS` de `generar-base.mjs` y correr `node docs/dapta/generar-base.mjs`.
   Sale `<slug>.json`.
2. Crear un formulario vacío en el workspace del programa (botón *Create a form*) y cargarle el JSON desde la
   misma sesión: `POST /admin/forms/<id>/flush` con `{ kind: "config", name, config }`. Es la ruta con la que
   el editor guarda. La API de Dapta no acepta API key (ver `docs/plan.md` §7, A9).
3. Recargar el editor y revisar que quedó como borrador.
