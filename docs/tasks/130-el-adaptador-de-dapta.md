---
id: 130
etapa: E6
serves: "ADR 0055 (proveedor nuevo = un valor más) · ADR 0061 · ADR 0064"
depends: [117]
status: done
---

# 130 — El adaptador de Dapta Forms: los envíos de Dapta entran por el mismo webhook

## Objetivo

Que un envío de Dapta Forms entre al CRM igual que uno de Typeform: por la ruta
`/api/webhooks/formularios/[fuente]`, verificado con su firma y convertido a la misma `EntradaEnvio`. De
`EntradaEnvio` en adelante nada cambia (dedup, contactos, deal, atribución).

## Por qué ahora

El 30-sep se crearon en Dapta los formularios de **ComunicArte** (workspace "Eventos ComunicArte SAS") y de
**Memorable en Instagram & TikTok**, el programa nuevo (ticket USD 1.200), con la misma lógica de los
Typeform. Están en borrador, sin publicar. Los genera `docs/dapta/generar-base.mjs` (ver
`docs/dapta/README.md`). Mani verificó la lógica; falta que el CRM los reciba.

## Hoy no se rompe nada (verificado en el código el 30-sep)

Un POST de Dapta a la ruta del webhook responde **404** sin leer el cuerpo y queda en `entregas_webhook`
como `fuente_no_encontrada`: la ruta solo acepta fuentes con `proveedor = 'typeform'`, y no existe ninguna
fuente de Dapta. El payload de Dapta nunca llega al adaptador de Typeform. El riesgo no es romper Typeform:
es **perder envíos de Dapta** si alguien publica el formulario y conecta el webhook antes de este ticket.
Dapta reintenta un no-2xx, pero sin límite conocido.

## Lo que se sabe del payload (leído del código de Dapta, sin un envío real todavía)

Fuente: `packages/destinations/src/adapters/webhook.ts` de `Dapta-Tech/dapta-forms`.

| Pieza | Dapta | Typeform hoy | Qué hace el adaptador |
|---|---|---|---|
| Firma | header `x-forms-signature: sha256=<HEX>` del HMAC-SHA256 del cuerpo. El secreto es **opcional**: hay que ponerlo en la destinación | `typeform-signature: sha256=<BASE64>` | verificación por proveedor; un Dapta sin firma es 401 como hoy |
| Parcial | `phase: "partial" \| "complete"` | `event_type: form_response_partial` | `esParcial = phase === "partial"` |
| Token | `submission.id` (uno por sesión; el parcial y la completa comparten id) | `form_response.token` | `__token` |
| Fecha | `submittedAt` (ISO) | `submitted_at` | `__submitted_at` |
| Respuestas | `data`: llave = **key del paso** (`nombre`, `email`, `whatsapp`, `ingreso`...) | título de la pregunta | columnas por key; los defectos `nombre`/`email`/`whatsapp` ya casan |
| UTM | `utm` (5 nativas) + `data.utm_id` (campo oculto) | `hidden` | mismas columnas `utm_*` |
| Estado y valor | `submission.outcome` = `"<estado>\|<lead_value>"`, p. ej. `con_calendly_sin_agenda\|MUY ALTO VALOR` | variables `estado`, `lead_value` | se parte en `estadoHoja` y `leadValue` |
| Score | `submission.score` (entero) | variable que nombra el mapeo | `puntaje` directo |
| Agenda | `data.agenda` = **hora de inicio** de la cita, no un link | link de Calendly | ver decisión 2 |
| Idempotencia | `id` y header `x-forms-delivery` por entrega | · | no se usa: la ingesta ya es idempotente por `(fuente, token, es_parcial)` |
| Extra | `form`, `visit` (página, embebido, cookie de HubSpot) | · | `form` y `visit.pageUri` a `respuestas`; la cookie `hutk` **no se guarda** |

## Alcance

- **Dentro:** `proveedor_formulario` suma `dapta` (migración; la genera y aplica la sesión principal).
- **Dentro:** `lib/ingesta/adaptador-dapta.ts`, función pura `entradaDesdeDapta(payload, opciones)` con su
  zod laxo (un campo nuevo del proveedor no rompe), al lado del de Typeform. Mismo contrato: el programa
  sale de la fuente, nunca del payload.
- **Dentro:** la ruta elige verificador de firma y adaptador según `sources.proveedor`. `procesarSobre`
  también, para que el reproceso (110) funcione con sobres de Dapta. La elección vive en **un** lugar (un
  registro por proveedor), no en un `if` copiado en la ruta y en el reproceso.
