---
id: 423
etapa: comercial
serves: "Michael Castellanos, reunión del 11-nov: «que sea obligatorio… la forma de pago y el comprobante», «quita el link de pago, eso no hace falta», «las plataformas ya están puestas»"
depends: []
status: todo
---

# 423 — La plataforma de pago es obligatoria en el abono, y el link de pago sale del formulario

## El problema (medido en el código, 12-nov)

Hoy un closer guarda un abono, y con él un deal pasa a Ganado, **sin decir por dónde entró la plata**:

- `components/deals/formulario-abono.tsx` solo manda `enlacePagoId`. La plataforma que el closer elige dentro de
  `ControlEnlacePago` es estado local (`useState` de `plataformaId`, línea ~152) y **no viaja al servidor** si no elige
  también un link.
- `registrarAbono` (`lib/deals/abonos.ts:192-194, 238`) deriva la plataforma del enlace; sin enlace llama
  `exigirPlataformaActiva(entrada.plataformaId)`, y `lib/abonos/plataforma.ts` **devuelve sin validar** cuando no hay id
  ("la columna es opcional"). Resultado: `abonos.plataforma_id` nulo, sin error.
- El comprobante ya es obligatorio (`comprobanteUrl` en el esquema, línea 78, y el motor lo exige para Ganado). Lo que
  falta es la plataforma.

Consecuencia: la caja por plataforma (Hotmart, Bancolombia, Binance…) no cuadra, y no hay forma de saber cuál
entrada falta porque un nulo no avisa.

## Alcance

1. **El formulario pide la plataforma, obligatoria,** con las plataformas activas vinculadas al programa
   (`plataformasDelPrograma`, ADR 0034). Sin elegirla, no se puede guardar (validación del navegador y del servidor).
2. **El link de pago sale del formulario del abono** (Michael). El monto deja de quedar de solo lectura por el link.
3. **Servidor:** la entrada operativa del abono exige `plataformaId` (zod) y `exigirPlataformaActiva` lo valida. Lo
   que sigue aceptando un abono sin plataforma (importadores, histórico) se nombra explícitamente, no se deja por
   omisión.
4. **N7, reemplazar es borrar:** si `enlacePagoId` deja de tener llamador operativo en el abono, se retira del
   camino del abono (esquema, `registrarAbono`, reja de monto contra el enlace, líneas 183-191). La columna
   `abonos.enlace_pago_id` y el catálogo `enlaces_pago` **se quedan**: tienen historia y Recursos los sigue usando para
   mandarle el link al lead. Retirar la columna, si se decide, va en otro ticket con migración.
5. Mismo cambio en los otros dos lugares que registran abono (`components/deals/responder-pregunta.tsx`,
   `components/deals/ficha/ficha-pago.tsx`) y en la acción `app/(app)/p/[programa]/deals/[id]/acciones.ts`.

## Decisiones (antes de construir)

- **D-1. ¿El closer puede seguir creando una plataforma desde el abono (ticket 212)?** Michael: «las plataformas ya
  están puestas». Recomendación: **no**; el selector solo lista las activas y crear queda en Recursos para quien
  administra. Confirmar con Mani.
- **D-2. Los abonos que ya están sin plataforma.** Contar en producción (solo lectura) cuántos vigentes hay y de qué
  programa. Recomendación: **no rellenar a mano**; se muestran en Facturación como "sin plataforma" para que el closer
  la corrija con el flujo existente de corrección del 212. Un relleno inventado se ve igual que uno real.

## Done cuando

- [ ] D-1 y D-2 respondidas por Mani, con fecha.
- [ ] Guardar un abono sin plataforma da 400 con mensaje claro, **forjando la server action** (no solo el botón
      deshabilitado; `AGENTS.md`, "hay que forjar la petición").
- [ ] Un abono con plataforma inactiva o de otro programa se rechaza.
- [ ] El formulario ya no muestra el link de pago y el monto es editable.
- [ ] Ningún llamador operativo manda `enlacePagoId` al abono, o el que queda está nombrado.
- [ ] Tests del cambio en verde (`tests/` de abonos), typecheck, lint y `npm run build` (componente cliente).
- [ ] Recorrido en `dev:local`: abonar, mover a Ganado, clic en todo lo que se abre, consola limpia, claro, oscuro y
      375 px.
- [ ] Conteo de D-2 anotado aquí.
