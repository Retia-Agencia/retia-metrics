---
id: 247
etapa: hub
serves: "ADR 0087 puntos 1 (paso 1), 3 y 4 · docs/hub.md §2.4 (el id del anuncio no llega), §5.2 (nivel de la traza)"
depends: [120, 246]
status: todo
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

- [ ] El `utm_id` de CA (`52532647547375`, una campaña) resuelve a N2 con su campaña, con test sobre un árbol
  grabado.
- [ ] Un envío con `ad_id` de un anuncio de TI resuelve a N3 con su conjunto y su campaña, con test.
- [ ] El primer envío real de TI con `ad_id` después del cambio en el Typeform se ve en N3 (nota de cierre).
- [ ] El orden del árbol no cambia el resultado, con test.

## Notas

Un id que no se capturó no existe después: por eso el cambio en los Typeform se hizo antes que el código. Medido el
14-oct, antes del cambio: 0 envíos de TI con id, 113 de CA con el id de una campaña, 2 de 11 de Confianza con el del
anuncio.

**No hay plantilla por programa** (Mani preguntó, 14-oct): cada envío dice cómo leerse por su `utm_medium` (246), y
en una misma cuenta conviven varias plantillas (Tactical tiene anuncios con cuatro). Lo que sí se ve es qué
plantilla usa cada anuncio activo: el 120 guarda sus `url_tags` y el 248 los muestra por cuenta.
