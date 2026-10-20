---
id: 282
etapa: pauta
serves: "El clic de Meta (fbclid) del formulario se guarda en el envío para que la venta que vuelve a Meta se reconozca mejor (ADR 0097 punto 5)"
depends: []
status: todo
---

# 282 — El fbclid del formulario llega al envío

## Por qué

Meta añade `fbclid` a la URL de cada clic en un anuncio. Mandado como `fbc` en la API de Conversiones (281), es el dato
que mejor amarra la venta a la persona que vio el anuncio. Hoy el CRM no lo guarda: ninguna tabla tiene `fbclid`, `fbc`
ni `fbp`.

## Alcance

- **Formularios:** un campo oculto `fbclid` en el Typeform de cada programa y en los forms de Dapta (y Form30x si
  aplica). Editar un formulario pide el ok de Mani (AGENTS.md); en Typeform, que el campo oculto lea el parámetro de la
  URL.
- **El mapeo de la fuente** lo trae como un campo conocido, igual que los UTM: se guarda en `submissions.fbclid`, como
  llegó (ADR 0004). Una macro sin expandir o un valor vacío cuenta como ausente.
- **El momento del clic:** se guarda la hora en que llegó el envío (es el más cercano que tenemos) para armar
  `fb.1.<ms>.<fbclid>`.
- **Fuera:** `fbp` (cookie del dominio del formulario, inaccesible) y rellenar envíos viejos.

## Done cuando

Un envío que entró desde un anuncio trae su `fbclid` en la base, y el 281 lo usa para armar `fbc`.


## Enmienda 20-oct (ADR 0099)

El campo oculto `fbclid` es parte del set estándar de todo formulario con pauta (ADR 0099 punto 3), y la landing tiene que pasar todos los parámetros (punto 4). Este ticket suma "sin `fbclid`" a la alarma del 290, con el mismo molde.

- ✅ **20-oct (ok de Mani, por API, con respaldo; el resto de cada form idéntico):** los tres Typeform (TI `GmPGBOf9`, CA `nkMLdeh8`, Confianza `E5F4chVT`) tienen el set completo del ADR 0099; se agregó `fbclid` a los tres y `utm_id` a TI. Desde hoy el `fbclid` queda en `respuestas` (ADR 0058) aunque este ticket todavía no lo lea. Faltan los forms de Dapta y Form30x.
