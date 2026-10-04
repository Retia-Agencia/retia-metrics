---
id: 190
etapa: O6
serves: "148 (Lo que sigue, puntos 11 y 12); comercial.md §9.7 (#1, #2, #4, #5, #6)"
depends: [148, 146]
status: todo
---

# 190 — Series por mes en Dinero y el acumulado contra el mes anterior

## Alcance

1. **Por mes:** contratado y cupos vendidos con la meta del mes como línea (de `leerMetasDelMes`, 146), y el recaudo
   por la fecha del abono. Ejes lineales, moneda al lado.
2. **Acumulado del mes contra el mes anterior al mismo día hábil**, con la meta del mes como tercera línea (hoy son
   tarjetas con su variación).
3. Sobre `components/series-lineales.tsx`; las cifras salen de los módulos que ya existen (`saldo.ts`, `metas.ts`,
   `vendidosEn`), sin recontar.

## Done cuando

- Test: la serie del mes cuadra con la tarjeta del mismo mes del dashboard y con la página de Metas.
- Typecheck, lint, tests, `npm run build`; recorrido en `dev:local`, 375 px.