- **Dentro:** una respuesta que llega como objeto (el paso `name` de Dapta manda `{firstname, lastname}`) se
  aplana: para el nombre, `firstname + " " + lastname`; para cualquier otro, sus partes con su llave
  (`<key>.<parte>`). Nuestros formularios usan un paso `text` para el nombre, así que hoy no llega dividido,
  pero un formulario duplicado podría cambiarlo.
- **Dentro:** registrar la fuente de Dapta de cada programa con su secreto (`rotarSecretoDeFuente`, ADR 0055)
  y pegar URL y secreto en la destinación webhook de Dapta. Para ComunicArte esto necesita el **131**
  (Typeform y Dapta activos a la vez); para Memorable no, porque es su primera fuente.
- **Fuera:** usar la API de Dapta desde el CRM (crear formularios, leer respuestas). Su API solo acepta la
  sesión de un usuario logueado, no una API key. Ver `docs/plan.md` §7, A9.

## Decidido (Mani, 30-sep) y construido

1. **`lead_quality`:** tercer pedazo del outcome (`estado|lead_value|High|Low`). El generador lo escribe y los dos
   borradores se volvieron a subir. El CRM no la calcula (A8).
2. **La cita: la cuelga el webhook de Calendly (096), opción (b).** El adaptador **no** sube a `con_calendly` por
   `data.agenda` ni deduce nada de ella: el Estado entra tal cual lo manda el outcome, y `data.agenda` (la hora de
   inicio) queda en `respuestas`. El nombre y el correo llegan prellenados a Calendly porque el paso de agenda
   trae `prefillMap: { name: 'nombre', email: 'email' }` (Dapta solo prellena el nombre solo en pasos `name`).
   Dapta sí conoce el `inviteeUri`, pero no lo manda en el webhook: se le pidió (A9).
3. **Respuestas:** el `value` de cada opción es su misma etiqueta, así `respuestas` se lee igual que un Typeform.
   Ninguna condición usa el value (los saltos van por `@score`).

⚠️ **Hasta el 117, `con_calendly_sin_agenda` entra sin Estado y no abre deal**, y la cita de Calendly queda suelta
en el Inbox. Por eso ningún formulario de Dapta se publica antes del 117 (Mani, 30-sep).

## Lo que se construyó

- `lib/ingesta/proveedores.ts`: el registro de proveedores (firma + adaptador). La ruta y el reproceso lo
  consultan; agregar un proveedor es un valor del enum, una entrada ahí y sus fixtures (ADR 0055).
- `lib/ingesta/adaptador-dapta.ts` y `tests/contrato-proveedores.test.ts` (las mismas reglas para todo proveedor;
  se comprobó que muerde rompiendo el adaptador a propósito).
- `mapeoWebhookDesdeFuente` ya no hereda el defecto de la HOJA: pisaba el `email` de Dapta y el lead nunca se
  creaba. Typeform conserva exactos los defectos que le aplicaban.
- Fuentes en producción, inactivas y sin secreto: ComunicArte `58263e2b-4550-4045-ab97-147fdb1f55fe`, Memorable
  `867f29df-1be7-490e-823a-6e29f3cab4d2`. Memorable existe como programa (`b5440788-…`), inactivo.

## Lo que falta (después del 117)

1. En Dapta: escoger el evento de Calendly del paso 9 y las dos URLs de gracias (`docs/dapta/README.md`).
2. En `/ajustes/fuentes`: generar el secreto de la fuente Dapta (se muestra una vez) y pegarlo con la URL en la
   destinación webhook de Dapta. Activar la fuente.
3. Publicar y correr los 7 envíos de abajo; guardar el primer cuerpo real de cada camino como fixture.

## Decisiones que estaban abiertas (historial)

1. **`lead_quality`.** El Typeform la manda en `tag_lead_quality` (`High` si pasó los filtros y llegó al
   Calendly, `Low` si no). El formulario de Dapta no la manda, aunque es exactamente "score ≥ 0".
   **Recomendado:** agregarla como tercer pedazo del outcome (`estado|lead_value|High`) en el generador y
   volver a subir los dos formularios, que siguen en borrador. Así la manda el formulario y el CRM no la
   calcula (A8). La otra opción es derivarla del Estado en el adaptador, lo que rompe A8.
