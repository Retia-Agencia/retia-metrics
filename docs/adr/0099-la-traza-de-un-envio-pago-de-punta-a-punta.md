# 0099: La traza de un envío pago, de punta a punta, y la alarma cuando se corta

- **Estado:** aceptado, 20-oct-2026 (Mani). Se construye en el 290; lo operativo lo hacen Pauta y quien mantiene cada
  landing.
- **Enmienda:** ADR 0062 (la plantilla de Pauta pasa a ser LA plantilla de los tres programas, con los ids de Meta y
  el `fbclid`), ADR 0097 (el `fbc` de CAPI depende de este mismo camino).
- **Confirma:** ADR 0004 (lo que llega se guarda como llegó), ADR 0058 (todo campo oculto entra a `respuestas`), ADR
  0060 (la venta hereda el origen del envío que abrió su deal), ADR 0087 (el área sale de la regla), ADR 0069 (la
  alarma "sin calidad" es el molde).

## Contexto

El 20-oct se midió en producción (solo lectura), sobre los envíos pagos desde el 14-oct:

| Programa | A dónde lleva el anuncio | Envíos pagos con id del anuncio |
|---|---|---|
| ComunicArte | landing `programavirtual.eventoscomunicarte.com` (y 2 anuncios directo al Typeform) | 173 de 191 |
| Tactical | landing `deceroatactical.ttrading.co` | 0 de 184 |
| Confianza | landing `programapowertalk.lovable.app` | 0 de 360 |

