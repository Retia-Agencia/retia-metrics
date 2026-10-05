---
id: 190
etapa: O6
serves: "148 (Lo que sigue, puntos 11 y 12); comercial.md §9.7 (#1, #2, #4, #5, #6)"
depends: [148, 146]
status: done
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

## Nota de cierre (5-oct, Alejo + Claude; Codex empezó y se quedó sin cuota)

- `lib/queries/series-dinero.ts` (`leerSeriesDeDinero`): seis meses hasta el mes del final de A (el último corta en
  hoy, Bogotá). Cupos por `ventasConDiaEn`, contratado por `contratadoDeDeals` en lotes por mes (por día solo en los dos
  meses de la comparación), caja por abonos con `filtroCaja` + `vigente` y `sumaDeAbonos`, metas de
  `leerMetasDelMes`. Respeta el closer como las tarjetas (dueño en ventas, registrador en caja); la meta no se reparte.
- Acumulado del mes contra el mes anterior al mismo hábil (`mismoPuntoHabil`), con su propio B (no el del selector);
  si B tiene menos hábiles, la línea anterior se corta en vez de arrastrarse.
- Dinero: una gráfica por mes y una acumulada para contratado (USD) y cupos, con la meta del mes punteada, y una por
  moneda para el recaudo, **sin meta** (no existe meta de recaudo y la de USD no se convierte). Cada punto abre su
  lista; "Ver cifras" despliega la tabla (sirve en táctil).
- `SeriesLineales`: margen del eje según el largo de las etiquetas, enlaces por punto y tabla opcional visible. Los
  usos existentes no cambian salvo el margen.
- Tests: `tests/series-dinero.test.ts` (mes = tarjeta del dashboard = Metas; anulada, revertida y otro programa no
  cuentan; closer; mismo hábil; cambio de año; mes futuro). Typecheck, lint y tests de dashboard, metas, páginas y
  guardianes en verde.
- **Falta:** `npm run build` y el recorrido en `dev:local` con 375 px (desde el checkout principal tras el merge).

