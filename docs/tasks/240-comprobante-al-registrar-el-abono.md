---
id: 240
etapa: dinero
serves: "235 (A-146) · ADR 0085 punto 3"
depends: [239]
status: todo
---

# 240 — El comprobante se sube al registrar el abono

## Por qué existe

El flujo de todos los días: el closer registra el pago y en el mismo formulario pone la foto, sin volver después.

## Alcance

- El formulario de abono (`components/deals/formulario-abono.tsx`) y el de "Pagó ahora"
  (`components/deals/responder-pregunta.tsx`) usan el componente del 239.
- El archivo se sube y confirma **antes** de registrar; `registrarAbono` y `mover-con-hecho` reciben un `archivoId`
  opcional y lo cuelgan en la misma transacción que crea el abono y mueve la etapa. Si la transacción se deshace, el
  archivo queda `pendiente` y lo barre el 241.
- Validar que el archivo es del mismo programa y que lo subió el mismo actor.

## Done cuando

- [ ] Registrar un abono con foto deja el abono con su comprobante, la etapa movida y una sola entrada de rastro por
      campo.
- [ ] Registrar con link o sin nada funciona como hoy.
- [ ] Un `archivoId` de otro programa o de otro usuario se rechaza en el servidor (probado forjando).
- [ ] Humo de la UI limpio.
