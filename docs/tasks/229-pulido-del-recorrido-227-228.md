---
id: 229
etapa: O8
serves: "A-138 a A-141; recorrido local del 9-oct tras el 227 y el 228"
depends: [227, 228]
status: todo
---

# 229 — Pulido del recorrido del 227 y el 228

## Por qué existe

El recorrido en la base local del 9-oct (gerente y closer en Tactical) encontró cuatro cosas. Ninguna rompe datos,
pero las cuatro confunden a quien no es técnico. Mani (9-oct): armar el ticket y arreglarlas.

## Alcance

1. **Un closer puede tomar un deal sin dueño desde su ficha (A-138).** Hoy `puedeTrabajar` de
   `app/(app)/p/[programa]/deals/[id]/page.tsx` es falso para un closer si el deal no tiene dueño, y la tarjeta
   Transición sale vacía: solo se reclama desde el Inbox. El servidor ya reclama solo en los tres gestos que toman
   un lead (`anotar`, `registrarActividad` y `moverConHecho` por E1). Cambio:
   - Cuando el deal no tiene dueño y la sesión `trabajaLeads` (con el programa en su alcance, como ya filtra la
     página), la Transición muestra un aviso *"Este deal no tiene dueño. Si lo trabajas, queda a tu nombre."* y
     **solo** esos tres gestos: Registrar contacto, Lo estoy trabajando (Mover a) y Anotar. Nada más: ni
     Descartar, ni Corregir, ni Cambiar cohorte, ni Anular, ni Llamadas/Facturación (esos siguen pidiendo dueño).
   - La regla de qué gestos se ofrecen sin dueño vive en UN lugar (una función pura junto a `gruposDeTransicion`
     en `components/deals/pregunta-de-etapa.ts`, o en `lib/deals/permiso.ts` si la usa el servidor), no en la página.
   - La reja sigue en el servidor: no se afloja `puedeTrabajarDeal`. Un closer que fuerce otra acción sobre un deal
     sin dueño sigue recibiendo 403.
2. **Cambiar cohorte con el selector vacío (A-139).** `DialogoCohorte` en `components/deals/ficha/ficha-acciones.tsx`:
   si `destinos` está vacío, en vez del selector muestra *"No hay otra cohorte vendiendo hoy."* (o, si es student,
   *"No hay otra cohorte activa o futura."*) y no ofrece Cambiar.
3. **Texto contradictorio en "Lo estoy trabajando" (A-140).** `components/deals/dialogo-mover.tsx` (~línea 442)
   dice "Este paso no pide datos." debajo del comentario obligatorio. No mostrar esa línea cuando `pideComentario`.
4. **El detalle de la llamada no se refresca después de un Resultado (A-141).** `components/deals/detalle-de-llamada.tsx`
   lee el detalle UNA vez en un `useEffect`; `router.refresh()` no lo vuelve a pedir, así que tras marcar Show el
   diálogo sigue mostrando "Agendada" con el botón gris hasta cerrarlo y reabrirlo. Cambio: `AccionesDeLlamada`
   (`components/deals/ficha/acciones-de-llamada.tsx`) recibe un `onCambio?: () => void` que llama tras cada
   resultado exitoso (Show, fallida, reagendada, Grain), y `DetalleDeLlamada` lo usa para volver a pedir el detalle
   (por ejemplo, un contador en las dependencias del efecto). La ficha no lo necesita: ya se refresca con `router.refresh()`.

## Done cuando

- [ ] Test de la función pura del punto 1: sin dueño ofrece solo contacto, Lo estoy trabajando y Anotar; con dueño, lo de siempre.
- [ ] Test: un closer sobre un deal sin dueño sigue recibiendo 403 al mover a Cierre perdido (la reja no se aflojó).
- [ ] En el navegador (base local): un closer abre la ficha de un deal sin dueño, ve el aviso y los tres gestos, usa
  "Lo estoy trabajando" y el deal queda a su nombre en En gestión.
- [ ] El detalle de una llamada cambia a Show en el mismo diálogo, sin cerrarlo.
- [ ] Cambiar cohorte sin destinos muestra el mensaje; "Lo estoy trabajando" ya no dice "no pide datos". `npm run build` limpio.
