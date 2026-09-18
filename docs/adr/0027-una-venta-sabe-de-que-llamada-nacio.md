# 0027 — Una venta sabe de que llamada nacio

**Fecha:** 2026-09-18 · **Estado:** aceptado (durante el ticket 029)

## Contexto

El **ADR 0026 punto 2** decidio que anular una llamada `cerrada` anula su venta, y por arrastre
los abonos de esa venta. Al implementarlo (ticket 029) aparecio que **eso no se podia cumplir**:
`sales` no tenia ninguna referencia a `calls`.

`registrarLlamada` escribe la llamada, la venta y el primer abono **en la misma transaccion**, con
los tres ids generados en codigo. El abono apunta a la venta (`abonos.saleId`), pero la venta no
apuntaba a nada: el vinculo entre la llamada y la venta existia solo durante esa funcion y se
perdia al terminar.

Las alternativas sin columna eran todas adivinanzas: emparejar por `personId` + `cohortId` +
`closerId`, o por cercania de `createdAt`. Una persona puede tener dos ventas en una cohorte (dos
productos) y dos llamadas cerradas; cualquiera de esas heuristicas acierta casi siempre, y cuando
falla **anula la venta equivocada sin avisar**. Una cifra mal movida por una heuristica es el peor
resultado posible en un sistema cuyo proposito es que las cifras sean confiables.

## Decidimos

**`sales.call_id` es una FK a `calls`, nullable, con `on delete restrict`, y un indice UNICO.**

- **La referencia es de la venta a la llamada**, no al reves: una llamada existe antes que la venta
  y puede no producir ninguna. El lado que siempre sabe es la venta.
- **El indice unico dice que una llamada cierra COMO MUCHO una venta.** La garantia vive en la base
  y no en un comentario (ADR 0005). Postgres admite varios `NULL` en un indice unico, asi que las
  ventas sin llamada no compiten entre si. De paso, la cascada de la anulacion busca por ese indice
  en vez de recorrer la tabla.
- **`restrict`**, por la misma razon que `anulado_por` (ADR 0026): una llamada que ya cerro una
  venta es una llamada que se uso, y lo que ya se uso no se borra.
- **Nullable para siempre.** No es deuda tecnica que haya que "completar despues": las ventas
  migradas de Google Sheets son filas de otra pestana que nunca estuvo enlazada a una llamada
  (ADR 0004), y no hay dato con el que reconstruir el vinculo. Las que la app escribio antes de
  esta columna tampoco lo tienen.

### Que pasa con una llamada cerrada sin venta enlazada

Es el caso de toda fila anterior a esta columna y de todo lo que venga de la hoja. Anularla a secas
dejaria viva una venta que afirma un cierre cuya llamada ya no cuenta.

La regla: **se mira si la persona tiene alguna venta VIGENTE en la misma cohorte.**

- Si la tiene, **se rechaza** con el camino escrito en el mensaje: anular primero la venta desde el
  historial, que siempre se puede, y volver a intentarlo.
- Si no la tiene —porque ya se anulo, o porque ese cierre nunca produjo venta— anular la llamada es
  seguro y sigue.
- Si la llamada no tiene `personId` o `cohortId` (filas que la hoja dejo a medias) no hay con que
  emparejar y tampoco hay nada que afirmar: no se bloquea.

Es **conservador a proposito**. Rechazar de mas cuesta un paso extra que la app explica; anular de
menos deja una cifra inflada que nadie va a notar.

## Consecuencias

- `registrarLlamada` escribe `callId` en la venta. Un test lo fija en
  `tests/registro-llamada.test.ts`, y `tests/anulaciones.test.ts` prueba la cascada **partiendo del
  registro real** y no de filas sembradas a mano: con filas sembradas, la cascada pasaria igual
  aunque el enlace se dejara de escribir, y se perderia en produccion sin que nada fallara.
- La cascada del ADR 0026 punto 2 pasa a ser exacta en todo lo registrado desde la app, y explicita
  —con rechazo y mensaje— en todo lo anterior.
- Migracion `0014` (`dev`, 18-sep).

## Alternativas descartadas

**Emparejar por persona + cohorte + fecha.** Acierta casi siempre y falla en silencio anulando la
venta de otro producto o de otro cierre de la misma persona.

**Poner `saleId` en `calls`.** Invierte la dependencia: obliga a que la llamada conozca algo que
todavia no existe cuando se crea, y deja la columna vacia en la gran mayoria de las llamadas, que
nunca cierran.

**No enlazar y quitar la cascada del ADR 0026.** Deja al closer que se equivoco teniendo que anular
tres cosas por separado y acordarse de las tres. Anular la llamada y olvidar la venta es
exactamente la cifra inflada que el ticket 029 existe para evitar.
