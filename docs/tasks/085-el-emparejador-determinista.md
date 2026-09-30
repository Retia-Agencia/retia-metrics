---
id: 085
etapa: E1b
serves: "plan v2 §12.10.3 · ADR 0045 puntos 5 y 6"
depends: [101]
status: done
---

# 085 — El emparejador de patrones, determinista, y su guardian

## Objetivo

Que un envio resuelva **a lo sumo una** campana, un usuario o un area, y que esa resolucion sea la
misma siempre.

## 🩸 Por que esto es un modulo y no una consulta suelta

**Si un envio casa con dos patrones de campanas distintas, ese lead se cuenta en las dos y el CPL de
ambas sale mal. Sin un solo error.**

No es hipotetico. El **ADR 0031** documenta que colgar una corrida de sync de `fuentes[0]` —una
consulta **sin `ORDER BY`**— atribuia cada corrida a uno de los dos formularios de forma **no
determinista**: corridas identicas quedaban registradas distinto. Es la misma trampa, un nivel mas
arriba y con dinero encima.

## Las tres reglas

1. **Un envio resuelve a lo sumo UNA campana.** No "la primera que aparezca".
2. **Gana el patron mas especifico**, medido en campos UTM no nulos. Uno de tres le gana a uno de dos
   **siempre**, sin importar el orden de la consulta.
3. **Un empate es un ERROR que la app muestra**, no una eleccion silenciosa. La garantia de que no
   pueda existir vive en el indice unico del ticket 084, no aca.

## Alcance

- **Dentro:** `lib/atribucion/emparejar.ts`, modulo puro: recibe un envio y devuelve el destino con
  su area derivada, o una de las dos categorias de huerfano.
- **Dentro:** el **guardian**, mismo molde que `vigente`, `rolDeVista` e `identidad de closer`:
  recorre `lib/`, `app/`, `components/` y `scripts/` y **falla si alguien lee `utm_patron` sin pasar
  por este modulo**.
- **Dentro:** las **DOS** categorias de huerfano, que **no se funden**:
  **`sin UTM`** (el envio llego sin origen: problema de captacion, irrecuperable) y
  **`(sin clasificar)`** (trae UTM pero no casa: problema de configuracion, se arregla con una fila y
  repara hacia atras). Un cubo unico escondaria cual de los dos problemas tiene el negocio.
- **Fuera:** escribir el area en ninguna tabla.

## Done cuando

- [x] Cada regla tiene su test **en los dos sentidos**: la que debe casar casa, la que no, no.
- [x] El test de especificidad corre **con los patrones en distinto orden** y da el mismo resultado.
- [x] El guardian esta **mordido**: se le inyecta una lectura clandestina de `utm_patron` y falla.
- [x] Un envio **sin UTM** devuelve `sin UTM`; uno **con UTM que no casa** devuelve `(sin clasificar)`.
      **Son dos salidas distintas**, con test de las dos, y **nunca** `null` silencioso.
- [x] Cero UI: este modulo se prueba sin navegador.

## Kiro

Si, con revision cercana. La especificidad es donde un bug es silencioso.

---

## Enmienda 2026-09-24 (ADR 0051)

El emparejador resuelve en dos pasos: el par `utm_source + utm_medium` a un **Canal** (y de ahí el
área) y `utm_campaign` a una **Campaña**. Es también **el único módulo que lee `utm_content`**, y solo
cuando el canal es Closer, para convertir el código en el usuario que trajo el lead. El guardián se
amplía: falla si alguien lee `utm_content` por fuera de este módulo.


---

## Enmienda 2026-09-29 (reunión con Pauta, [`docs/analytics.md`](../analytics.md))

- El emparejador resuelve también el **anuncio** por `utm_id` (y de ahí conjunto y campaña, 120), y lee `utm_content` y `utm_term` según lo que declara el canal (DP-22): en `paid_social`, anuncio y placement; en el `facebook / cpc` histórico, conjunto y anuncio.
- **Una macro sin expandir (`{{...}}`) es un centinela** (DP-21): ausente en ese nivel y contada aparte. Medido el 29-sep: 20 envíos con `{{campaign.name}}`.
- Devuelve además el **nivel de la traza** (N3 anuncio, N2 campaña, N1 canal, N0 sin UTM) que usa el 123.


---

## Cierre 2026-09-30 (sesión 55, Mani)

Reescrito por DP-25 antes de construir: sin `utm_patron` ni especificidad (084 reemplazado), así que las "tres
reglas" de arriba se cumplen de otra forma: el canal es único por par (índice `canales_par_idx`), el id de Meta es
único, y dos campañas de Meta con el mismo nombre dan el aviso `campana_ambigua` en vez de escoger una.

- **`lib/atribucion/utm-del-envio.ts`:** `utmsDelEnvio` (columna, y si falta la llave de `respuestas`; `utm_id`
  solo de `respuestas` hasta el 116), `columnasUtmDelEnvio` para los `select`, y `esMacro`, la única definición de
  "macro sin expandir" (la usan `canal.ts` y la vista interina).
- **`lib/atribucion/emparejar.ts`:** `emparejar(utms, catalogo, arbol)` devuelve la `Traza`: canal (o `sin_utm` /
  `sin_clasificar`), campaña (de Meta por el anuncio o por nombre exacto único; de orgánico, el texto crudo),
  anuncio por `utm_id`, contenido según el formato del canal, macros aparte, avisos y **nivel** (N3, N2, N1, N0 y
  `sin_clasificar` aparte).
- **Decisión de Mani:** el árbol de Meta (`ArbolDePauta`) entra como **dato**; el 120 lo carga desde
  `pauta_objetos`. Hasta entonces nada llega a N3 en producción y todo `utm_id` sale como `anuncio_desconocido`.
- **Guardián:** `tests/atribucion-emparejador.test.ts`, fuera de `lib/atribucion/` nadie lee `utmContent`,
  `utmTerm`, `utmId` ni las llaves `"utm_content"`, `"utm_term"`, `"utm_id"`. Excepciones: `lib/db/schema.ts`
  (define) y `lib/ingesta/envio.ts` (captura). Mordido en los dos sentidos.
- `lib/queries/pauta-interina.ts` pasa por el módulo; su salida no cambió.
- Implementó Codex; la sesión principal corrió la suite (1.643), quitó dos `sort` defensivos y movió un import.

**Queda:** nadie llama `emparejar` todavía (lo conectan 087, 088, 123). Un envío que solo trae `utm_id` queda en N0
aunque su anuncio exista: revisarlo con el 123. Medido el 30-sep: 21 envíos de ComunicArte traen `utm_id` (los
recientes con el mismo id, como `facebook / cpc`) y 0 de Tactical: O-1 y O-2 de la ola 0 siguen pendientes.