2. **La cita.** El paso de agenda de Dapta guarda la **hora de inicio**, no el link, así que la regla del 052
   (leer la cita exacta por su link) no tiene de dónde leer. Hay dos caminos:
   - **(a) Recomendado:** buscar la cita en Calendly con el token del programa por correo del invitado + hora
     de inicio. Ese par es único, así que no adivina nada. Implica extender `resolverCitaDeEnvio` para
     aceptar una hora en vez de un link.
   - **(b)** Dejar que el webhook de Calendly del programa la cuelgue por correo (096). Con (b) un lead que
     agendó en Dapta entra a Pendiente Setteo con la nota del sistema hasta que llegue el evento.

   Con (a) o con (b), un envío con `data.agenda` lleno es el hecho de "agendó": sube a `con_calendly`
   (punto 4 del ADR 0061), con la pregunta de agenda nombrada en el mapeo y no adivinada.
3. **Respuestas legibles.** Dapta manda el `value` de la opción (`ingreso_1`) y no su texto, porque el payload
   no trae la definición del formulario. ¿Se guarda así en `respuestas`, o el generador pone como `value` el
   mismo texto de la etiqueta? Verificar con el primer envío real antes de decidir.

## Pruebas con envíos reales (Mani, 30-sep: "va a tocar hacer pruebas de envíos reales")

Con la fuente registrada y el formulario publicado en Dapta, uno por cada camino, mirando `sobres_crudos` y
`entregas_webhook`:

1. **Descalificado** (ingreso bajo): una parcial y luego una completa con `setteo_no_calificado|...`, sin
   Calendly. Un deal en Setteo.
2. **Calificado que no agenda:** solo la parcial con `con_calendly_sin_agenda|...`. Un deal en Setteo con
   prioridad alta (117, 118).
3. **Calificado que agenda:** parcial y completa con `data.agenda`. Mismo token, mismo deal, que pasa a
   Agendado.
4. **Firma mala o sin secreto:** 401 y la base sin moverse.
5. **Reentrega:** el mismo cuerpo dos veces no duplica envío ni deal.
6. **Con UTM en la URL**, incluido `utm_id`: las seis columnas llenas.
7. **Anti-spam de Dapta prendido:** confirmar que el parcial no llega (leído en su código). Por eso va apagado.

El primer cuerpo real de cada camino se guarda como fixture de `tests/` (sin datos personales).

## Done cuando

- `tests/adaptador-dapta.test.ts`: cada fila de la tabla de arriba, con fixtures reales.
- `tests/webhook-matriz.test.ts` cubre Dapta: firma hex buena y mala, parcial y completa del mismo token, y la
  frontera de programa.
- Los 7 envíos reales de arriba entran a producción como dice cada uno, con el ok de Mani para publicar.
- `npm test`, `npm run typecheck`, `npm run lint` y `npm run build` limpios.

## Resultado (1-oct, sesión 65, Mani)

Seis envíos reales en ComunicArte por el formulario publicado, revisados en `sobres_crudos`, `entregas_webhook`, el
lead, el deal y la llamada; los deals de prueba se anularon después con su motivo.

| Camino | Resultado |
|---|---|
| Descalificado | ✅ parcial y completa, mismo token; deal en Pendiente Setteo |
| Calificado sin agenda | ✅ parcial `con_calendly_sin_agenda`; deal en Pendiente Setteo (prioridad alta en la tabla; se ve con el 118) |
| Calificado que agenda | ✅ el webhook de Calendly colgó la llamada y pasó el deal a Agendado; al cancelar, Pendiente Reagenda. `data.agenda` llega como `"booked"` |
| Seis UTM | ❌ → ✅ 🩸 el adaptador leía `utm.source` y Dapta manda `utm.utm_source` (y `utm.utm_id`, nativo): el fixture sintético tenía la forma inventada y el test pasaba. Arreglado (`7d6c04d`) y verificado en producción con un envío nuevo: las seis columnas llenas |
| Typeform + Dapta, misma persona | ✅ un lead con los envíos de los dos; la completa llegó antes que la parcial sin romper nada |
| Firma mala | ✅ 401 por la URL de producción, `firma_invalida`, cero cambios en envíos, leads y sobres |
| Reentrega | cubierta por `tests/webhook-matriz.test.ts`: Dapta solo reintenta un no-2xx y no tiene botón de reenviar, y el reproceso (110) solo toma sobres con error |
| Anti-spam | leído en el código de Dapta: con él prendido el parcial no se entrega; va apagado |

Fixtures reales anonimizados: `tests/fixtures/dapta-real-*.json`. El contrato de proveedores ahora pasa un cuerpo
REAL de cada proveedor por la ruta real y exige en la base todas sus UTM y todos sus campos intactos (`f435a66`;
muerde con el adaptador viejo). Regla de Mani: **las UTM y los campos del formulario llegan siempre, de cualquier
formulario.**
