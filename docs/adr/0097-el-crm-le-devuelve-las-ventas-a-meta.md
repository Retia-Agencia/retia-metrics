# 0097: El CRM le devuelve las ventas a Meta por la API de Conversiones

- **Estado:** aceptado, 19-oct-2026 (Mani, `/grill-with-docs`, tras la reunión con Michael y el mensaje del grupo de
  Pauta del mismo día). Se construye en el 281; el 282 y el 283 lo amplían.
- **Cierra:** CAPI-1 del backlog de `docs/plan.md`.
- **Enmienda:** ADR 0095 (entra el tipo `meta_capi` en `integraciones`).
- **Confirma:** ADR 0037 (una venta es un deal en Abonado o Completo), ADR 0038 (anulado no es Cierre Perdido), ADR
  0043 (el programa es frontera), ADR 0042 (toda escritura deja rastro).

## Contexto

Michael (19-oct): *"algo clave es que el CRM pueda devolverle a Meta el evento de conversión con el valor de cada venta
y de dónde vino"*; Anderson lo puso antes que todo lo demás. Hoy Meta solo ve el `Lead` del pixel del formulario, así
que la pauta optimiza por formularios llenos y no por ventas. La venta pasa en el CRM (el closer la cierra en la
llamada y el abono la marca), un lugar al que el pixel no llega.

Lo que se averiguó en la documentación de Meta (19-oct):

- La Offline Conversions API se retiró en mayo de 2025; las ventas fuera de la web van por la API de Conversiones a un
  **dataset** (lo que antes se llamaba pixel; en el portafolio aparece en Conjuntos de datos).
- La meta "Conversion Leads" de Meta solo sirve con Lead Ads (Instant Forms). Retia usa formularios propios
  (Typeform, Dapta), así que el camino es el evento estándar `Purchase` al dataset del programa.
- Meta no recibe "vino de este anuncio": recibe a la persona (datos con hash, `fbc`) y **la atribución al anuncio la
  hace Meta**. El `utm_id` sirve para las métricas del CRM, no para Meta.
- `event_time` no puede tener más de 7 días: si un evento del lote es más viejo, Meta rechaza el lote entero.
- El token se genera en el Events Manager de cada portafolio; Meta crea la app y el usuario del sistema y no pide App
  Review ni permisos. Compartir el dataset del cliente al portafolio de Retia falla en silencio (se asigna y no
  aparece) y en Powertalk Meta no deja compartir porque el portafolio es nuevo.

## Decisión

1. **Un token por portafolio cliente**, generado en su Events Manager por alguien con acceso total o rol de
   desarrollador en ese portafolio. Se guarda en `integraciones` (ADR 0095) con el tipo nuevo `meta_capi`: el token en
   `secretos` y el id del dataset en `config`. Se descartó compartir los datasets al portafolio de Retia (falla en
   silencio y en Powertalk no se puede) y el camino mixto (dos mecanismos que mantener).
2. **El evento es `Purchase`, uno por deal**, con `event_id` igual al id del deal. Se dispara la **primera vez** que el
   deal entra a Abonado o a Completo, lo que pase primero. `event_time` es el momento de esa entrada. El valor es
   `valor_vendido_usd` (el ticket completo, que se congela en el primer abono) y `currency` es `USD`. `action_source`
   es `system_generated` porque lo emite el CRM y no la web.
3. **No se manda:** una cortesía (valor 0; le enseñaría a Meta a buscar a quien no paga), un deal anulado antes del
   envío, ni nada de un programa sin el interruptor encendido.
4. **Se mandan todas las ventas del programa**, cualquiera que sea su área. Filtrar a "solo Paid" con la regla de canal
   del CRM le escondería a Meta ventas de gente que vio el anuncio y llegó por otro lado; la atribución es de Meta.
   Cada programa manda a su dataset y nunca a otro.
5. **La persona se identifica con** correo, teléfono, nombre, apellido y país con hash SHA-256 (normalizados como pide
   Meta), `external_id` igual al id del lead con hash y, cuando exista, `fbc` (sin hash) armado con el `fbclid` del
   envío que abrió el deal (282). `fbp` no se puede: es una cookie del dominio del formulario.
6. **Bandeja de salida, no llamada directa.** `moverEtapa` escribe la fila pendiente en la misma transacción en que el
   deal entra a la etapa; un índice único `(deal, evento)` garantiza que haya una sola. Un cron la manda y reintenta
   hasta que se cumplen los 7 días; después queda `vencida`, visible. Ninguna falla de Meta tumba ni demora un
   cambio de etapa.
7. **Anular o devolver después del envío no se corrige en Meta** (la API no borra eventos). La fila queda marcada como
   enviada y luego anulada, para que se vea.
8. **Se enciende por programa** y nace apagado. Se enciende después de que un evento de prueba (`test_event_code`)
   aparece en el Events Manager. Las ventas de mientras no se mandan después: la ventana de 7 días lo impide.

## Consecuencias

- Es el primer borde donde el CRM le **escribe** a Meta. Sale información personal con hash hacia un tercero: la
  autorización de datos de cada formulario tiene que cubrir compartir con plataformas publicitarias (Ley 1581). Es un
  requisito de operación por programa, no de código.
- Con pocas ventas por semana, Meta aprende despacio (pide unas 50 conversiones semanales por conjunto). Por eso el 283
  agrega `Schedule` (agendó) y un evento de Atendido, también una vez por deal.
- Para generar el token hace falta acceso en cada portafolio cliente; sin él, ese programa no puede encenderse.
- `utm_id` y la atribución del CRM no cambian: siguen siendo la vista propia de Retia, al lado de la de Meta.
