---
id: 093
etapa: E5
serves: "plan v2 §12.14 · valor inmediato con el dato que YA existe"
depends: []
status: done
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

- [x] Se puede ver leads por `utm_source / utm_medium` de un programa, con el filtro en la URL.
- [x] **`sin UTM`** sale **como categoria**, con conteo y porcentaje, y en Tactical da ~26%.
- [x] La consulta **no compila** sin programa.
- [x] La salida es una serie con dimensiones: agregar un filtro no obliga a tocar la consulta.

## Kiro

Si.


---

## Enmienda 2026-09-29 (reunión con Pauta, [`docs/analytics.md`](../analytics.md))

- **Es la vista interina de Pauta, lo primero que se puede entregar** (ola 1 de `docs/analytics.md` §7): registros, agendas y sin UTM por canal, campaña y anuncio, con lo que ya hay.
- 🩸 Corrección de lo medido: `utm_term` y `utm_content` **no están en 0**: viven en `submissions.respuestas` (6.911 envíos de la hoja y 101 del webhook). El anuncio **sí** entra (ADR 0062); mientras salga el 116, se leen de `respuestas`.
- Lee de `submissions`, no de `leads.utm_*` (ADR 0060, que elimina esas columnas). Registro = token.
- **Contador visible de sin UTM de hoy, sin umbral** (DP-17), con la lista de esos envíos; las macros sin expandir, aparte.

---

## Cierre 2026-09-29 (Mani, sesión principal)

- `lib/queries/pauta-interina.ts` (`pautaInterina`): registros (token completo, DP-11), agendas (llamada
  vigente atribuida al envío de origen de su deal, ADR 0060) y las categorías sin UTM, macro y "sin envío de
  origen". Serie por día y los cinco UTM. `utmCapturados` es la única lectura de `utm_content`/`utm_term`
  fuera del emparejador: columna promovida o llave de `respuestas`, **crudos**, sin llamarlos anuncio ni
  conjunto (en `facebook / cpc` de Retia el anuncio va en `utm_term`; en la plantilla de Pauta, en
  `utm_content`).
- Sección "Origen de registros y agendas" en `/p/<programa>/dashboard`, con drill-down por la URL: canal →
  campaña → content/term. Usa el rango del dashboard; no aplica el filtro de closer. "Hoy llegaron N sin UTM"
  es de hoy, mire el rango que mire.
- Medido en producción (todo el histórico): Tactical 790 de 3.120 registros sin UTM (**25,3%**), ComunicArte
  32 de 2.790 (1,1%); 17 macros; 9 envíos de Tactical sin UTM hoy.
- Queda: 10 y 12 agendas "sin envío de origen" por programa con todos los deals vivos ya rellenados (115):
  son llamadas sueltas o de deals anulados. Las leerá bien el 123 cuando el embudo sea por área.
- Tests: `tests/pauta-interina.test.ts`. Recorrido en la base local a 390 px, consola limpia.
