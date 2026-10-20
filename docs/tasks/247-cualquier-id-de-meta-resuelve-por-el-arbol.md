---
id: 247
etapa: hub
serves: "ADR 0087 puntos 1 (paso 1), 3 y 4 · docs/hub.md §2.4 (el id del anuncio no llega), §5.2 (nivel de la traza)"
depends: [120, 246]
status: en curso
---

# 247 — Cualquier id de Meta que llegue se resuelve por el árbol, y el `ad_id` deja de perderse

## Objetivo

Que un envío con el id de un anuncio, de un conjunto o de una campaña quede atribuido al nivel que ese id permite,
y que los anuncios de TI y CA (que mandan `ad_id`) lleguen a nivel anuncio sin pedirle nada a Pauta.

## Alcance

- ✅ **Ops, hecho el 14-oct (ok de Mani):** los campos ocultos `ad_id`, `adset_id` y `campaign_id` en los tres
  Typeform (Tactical `GmPGBOf9`, ComunicArte `nkMLdeh8`, Confianza `E5F4chVT`), por API, con respaldo; el resto del
  form y los webhooks quedaron idénticos. El webhook ya guarda todo campo oculto en `respuestas` (ADR 0058). Falta:
  verificar en la base el primer envío real de TI y de CA con `ad_id`, y si los formularios de Dapta reciben esos
  parámetros (hoy no tienen envíos).
- **Dentro:** `utmsDelEnvio` (o su vecino en `lib/atribucion/`) devuelve los ids de Meta del envío: `utm_id` y los
  tres de `respuestas`. Ninguna otra parte del código los lee.
- **Dentro:** `emparejar` busca cada id en el árbol del 120 (anuncio, conjunto o campaña) y toma el más profundo.
  El paso 1 de la regla del área (ADR 0087) entra aquí: un id que existe en el árbol = Paid.
- **Dentro:** el nivel de la traza: N3 anuncio, N2 conjunto o campaña (también por nombre exacto único), N1 solo
  área, N0 sin UTM. Un id que no existe en el árbol sigue siendo el aviso `anuncio_desconocido`.
- **Fuera:** promover los tres ids a columnas de `submissions` (solo si una consulta lo necesita por rendimiento).

## Done cuando

- [x] El `utm_id` de CA (`52532647547375`, una campaña) resuelve a N2 con su campaña, con test sobre un árbol
  grabado.
- [x] Un envío con `ad_id` de un anuncio de TI resuelve a N3 con su conjunto y su campaña, con test.
- [ ] El primer envío real de TI con `ad_id` después del cambio en el Typeform se ve en N3 (nota de cierre).
- [x] El orden del árbol no cambia el resultado, con test.

## Notas

Un id que no se capturó no existe después: por eso el cambio en los Typeform se hizo antes que el código. Medido el
14-oct, antes del cambio: 0 envíos de TI con id, 113 de CA con el id de una campaña, 2 de 11 de Confianza con el del
anuncio.

**No hay plantilla por programa** (Mani preguntó, 14-oct): cada envío dice cómo leerse por su `utm_medium` (246), y
en una misma cuenta conviven varias plantillas (Tactical tiene anuncios con cuatro). Lo que sí se ve es qué
plantilla usa cada anuncio activo: el 120 guarda sus `url_tags` y el 248 los muestra por cuenta.

## Nota de cierre (14-oct, parcial)

Codex implementó; la sesión revisó e integró (`8d91b4b`, `96a4612`, `6fc448d`). Sin migración. Decisiones de la sesión:

- Candidatos en orden fijo `ad_id`, `utm_id`, `adset_id`, `campaign_id`; gana el más profundo (anuncio > conjunto >
  campaña) y, a igual nivel, el primero del orden: el orden del árbol no cambia nada. `Traza` gana `conjunto`.
- Un id resuelto da `area: paid`, `regla: id_en_arbol` (paso 1 del ADR 0087), conservando el canal. La gemela SQL
  (`idEnArbolSql`, un `exists` sobre `pauta_objetos` del MISMO programa) entra en `areaSql` y la usan los cinco hechos.
  `utm_id` cae a `respuestas` igual que en TypeScript.
- `anuncio_desconocido` se avisa una vez, y solo si algún id es numérico: medido en producción, los links orgánicos de
  ComunicArte mandan `ad_id=organic` (14 envíos), que es un centinela y no un anuncio que falte.
- El embudo del formulario carga el árbol real; la ingesta sigue con `ARBOL_VACIO` (solo lee el código del closer).

Medido en producción el 14-oct (lectura): ComunicArte, 34 envíos con `ad_id` desde el cambio del Typeform, 20 caen en
un anuncio del árbol (N3) y los otros 14 son `organic`; sus 111 `utm_id` de 14 días están todos en el árbol
(campaña, N2). **Falta:** Tactical no trae el id. Medido el 14-oct en la noche: 22 envíos de TI (y 4 de Confianza) llegan con la
llave `ad_id` en NULL, aunque sus 17 anuncios activos sí ponen `ad_id={{ad.id}}` en sus `url_tags`. El Typeform declara
el campo, pero la página que lo embebe no le pasa ese parámetro (CA sí lo pasa). Es configuración de la landing de TI
(pasar `ad_id`, `adset_id` y `campaign_id` al embed), no código; cuando llegue el primero, verlo en N3.

## 20-oct: por qué TI y Confianza no traen el id (diagnóstico)

- Los anuncios SÍ mandan el id: Tactical pone `campaign_id`, `adset_id`, `ad_id` y `fbclid` en sus `url_tags` (17
  activos); Confianza pone `utm_id={{ad.id}}` (15 activos). Medido con `retia-insights`.
- Se pierden en la **landing**: las dos son de Lovable (`deceroatactical.ttrading.co` y
  `programapowertalk.lovable.app`) y su botón "Postular" copia al Typeform solo una lista fija de cinco
  (`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`). ComunicArte funciona porque su landing pasa
  todos los parámetros.
- El Typeform de TI había perdido `ad_id`, `adset_id` y `campaign_id` en una edición del 19-oct; se le devolvieron
  por API el 20-oct (ok de Mani, con respaldo, el resto del form idéntico).
- **Falta (operación):** que cada landing agregue a su lista `utm_id`, `ad_id`, `adset_id`, `campaign_id` y `fbclid`.
  Cuando entre el primer envío de TI con id, verlo en N3 y cerrar.
