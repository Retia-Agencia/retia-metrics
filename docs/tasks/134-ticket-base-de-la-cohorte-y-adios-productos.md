---
id: 134
etapa: NC1
serves: "ADR 0065 puntos 4, 5 y 6 (descuento) · comercial.md GC-10, GC-11, QM-1, QM-2"
depends: [132]
status: todo
---

# 134 — El ticket base es de la cohorte, y `productos` se retira

## Objetivo

Que haya **un** precio de lista, el de la cohorte, y que el descuento de cada venta se lea contra él.

## Por qué

Hoy tres columnas contestan la misma pregunta: `programs.ticket_usd`, `cohorts.precio_usd` y
`productos.precio_lista` (ADR 0024: una pregunta, un lugar). La C1 de ComunicArte fue 697 y la C2 797: el
precio es de la cohorte.

## Alcance

- **Dentro:** el descuento de un deal = `cohorts.precio_usd` de su cohorte − valor vendido, en USD y en %
  (función en `lib/queries/saldo.ts` o vecino, no en la pantalla). Sin cohorte o sin valor: `null`.
- **Dentro:** la meta en cash de una cohorte = `meta_cupos × precio_usd` de la cohorte (donde hoy se lea
  `programs.ticket_usd` para eso: `lib/queries/vista-dashboard.ts`, `components/dashboard-programa.tsx`).
- **Dentro:** `programs.ticket_usd` queda solo como valor por defecto al crear una cohorte (prellena el
  campo); ninguna métrica lo lee. Comentario en el esquema que lo diga.
- **Dentro:** retirar `productos`: el código (catálogo, pantalla `/productos`, selectores, el requisito
  `producto` del motor ya reemplazado en el 132) y después, en migración aparte, la tabla, `deals.producto_id`
  y la FK de `enlaces_pago.producto_id` (los enlaces quedan sin producto). Antes de la migración, comprobar en
  producción que ningún deal tiene producto (el 1-oct: 0 de 157). La navegación pierde la entrada "Productos".
- **Dentro:** actualizar `AGENTS.md` (contratos que nombran productos), `structure.md` y el ADR 0016.
- **Fuera:** llenar el valor de los históricos (078).

## Done cuando

- [ ] Un deal de la C2 de ComunicArte vendido a 697 muestra "descuento USD 100,00 (12,5%)".
- [ ] Ninguna consulta de métrica lee `programs.ticket_usd` (grep en el test, o guardián si cuesta poco).
- [ ] `grep -rn productos lib app components` solo devuelve lo que se retira en la migración.
- [ ] `npm run build` limpio y la suite completa en verde tras quitar la tabla.

## Codex

Sí, esfuerzo `medium`; la migración destructiva la lee y la aplica la sesión principal con el ok de Mani.
