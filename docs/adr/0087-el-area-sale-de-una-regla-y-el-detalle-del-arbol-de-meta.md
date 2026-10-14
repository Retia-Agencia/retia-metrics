# 0087: El área sale de una regla, el detalle de pauta sale del árbol de Meta, y los canales se definen solos

- **Estado:** aceptado, 14-oct-2026 (Mani, audit del Hub, `docs/hub.md` H-3 y H-11). Se construye en los tickets
  119, 120, 246, 247 y 248.
- **Enmienda:** ADR 0051 (el catálogo de canales deja de decidir el área), ADR 0045 (la cubeta "sin clasificar"
  desaparece), ADR 0062 puntos 1, 2, 4 y 6 (la llave es cualquier id de Meta que exista en el árbol; la plantilla
  de Pauta deja de ser requisito; una conexión con N cuentas), ADR 0077 (los canales ya no los crea nadie), y la
  restricción de `AGENTS.md` sobre las dos categorías de huérfano.
- **Confirma:** ADR 0004 (el UTM se guarda como llegó), ADR 0043 (el área agrupa; el programa es frontera), ADR
  0060 (la venta hereda el origen del envío que abrió su deal), la regla del centinela (una macro sin expandir
  cuenta como ausente).

## Contexto

Lo medido el 14-oct (`docs/hub.md` §2.4 y §2.5):

- El catálogo `canales` tiene 26 filas y 22 son combinaciones de orgánico. Cada creadora nueva suma unas cinco, y
  `instagram francisco` ya llega sin clasificar. Mani: *"no sé si la manera en la que lo manejamos con canales que
  toca mantener de manera manual sea lo más sostenible"*.
- La plantilla de Pauta del 29-sep (`utm_id={{ad.id}}`) solo la usa Power Talk. TI y CA siguen con la vieja, que
  manda el id del anuncio en `ad_id`, y el Typeform lo bota porque no lo declara. En CA el `utm_id` que llega es
  el id de la **campaña**. Hoy la atribución llega a campaña, no a anuncio.
- Meta da por API el árbol completo (campaña → conjunto → anuncio) con ids que no cambian, así que la lista de
  campañas activas no la tiene que declarar nadie.
- Hay **una** conexión (el portafolio Agencia Retia Growth, un usuario del sistema de solo lectura) que ve siete
  cuentas; ComunicArte tiene cuatro, dos en USD.

## Decisión

1. **El área de un envío la decide una regla, en este orden:**
   1. trae un id de Meta (`utm_id`, `ad_id`, `adset_id` o `campaign_id`) que existe en el árbol de sus cuentas →
      **Paid**;
   2. `utm_medium` es pago (`cpc`, `paid_social`, `paid`) → **Paid**;
   3. `utm_medium` es `referido` (el link del closer, ADR 0044) → **Referidos**;
   4. trae `utm_source` o `utm_medium` → **Orgánico**;
   5. no trae ninguno → **Sin UTM**.
   La lista de medios pagos es un tipo en el código (el código decide con ella, ADR 0012), no una fila.
2. **El canal se define solo:** es la primera palabra de `utm_source`, normalizada (`ig` = Instagram, `fb` =
   Facebook), y la segunda es la cuenta (`instagram rosario` = Instagram · Rosario). Nadie lo crea ni lo mantiene.
3. **El detalle de Paid sale del árbol de Meta.** Cualquier id que llegue se busca en el árbol y se sabe su nivel:
   un id de anuncio da anuncio, conjunto y campaña; uno de campaña da solo la campaña. Sin id, la campaña se busca
   por su nombre exacto y único en las cuentas del programa (ADR 0062 punto 6, sigue igual).
4. **Se capturan los ids que los anuncios ya mandan:** `ad_id`, `adset_id` y `campaign_id` entran como campos
   ocultos en los Typeform (configuración, con el ok de Mani; el webhook ya guarda todo campo oculto, ADR 0058).
   Pedirle a Pauta la plantilla única queda como mejora, no como requisito.
5. **"Sin clasificar" desaparece.** Todo envío con UTM tiene un área. El riesgo es un par pago mal escrito que cae
   en Orgánico sin error, y por eso:
6. **Cada UTM dice cómo cuenta.** Una vista (Hub › Origen) muestra cada par que llegó en el rango con su conteo,
   su área, su canal, la regla que lo decidió, el nivel de la traza, y marca los pares **nuevos** (vistos por
   primera vez en los últimos siete días) para que una persona los mire. Reemplaza `/ajustes/canales`.
7. **Una conexión de Meta y N cuentas por programa.** La conexión sigue siendo una fila con su token secreto (ADR
   0062 punto 4, patrón del ADR 0057); cada cuenta publicitaria es de **un** programa (frontera) y trae la moneda
   y la zona horaria que dice Meta.
8. **Toda lectura de los UTM y de los ids de Meta pasa por `lib/atribucion/`**, como hoy. La regla es una
   función; el Hub, el semáforo y las listas la importan.

## Consecuencias

- `canales` deja de leerse; la tabla se retira cuando su migración lo permita (sin pérdida: el área nunca se
  guardó, se deriva).
- Las dos cubetas de huérfano pasan a ser una (Sin UTM) más las macros sin expandir, contadas aparte. La regla de
  `AGENTS.md` se reescribe con el 246.
- Un envío viejo se reclasifica solo al leer: no hay relleno.
- Lo que entró antes de los campos ocultos queda en nivel campaña o canal para siempre.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Mantener el catálogo y pedirle a Pauta la plantilla única | depende de que Pauta lo haga (dos semanas decidido y sin aplicar) y de una fila por creadora |
| Que Pauta declare las campañas activas | la API ya da esa lista; pedirla es trabajo doble |
| Un par desconocido queda "sin clasificar" hasta que alguien lo mire | es exactamente la fila que nadie mantiene; la vista de los pares nuevos da la misma visibilidad sin bloquear |
| La lista de medios pagos como filas editables | nadie la cambia; una fila más es mantenimiento sin un caso que lo pida |
