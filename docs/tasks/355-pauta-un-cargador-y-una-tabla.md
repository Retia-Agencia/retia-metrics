---
id: 355
etapa: pauta
serves: "ADR 0115 N1, N7 · auditoría 30-oct R-01, R-06, U-03, U-04, U-12, U-13 · enmienda el 350"
depends: [351, 352, 353, 354]
status: todo
---

# 355 — Pauta: un cargador y una tabla

Auditoría: [`docs/auditoria-metricas-2026-10-30.md`](../auditoria-metricas-2026-10-30.md). Reglas: ADR 0115.

## Por qué

- **R-01:** la pestaña Pauta pinta `PautaInterina` (`pauta-interina.ts`, venta por su fecha) y `PautaRoas`
  (`roas-de-pauta.ts`, venta por la fecha del envío) juntas (`p/[programa]/hub/page.tsx:431-432`): dos "Ventas" que
  pueden diferir en el mismo periodo sin un error. `origen.ts` es un tercer cargador.
- **U-03:** dos tablas con las mismas columnas (registros, agendas, shows, no shows, % no show, ventas) agrupadas distinto,
  sin decir cuál usar; "(interina)" en el título de la vista "todos".
- **U-12:** en celular, la tabla de ROAS (10 columnas, `pauta-roas.tsx:122`) y la de `pauta-interina.tsx:317` no tienen
  `overflow-x-auto`.
- **U-04 / U-13:** ROAS "3,25" sin unidad; la moneda dos veces; "contratado" como tercer nombre de vendido.

## Alcance

1. Un solo cargador sobre los conceptos de 351 a 354 que expone registro, agenda, show, no show, venta, valor vendido,
   gasto y ROAS por dimensión (campaña › conjunto › anuncio, o canal y par UTM), con **una** ancla por paso, escrita en
   `metricas.md`.
2. Una tabla con "Ver por: Campaña de Meta | Canal", el mismo componente, dentro de `Tabla` de `piezas.tsx` (que ya trae
   el desplazamiento horizontal).
3. Se borran `lib/queries/pauta-interina.ts`, `components/pauta-interina.tsx` y `categoriaDe` en el mismo ticket (N7).
4. La vista "todos" deja de llamarse "(interina)" y reusa la tabla por programa con solo conteos (ADR 0048).
5. ROAS con "×", cabeceras "Valor vendido" y "Gasto" (la celda ya lleva la moneda).

## Done cuando

- [ ] Test: para el mismo periodo, la suma de ventas de la tabla por campaña y por canal da lo mismo que Comercial.
- [ ] `pauta-interina.*` y `categoriaDe` no existen; grep limpio.
- [ ] Recorrido a 375 px y en escritorio, claro y oscuro, con clic en todo lo que se abre; `npm run build`.
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y cualquier ADR que cambie quedan reescritos en el mismo commit, título e índice incluidos.
