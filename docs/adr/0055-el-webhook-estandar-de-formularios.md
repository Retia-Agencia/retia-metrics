# 0055 — Un webhook estándar para cualquier formulario; el programa sale de la URL

**Fecha:** 2026-09-27 · **Estado:** aceptado (Mani, 27-sep) · **Cierra:** la decisión A2 de
`docs/plan.md` §7 · **Toca:** ADR 0004, ADR 0036, ADR 0039, ADR 0054 · **Track propio:** Integraciones
(`docs/plan.md` §4.3a)

## El problema

Los leads tienen que entrar solos al CRM (hito A). El 22-sep se arrancó un endpoint solo de Typeform.
Mani quiere **un webhook nuestro, estándar**, al que no le importe de qué formulario viene el lead
(Typeform, Dapta Forms u otro), que sepa de qué programa llegó, y que después lo mande por el mismo
camino de siempre: la ingesta, que decide si se descarta, a qué etapa va su deal y si cae en el Inbox.

## Decidimos

**1. Cada formulario tiene su propia URL de webhook, y el programa sale de ahí.** La URL identifica
una **fuente registrada** (`sources`), y la fuente es de un programa. Nunca un campo del payload
(ni un campo oculto): un formulario mal configurado o alguien que conozca la ruta metería leads en el
programa equivocado, y los programas no se cruzan jamás. Con la fuente en la URL, además, se sabe qué
secreto usar antes de leer un cuerpo sin verificar (precedente: `dapta-forms-sheets`, D1). Una URL que
no corresponde a una fuente activa es un **error visible**, no un lead en cualquier programa.

**2. "No importa el formato" = un adaptador por proveedor + un mapeo por fuente.**

- El **adaptador** reconoce el payload del proveedor (Typeform trae `form_response`; Dapta,
  `submission`) y lo convierte en un Envío estándar: respuestas por pregunta, campos ocultos,
  variables, token del envío y si es parcial.
- El **mapeo por fuente**, editable desde la app (ADR 0012), dice qué pregunta es el correo, el
  teléfono o el nombre, igual que el mapeo de columnas de hoy.
- Un formulario nuevo es **una fila**; un proveedor nuevo es **un adaptador**. Ninguno toca la ingesta.

**3. Después del adaptador, la puerta es una sola: `ingerirEntradas`** (`lib/ingesta/ingerir.ts`).
El webhook no escribe leads, envíos ni contactos por su cuenta. Lo que decide qué pasa con el lead
(descarte, deal, etapa, Inbox) es de la ingesta y del motor (tickets 051, 052, 045), no del webhook.

**4. Los parciales llegan.** El formulario manda el parcial con un *partial submission point* (Mani:
en Typeform eso dispara el webhook igual). La ingesta ya es idempotente por
`(fuente, token, es_parcial)`: el parcial y el completo del mismo envío conviven y un reintento no
duplica (migración 0022).

**5. Lo que ya estaba decidido (22-sep) sigue:** firma HMAC-SHA256 sobre el **cuerpo crudo**, secreto
por fuente; nunca responde con redirección; la ruta va en la lista pública de `proxy.ts`; se guardan
**todas** las respuestas en `submissions.respuestas` (ADR 0036).

## Consecuencias

- `tipo_fuente` gana un valor para webhook y `sources` guarda el secreto y el proveedor de cada
  fuente (migración de la sesión principal).
- Se verifica con un envío real de cada Typeform: el payload, la variable `estado` (ADR 0054) y el
  parcial.
- ⚠️ Typeform tiene que seguir escribiendo en Sheets hasta el hito B, o los closers se quedan sin ver
  los leads nuevos.

### Como se agrega un proveedor

Se agrega su valor a `proveedor_formulario` mediante una migracion, una entrada exhaustiva en
`PROVEEDORES` (`lib/ingesta/proveedores.ts`) con su firma y adaptador, y los fixtures
`tests/fixtures/<proveedor>-parcial.json` y `<proveedor>-completo.json`. El test de contrato recorre
el registro y cubre automaticamente a cada proveedor.

## Por decidir en los tickets del track

> ✅ **Cerrados por Mani el 27-sep en la noche**, las dos como se recomendaba: el sobre crudo + 200 va en
> el ticket 106 y el aviso en la app en el 107.

1. **Dónde queda un envío que llega y no se puede procesar.** Recomendación: guardar el sobre crudo y
   responder 200, para no perder el lead y poder reprocesarlo (precedente de `dapta-forms-sheets`, D4).
2. **Cómo se entera alguien de que una fuente dejó de recibir** (el equivalente del ticket 055).

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Programa en un campo oculto del payload | Error humano en la configuración cruza programas sin lanzar error |
| Un JSON propio que cada formulario deba respetar | Obliga a un intermediario si el proveedor no deja moldear su payload |
| Un endpoint solo de Typeform | Cada proveedor nuevo sería un endpoint nuevo con su propia lógica de ingesta |
