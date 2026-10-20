---
id: 290
etapa: pauta
serves: "Pauta y Mani se enteran el mismo día cuando los envíos pagos de un programa dejan de traer el anuncio de origen (ADR 0099)"
depends: [247]
status: todo
---

# 290 — La alarma de la traza de pauta

## Por qué

El 20-oct se descubrió de casualidad que Tactical y Confianza llevaban días con 0 envíos pagos con id del anuncio
(0 de 184 y 0 de 360): las landings de Lovable botaban los ids y una edición del Typeform de Tactical los quitó. Nada
falló ni avisó (ADR 0099). Sin el id, el costo por anuncio, el árbol y CAPI pierden su base.

## Alcance

- **El conteo**, en `lib/queries/salud-fuentes.ts` (el molde de `sinCalidad`, ventana `HORAS_SIN_CALIDAD`), calculado y
  no guardado, por fuente:
  - `pagos`: envíos con `utm_medium` en `MEDIOS_PAGOS` (de `lib/atribucion/canal.ts`, sin copiar la lista).
  - `pagosSinId`: de esos, los que no traen ningún id de Meta atribuible (`ad_id`, `utm_id`, `adset_id`,
    `campaign_id`; macro o vacío = ausente). La lectura de los ids sale de `utmsDelEnvio` / la regla del emparejador,
    no de una segunda lectura de `respuestas`.
  - `pagosIdDesconocido`: traen id y el emparejador devuelve `anuncio_desconocido`.
- **Cuándo marca:** con al menos `MIN_PAGOS_TRAZA` envíos pagos en la ventana (constante en el código, 5), si más de la
  mitad llegan sin id. El id desconocido se muestra pero no marca la fuente (es del árbol, no de captación).
  Medido el 20-oct: ComunicArte ~9 % sin id (no marca), Tactical y Confianza 100 % (marcan).
- **Dónde se ve:**
  - Webhook Health: la fila de la fuente marcada con "N de M envíos pagos sin anuncio (24 h)".
  - El semáforo de Juanito (`lib/reporte-whatsapp/`): una línea por programa con la fuente marcada. El contrato del
    endpoint (`contrato.ts`, lista blanca) suma el campo; sin datos de personas.
  - Hub › Origen (248) lo toma de la misma función cuando se construya: no se duplica el conteo.
- **Fuera:** "sin `fbclid`" (entra con el 282, mismo molde), avisar por correo, corregir envíos viejos.

## Tests

- El conteo en los dos sentidos: un envío pago con `ad_id`, con solo `utm_id`, con macro sin expandir, sin nada; un
  envío orgánico sin id no cuenta; un envío de otro programa no cuenta.
- El umbral: 4 pagos sin id no marcan; 5 sí; 5 con 2 sin id no.
- El endpoint del semáforo sigue pasando `tests/semaforo-endpoint.test.ts` con el campo nuevo en la lista blanca.
- Guardián: la lista de medios pagos y la lectura de ids no se copian fuera de `lib/atribucion/`.

## Done cuando

Con los datos del 20-oct, Webhook Health y el semáforo marcan Tactical y Confianza y no ComunicArte; y cuando la
landing de un programa se arregla, la marca se va sola en menos de 24 h.

## Relacionado

247 (se cierra cuando cada programa llegue a N3), 248 (Hub › Origen la muestra), 281 y 282 (el `fbclid` viaja por el
mismo camino), 123, 125, 284 y 288 (toda cifra por anuncio dice su cobertura, ADR 0099 punto 6).
