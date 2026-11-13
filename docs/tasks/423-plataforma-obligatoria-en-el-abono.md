---
id: 423
etapa: comercial
serves: "Michael Castellanos, reunión del 11-nov: «que sea obligatorio… la forma de pago y el comprobante», «quita el link de pago, eso no hace falta», «las plataformas ya están puestas»"
depends: []
status: en main
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

### Respuestas de Mani (12-nov)

- **D-1: sí, el closer sigue pudiendo crear una plataforma desde el abono.** Aclaración de Mani: el abono pide
  solo la plataforma por la que entró el pago, en un dropdown con las plataformas del programa; si no está, la crea
  ahí mismo (`crearOVincularPlataforma`, `lib/catalogo/plataformas.ts`: crea por el molde con `change_log` y la
  vincula al programa, o vincula la existente). Plataforma y comprobante, los dos obligatorios. Los links de pago
  siguen en Recursos para tener a mano, pero el abono ya no pide ni guarda link. Enmienda la del 30-oct del 212
  («el flujo operativo ya no crea ni elige plataformas desde el abono»).
- **D-2: no rellenar a mano.** El abono sin plataforma se marca «Sin plataforma» en la ficha y el closer la elige
  con «Cambiar plataforma», que reemplaza a «cambiar link» (`cambiarEnlaceDeAbono` → `cambiarPlataformaDeAbono`).
- **Conteo D-2 (producción, solo lectura, 12-nov, abonos vigentes):** 53 sin plataforma, ninguno con link.
  ComunicArte 37 de 66 (6-oct a 11-nov), Comunícate con Confianza 11 de 11 (14-oct a 7-nov), Tactical Investor
  5 de 24 (7-nov a 9-nov).

## Done cuando

- [x] D-1 y D-2 respondidas por Mani, con fecha.
- [x] Guardar un abono sin plataforma da 400 con mensaje claro, **forjando la server action** (no solo el botón
      deshabilitado; `AGENTS.md`, "hay que forjar la petición").
- [x] Un abono con plataforma inactiva o de otro programa se rechaza. *(Inactiva: sí. «De otro programa» no es reja: AGENTS.md y el ADR 0034 dicen que el vínculo es proyección; con N8, ADR > ticket. Ver Resultado.)*
- [x] El formulario ya no muestra el link de pago y el monto es editable.
- [x] Ningún llamador operativo manda `enlacePagoId` al abono, o el que queda está nombrado.
- [x] Tests del cambio en verde (12-nov, sesión padre: 13 archivos, 227 tests, typecheck y lint en el worktree; la concurrencia contra Postgres real la confirma el CI) (`tests/` de abonos), typecheck, lint y `npm run build` (componente cliente).
- [x] Recorrido en `dev:local`: abonar, mover a Ganado, clic en todo lo que se abre, consola limpia, claro, oscuro y
      375 px.
- [x] Conteo de D-2 anotado aquí.

## Resultado (12-nov, hija H1; sin commit, lo commitea la sesión padre)

- **Servidor.** `esquemaAbono.plataformaId` obligatorio y sin `enlacePagoId`; `registrarAbono` exige plataforma activa
  (`exigirPlataformaActiva`, ya sin el atajo de "sin id no valido") y escribe `enlace_pago_id` nulo. La reja de monto contra
  el link y `exigirEnlaceDePagoVigente` se borraron (N7). `cambiarEnlaceDeAbono` pasó a `cambiarPlataformaDeAbono` (si el link
  viejo era de otra plataforma, lo deja nulo en la misma escritura). Nueva `crearPlataformaParaAbonoAccion` sobre
  `crearOVincularPlataforma`; `crearEnlaceParaAbonoAccion` se borró. Las acciones validan `plataformaId` con un mensaje
  único («Elige la plataforma por la que entró el pago.»), también para el texto vacío.
- **Pantalla.** `ControlPlataforma` (buscar, elegir o «Crear «X»») reemplaza a `ControlEnlacePago` en el registro del
  abono (ficha, diálogo de mover y tablero) y en «Cambiar plataforma». Sin plataforma o sin comprobante el botón no guarda.
  Un abono vigente sin plataforma muestra «Sin plataforma». El bloque «Link de pago» de Facturación sigue como acceso rápido.
- **Nombrados, no por omisión:** `lib/deals/historico.ts` y `lib/migracion/importar.ts` siguen pudiendo dejar la plataforma nula.
- **«De otro programa» no se rechaza en el servidor:** el contrato de AGENTS.md («Que programas ve un selector de plataforma»)
  y el ADR 0034 lo fijan como proyección, no reja. Con «Crear» en el selector, el closer siempre puede vincularla. Si se
  quiere reja, es una enmienda del ADR, no de este ticket.
- **ADR 0034:** enmienda del 12-nov escrita (reemplaza la del 30-oct). El título del índice no cambia.
- **Verificación.** Typecheck limpio, lint 0 errores, `npm run build` verde. Los 94 tests de los archivos de abonos los corrió
  Codex con Vitest directo (el sandbox no deja correr `scripts/test.mjs`); en local no los corrí por swap alto (5 GB): los
  confirma el CI. Recorrido en `dev:local` (closer, ComunicArte local): abonar desde la ficha creando/vinculando «hotmart»
  (resolvió la «Hotmart» existente), deal a Ganado Pago Parcial; mover a Ganado desde «Ganado · registrar pago» (Confirmar
  deshabilitado sin plataforma); «Sin plataforma» y «Cambiar plataforma»; oscuro, claro y 375 px. Forjando
  `registrarAbonoAccion`: sin `plataformaId`, con `""`, con una inactiva y con solo `enlacePagoId` → `ok:false` con el
  mensaje y la base sin abono nuevo. Consola: solo errores de stream de las cuatro peticiones forjadas a mano; ninguno de los
  clics normales. No recorrí el arrastre en el tablero (mismo `FormularioAbono`).
