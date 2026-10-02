---
id: 133
etapa: NC1
serves: "ADR 0065 punto 7 · comercial.md R-4, GC-12, QD-5"
depends: [132]
status: done
---

# 133 — La comisión es un porcentaje del valor vendido, congelado al vender

## Objetivo

Reemplazar el monto fijo por venta (062) por un porcentaje del valor vendido, que se congela en el deal el
día que entra a venta.

## Por qué

Gerencia: *"si vendiste a 600, no te voy a dar los mismos 80"*. Y es plata que se le paga a personas: si
mañana cambia el % de ComunicArte, la comisión de septiembre no se mueve (ADR 0065).

## Alcance

- **Dentro:** migración aditiva: `programs.comision_porcentaje numeric(5,2)` nulo y
  `deals.comision_porcentaje numeric(5,2)` nulo. `CHECK` entre 0 y 100. La aplica la sesión principal.
- **Dentro:** `moverEtapa()` copia el % vigente del programa al deal **la primera vez** que el deal entra a
  Abonado o Completo, en la misma transacción. Si ya tenía uno, no lo pisa (un deal que sale y vuelve a venta
  conserva el suyo).
- **Dentro:** `lib/queries/comision.ts`: comisión de un deal = `valor_vendido_usd × comision_porcentaje / 100`;
  la de un closer en un rango = la suma de sus ventas. `null` si el deal no tiene % (nunca 0). Se calcula; el
  monto no se guarda.
- **Dentro:** el % se edita en `/ajustes/programas` (molde del catálogo, `change_log`). Se retira
  `comision_por_venta_usd` del código y de la pantalla; la columna se quita en una migración posterior al
  despliegue (AGENTS: primero el código sin ella).
- **Dentro:** el dashboard muestra la comisión por programa, nunca sumada (ADR 0048), con la moneda al lado.
- **Fuera:** los números de cada programa: los da Dani (QD-5). Se cargan como dato desde la pantalla.

## Done cuando

- [x] Cambiar el % del programa no cambia la comisión de un deal ya vendido (test en los dos sentidos).
- [x] Corregir el valor vendido de una venta cambia su comisión (el % congelado se mantiene).
- [x] Un programa sin % muestra "sin porcentaje cargado", no USD 0.
- [ ] El agregado de "todos los programas" no compila con la comisión (molde del 095). **Pasa al 095** (1-oct): ese molde todavía no existe.

## Codex

Sí, esfuerzo `high`. Migraciones por la sesión principal.