Los anuncios **sí** mandan el id (leídos por la API con `retia-insights`): Tactical pone `campaign_id`, `adset_id`,
`ad_id` y `fbclid` en sus parámetros de URL; Confianza pone `utm_id={{ad.id}}`. Se pierden en un segundo salto: las
tres landings son de Lovable, y en Tactical y Confianza el botón "Postular" arma el link al Typeform copiando una
**lista fija de cinco** (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`). Además, el Typeform de
Tactical perdió `ad_id`, `adset_id` y `campaign_id` en una edición del 19-oct (se devolvieron el 20-oct) y nunca tuvo
`utm_id` ni `fbclid`. Nada de esto lanzó un error: el CRM siguió recibiendo, clasificando como Paid y contando, y el
corte se vio de casualidad, un día después.

Sin el id, la venta queda en "Paid" o en su campaña, nunca en su anuncio: el costo por agenda y por venta de cada
anuncio (123, 125, 288), el árbol (247) y la librería de anuncios (284) quedan ciegos para dos de tres programas. Y el
`fbclid`, que CAPI necesita para que Meta reconozca el clic (281, 282), viaja por el mismo camino roto.

## Decisión

1. **La traza tiene cinco eslabones, y cada uno tiene dueño:**

   | Eslabón | Qué tiene que cumplir | Dueño |
   |---|---|---|
   | Anuncio | Una sola plantilla de parámetros de URL para todos los programas (punto 2) | Pauta |
   | Landing | Copia **todos** los parámetros de su URL al link del formulario, sin lista fija | Quien mantiene la landing |
   | Formulario | Declara el set completo de campos ocultos (punto 3); sin campo declarado, Typeform lo ignora | Retia (ok de Mani para editar) |
   | Ingesta | Guarda todo como llegó (ADR 0058); el emparejador resuelve el nivel N3 a N0 | CRM (ya cumple) |
   | Deal | Hereda el origen del envío que lo abrió (`deals.submission_origen_id`, ADR 0060) | CRM (ya cumple) |

2. **La plantilla de Meta es una sola** (enmienda del ADR 0062): la de Pauta más los ids y el clic:
   `utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{placement}}&utm_id={{ad.id}}&ad_id={{ad.id}}&adset_id={{adset.id}}&campaign_id={{campaign.id}}`.
   `fbclid` no va en la plantilla: Meta lo agrega solo a cada clic. El emparejador sigue entendiendo la plantilla
   histórica (`facebook / cpc`), así que migrar un programa no rompe nada; mientras convivan dos, se miden dos.
3. **El set de campos ocultos de todo formulario de un programa con pauta:** `utm_source`, `utm_medium`,
   `utm_campaign`, `utm_term`, `utm_content`, `utm_id`, `ad_id`, `adset_id`, `campaign_id`, `fbclid`. Es el mismo en
   Typeform, Dapta y Form30x. Editar un formulario sigue pidiendo el ok de Mani; quitar uno de estos campos es romper la
   traza.
4. **La landing pasa todo, no una lista.** Una lista fija es lo que rompió Tactical y Confianza: cada parámetro nuevo
   exigiría volver a editar la página. Es un requisito de operación, no código del CRM; se comprueba abriendo la
   landing con parámetros de prueba y mirando el link del botón.
5. **El CRM vigila la traza, porque nadie se acuerda** (se construye en el 290). Dos alarmas por fuente, en la ventana
   de las últimas 24 h y con el molde de "sin calidad" (`lib/queries/salud-fuentes.ts`: se calcula, no se guarda):
   - **Sin id del anuncio:** envíos pagos (`MEDIOS_PAGOS` de la regla del canal) que no traen ningún id de Meta
     atribuible (`ad_id`, `utm_id`, `adset_id`, `campaign_id`; una macro sin expandir cuenta como ausente). Es un corte
     de **captación**: plantilla, landing o formulario.
   - **Id desconocido:** traen id pero el árbol de Meta no lo reconoce (aviso `anuncio_desconocido` del emparejador).
     Es un árbol desactualizado o una cuenta sin vincular, no un problema de captación.
   Se ven en Webhook Health, en Hub › Origen (248) y en el semáforo de Juanito, donde Pauta las ve sin entrar al CRM.
   Con el 282, se suma "sin `fbclid`" con el mismo molde.
6. **Toda cifra por anuncio dice su cobertura.** Una vista que reparte agendas, ventas o costo por anuncio muestra
   cuántas quedaron sin anuncio ("12 de 40 ventas sin anuncio"), igual que "Sin UTM" (ADR 0087): un hueco de
   captación se ve, nunca se esconde en un total que cuadra (C-1, `docs/hub.md` §8).

## Consecuencias

- Lo que ya entró sin id es **irrecuperable** (igual que "Sin UTM"): el arreglo cuenta desde el primer envío después
  de cada corrección. Por eso la alarma importa más que el arreglo de hoy.
- Arreglar Tactical y Confianza depende de tres personas fuera del código: Pauta (plantilla), quien edita cada landing
  en Lovable y Mani (campos del Typeform). El 247 no se cierra hasta ver el primer envío de cada programa en N3.
- La plantilla única hace que `utm_content` y `utm_term` signifiquen lo mismo en los tres programas (ADR 0087): el
  error medido el 21-sep (anuncio en un programa, conjunto en otro) deja de ser posible para la pauta nueva.
- CAPI (281) no necesita el id del anuncio (Meta atribuye por su cuenta), pero su calidad de coincidencia depende del
  `fbclid`, que viaja por el mismo camino: la misma corrección sirve a las dos cosas.

## Enmienda 21-oct (reunión con Pauta: Michael, César y Mani)

Medido y corregido el 21-oct. Las cuatro landings con pauta copiaban una lista fija: Tactical y Confianza (A
`programapowertalk.lovable.app` y B `powertalkprograma.lovable.app`) botaban `utm_id`, `ad_id`, `adset_id`,
`campaign_id` y `fbclid`, y ComunicArte botaba `utm_id` y `fbclid` y además **inventaba** `direct / organic` y
`ad_id=organic` a quien llegaba sin UTM. Las cuatro se arreglaron en Lovable ese día (pasan todo lo que llega y no
rellenan nada) y se verificaron en las páginas publicadas, interceptando el clic sin enviar el formulario. Los primeros
envíos pagos posteriores resolvieron a N3 en los tres programas (cierra el 247).

1. **La plantilla única es la de Confianza** (la de Pauta, compartida por Anderson), sin los tres ids extra del punto 2:
   `utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{placement}}&utm_id={{ad.id}}`.
   `ad_id` era redundante (el mismo `{{ad.id}}` que `utm_id`). `adset_id` y `campaign_id` quedan **opcionales**: el
   emparejador los usa como respaldo (N2/N1) cuando el anuncio todavía no está en el árbol. Pauta pasa a esta plantilla
   los anuncios vivos de ComunicArte y Tactical y la usa en todo anuncio nuevo; el emparejador sigue leyendo la
   histórica (`facebook / cpc`, `ad_id`).
2. **Sin UTM es Sin UTM, nunca orgánico** (Michael: no se le atribuyen leads ni ventas a un canal que no se sabe si
   los trajo). Una landing no rellena valores por defecto. Confirma el ADR 0087.
3. **Los links orgánicos salen de un generador**, no se escriben a mano: César consigue las reglas de Ander y Michael
   con Mani arman la propuesta. No se construye otro: el generador que ya tiene el CRM (`generarLink`, ADR 0051) se
   ajusta a las reglas que defina Pauta. Lo usan quienes
   hoy crean links: Maju, Ander, César y Daniela.

Consecuencia medible: desde el 21-oct el orgánico de ComunicArte baja (unos 75 envíos por semana, medido sobre los 154
`direct / organic` de los 14 días previos) y su Sin UTM sube lo mismo. No es tráfico perdido: es la clasificación
corregida, y los envíos anteriores se quedan como entraron (ADR 0004).
