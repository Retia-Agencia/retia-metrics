---
id: 130
etapa: E6
serves: "ADR 0055 (proveedor nuevo = un valor más) · ADR 0061 · ADR 0064"
depends: [117]
status: todo
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

## Decisiones abiertas (de Mani)

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
