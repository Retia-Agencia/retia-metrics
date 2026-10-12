---
id: 233
etapa: dinero
serves: "Michael/Andrea, 12-oct: 'A Ganado Pago Parcial no se mueve a mano (A2)' y el deal se queda en Atendido (A-143, A-144)"
depends: []
status: done
---

# 233 — "Pagó ahora" con el pago completo deja el deal en Ganado Completo

## Por qué existe

Andrea registró desde Atendido "¿Cómo terminó? · Pagó ahora" un abono de 1.500 USD (el ticket entero de Tactical) y
le salió **"A Ganado Pago Parcial no se mueve a mano: lo mueve el CRM cuando pasa el hecho (A2)."**. El deal quedó en
Atendido y **el abono no quedó**. Causa en `lib/deals/mover-con-hecho.ts`: `registrarAbono` deja el deal en
`ganado_completo` (saldo cero); después, como `actual.etapa !== entrada.a` (el botón pedía `ganado_parcial`), se llama
`moverEtapa` como usuario de `ganado_completo` a `ganado_parcial`, que es A2, flecha de sistema → rechazo → la
transacción entera se deshace. El diálogo ya promete "La etapa la decide lo que quede por pagar"; el código no lo
cumple.

## Qué se construye

- Con hecho `abono`, la etapa la decide el abono: si después de registrarlo el deal quedó en `ganado_parcial` o
  `ganado_completo`, no se intenta ningún movimiento más. Si el abono no movió el deal (p. ej. una etapa desde la que
  no hay flecha de abono), se rechaza con un mensaje que diga por qué, sin dejar el abono a medias.
- `moverConHecho` devuelve la etapa en que QUEDÓ el deal (`final.etapa`), no `entrada.a`.
- Placeholder del comprobante: hoy dice `https://drive.google.com/…` en `components/deals/formulario-abono.tsx` y
  `components/deals/ficha/ficha-pago.tsx`. Es un link de cualquier lado: placeholder genérico (`https://…`) y la
  etiqueta "Link del comprobante" (A-144).

## Done cuando

- [x] Test: desde Atendido, abono por el saldo completo → `ganado_completo`, abono vigente, una sola fila en
      `deal_etapa_historial`; abono parcial → `ganado_parcial`. Igual desde Compromiso Verbal.
- [x] Test: el resultado de la acción trae la etapa final real.

## Anotaciones

A-143, A-144.
