# 0036 — El Envío guarda TODAS las columnas, y las promovidas no se repiten

**Fecha:** 2026-09-21 · **Reescrito:** 2026-09-27 (consolida el ADR retirado 0019 y la ingesta del
22-23 sep) · **Estado:** aceptado

## El problema

El MVP guardaba una fila por persona con ~10 campos mapeados y tiraba el resto a una bolsa sin forma
(`people.raw`). Tres cosas se rompían: **se perdía el historial** (quien aplica tres veces era una
fila; medido el 21-sep: 1.146 personas con más de una aplicación, 6.233 envíos donde el CRM guardaba
4.791 filas), **una columna nueva del formulario no aparecía sola**, y **los envíos parciales no
existían**.

## Decidimos

**1. El Envío (`submissions`) es una fila por cada vez que alguien llenó el formulario**, parcial o
completo. Es el hecho; el Lead es la persona que lo produjo. La llave es
`(source_id, token, es_parcial)` (migración 0022): un reintento del webhook no duplica, y la parcial y
la completa del mismo envío conviven.

**2. ~10 campos promovidos a columna, TODO lo demás en `respuestas jsonb`, y las promovidas NO se
repiten adentro.** Un campo se promueve solo si el código decide, filtra, indexa o cruza con él.
Hoy son columna del envío: token, `es_parcial`, fecha, el `Estado` que traía la hoja
(`estado_hoja`), los cinco UTM (se capturan los cinco y se leen tres, ADR 0051), la posición en la
hoja (para el traslado) y la calificación y el puntaje que calcula el CRM (migración 0023). El correo
y el teléfono no son columnas del envío: entran a `lead_contactos` con el envío del que llegaron
(ADR 0035). Lo demás se guarda entero, con el texto de la pregunta como llave, y se lee al abrir la
ficha.

**3. Una pregunta nueva del formulario entra sola**, y los envíos viejos la tienen en `null`.

**4. Parcial y completa se guardan las dos.** La completa manda para el Lead; la parcial es el evento
"inició el formulario" y, si queda huérfana, es un abandono contactable. El CRM **recalcula cuando
llega la hermana**, no decide una sola vez. (Medido en Tactical: 193 correos solo existen como
parcial.)

**5. Qué columna es cada campo promovido es configuración de la fuente, no código.** En el traslado
desde Sheets, el mapeo se resuelve **por texto del encabezado, nunca por posición**, en tres niveles
(la fuente, la plantilla del programa, el defecto del código) y un campo obligatorio que falta lanza
`MapeoInvalidoError` con lo que se buscaba y los encabezados reales. 🔴 Cómo se declara el mapeo de un
formulario que entra por webhook es parte del contrato del webhook (`docs/plan.md` §7, A2).

**6. Un centinela no es un dato.** Las promovidas se guardan normalizadas (correo en minúsculas,
fecha como `timestamptz` en Bogotá, teléfono en dígitos). Cada campo promovido responde la pregunta
*"¿qué escribe esta fuente cuando no sabe?"*: las hojas mandaban `1/1/0001` como fecha vacía, y por
eso `parsearFecha` tiene piso en el año 2000 y el orden de los envíos del traslado sale de la
posición en la hoja, no de la fecha.

**Implementado:** `construirEnvio` (`lib/ingesta/envio.ts`), el adaptador de Sheets
(`lib/ingesta/adaptador-sheets.ts`) y la escritura (`ingerirEntradas`, `lib/ingesta/ingerir.ts`).

## Por qué `jsonb` y no otra forma

| | Promovidas + `jsonb` del resto ✅ | Solo `jsonb` | Una fila por respuesta (EAV) |
|---|---|---|---|
| Leer un envío | una fila | una fila | ~40 filas y un join |
| Llave `(programa, correo)` del Lead | columna normal | no se puede como llave | join |
| Columna nueva | aparece sola | aparece sola | aparece sola |

Lo que decidió: la llave del ADR 0005 tiene que ser columna. Una respuesta que empiece a decidir algo
se promueve con su ADR.
