---
id: 093
etapa: E5
serves: "plan v2 §12.14 · valor inmediato con el dato que YA existe"
depends: []
status: todo
---

# 093 — Filtrar el dashboard por UTM con lo que ya esta en la base

## Objetivo

Que Pauta y Media puedan mirar **hoy** los leads que ya traen origen, sin esperar a E1b ni a E3.

Mani (21-sep): *"por ahora toca asegurar que podamos analizar los Leads que ya tienen UTM en el dash
de metricas, es solo filtros."*

## Lo que se midio antes de escribir esto (production, 21-sep)

```
leads ......................... 4.823
  con utm_source .............. 4.097   (85%)
  con utm_medium .............. 4.098
  con utm_campaign ............ 4.097

utm_term / utm_content ........ 0       ← fuera de alcance desde el 21-sep
deals · calls · abonos ........ 0
submissions · ad_spend ........ 0

sin UTM:  tactical-investor 703/2.690 (26%)  ·  comunicarte 23/2.133 (1%)
```

## ✅ Lo que SI es solo filtros

`leads` **ya tiene** `utm_source`, `utm_medium` y `utm_campaign` como columnas, con 85% de cobertura.
Agrupar y filtrar por ellas **no necesita nada de E1b ni de E3**.

## ⚠️ Lo que NO alcanza, y hay que decirlo en la pantalla

1. ✅ **Conjunto y anuncio quedaron FUERA DE ALCANCE el 21-sep**, no pendientes. Mani: *"UTM term y
   content no es necesario, usemos los otros 3 que tienen mas sentido."* Los tres que hay son el
   alcance completo, y *"que anuncio esta vendiendo"* deja de ser una pregunta del producto
   (ADR 0045, enmienda 2). **La pantalla no tiene que avisar de un hueco: no hay hueco.**
2. 🩸 **Toda la mitad de abajo del embudo esta en cero.** `deals`, `calls`, `abonos`, `submissions` y
   `ad_spend`: **0 filas**. Nadie ha usado el CRM todavia. Entonces este ticket contesta **cuantos
   registros trae cada canal y nada mas**: no hay agendas, ni shows, ni ventas, ni costo, asi que
   **ninguna tasa tiene numerador**.
3. 🎯 **La brecha de atribucion es MUY desigual y eso es un hallazgo propio:** Tactical tiene **26%
   de leads sin UTM** (703 de 2.690) contra **1%** de ComunicArte (23 de 2.133). Son 703 leads cuyo
   origen no se puede saber. **Es una pregunta para Pauta**, no un bug del dashboard.

## Alcance

- **Dentro:** filtro y agrupacion por `utm_source`, `utm_medium` y `utm_campaign`, **dentro de un
  programa** (ADR 0043: el programa es frontera).
- **Dentro:** **`sin UTM` como una categoria mas**, con su conteo y su porcentaje, **no como un
  residuo**. Con 26% en Tactical, esconderla seria esconder la noticia. 🎯 **No es un estado de
  error: es un hecho del lead**, tan valido como `facebook / cpc`, y contesta *"a esta persona no
  sabemos como la conseguimos"*. Ocultarla inflaria todas las demas en proporcion.
  _(La otra categoria de huerfano, `(sin clasificar)`, todavia no existe: nace con los patrones del
  ticket 085.)_
- **Fuera:** areas y patrones. Eso es E1b y este ticket no lo anticipa.
- **Fuera:** cualquier tasa o costo. No hay datos.

## La regla que no se rompe

⚠️ **La consulta devuelve una serie con sus dimensiones, no escalares** (regla del ticket 089). Si
nace devolviendo `{ leads: 412 }`, se reescribe entera cuando entren las areas. Cuesta lo mismo
ahora.

## Done cuando

- [ ] Se puede ver leads por `utm_source / utm_medium` de un programa, con el filtro en la URL.
- [ ] **`sin UTM`** sale **como categoria**, con conteo y porcentaje, y en Tactical da ~26%.
- [ ] La consulta **no compila** sin programa.
- [ ] La salida es una serie con dimensiones: agregar un filtro no obliga a tocar la consulta.

## Kiro

Si.
