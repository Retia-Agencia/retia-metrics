---
id: 226
etapa: O8
serves: "A-126; decisión de Mani del 9-oct"
depends: [222]
status: review
---

# 226 — Chip "Sin Grain" en Notificaciones

## Por qué existe

El 222 pedía "sin Grain" dentro de Vencidos, pero no había un predicado por deal y quedó afuera. Mani (9-oct):
*"debería haber manera de saber si no tiene grain claramente para que salgan"*, y lo quiere como **chip propio**:
pegar un link es otra tarea que ponerse al día con un vencido.

## Alcance

- Un chip nuevo **Sin Grain** en `lib/mi-espacio/notificaciones.ts`, justo después de Vencidos.
- Un deal del universo (dueño = la sesión, programa elegido) entra si tiene **al menos una llamada vigente con
  resultado `show` y sin `link_grain`** (nulo o vacío). Una lectura más por `inArray` sobre los ids del universo,
  con `vigente(calls)`.
- Fecha clave: la `fecha_llamada` más antigua de esas llamadas; orden ascendente (la que lleva más tiempo sin
  Grain primero).
- No cuenta para el número sin ver (223).

## Done cuando

- [ ] El chip sale con su conteo y lista las tarjetas; el conteo es igual al total de la lista.
- [ ] Test: entra un deal con Show sin Grain; no entra con Grain, ni con la llamada anulada, ni de otro dueño.
