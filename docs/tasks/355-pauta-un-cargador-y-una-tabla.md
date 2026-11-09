---
id: 355
etapa: pauta
serves: "ADR 0115 N1, N7 · auditoría 30-oct R-01, R-06, U-03, U-04, U-12, U-13 · enmienda el 350"
depends: [351, 352, 353, 354, 388]
status: done
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

**Ampliado el 7-nov (plan F7 del 385, §3):** además de lo anterior, crear `lib/queries/hechos/gasto.ts` (falta; contrato §7), unificar las anclas del ROAS (agendas sin ancla de fecha de cita, ventas de cualquier fecha: H-02, H-18) y borrar `pauta-interina` y `categoriaDe`. Ancla el recorrido de ROAS a lo que mida el [388](./388-f2-tanda-2-paridad-de-lo-no-cubierto.md).

## Done cuando

- [x] Test: para el mismo periodo, la suma de ventas de la tabla por campaña y por canal da lo mismo que Comercial.
- [x] `pauta-interina.*` y `categoriaDe` no existen; grep limpio.
- [x] Recorrido a 375 px y en escritorio, claro y oscuro, con clic en todo lo que se abre; `npm run build` (hecho el 9-nov contra la base local, ver «Falta» abajo).
- [x] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y cualquier ADR que cambie quedan reescritos en el mismo commit, título e índice incluidos.

## Estado (9-nov, noche) · rama `t355`, sin commit

**Decisiones de Mani (9-nov):** (1) la venta se atribuye al origen que trajo a la persona y se ancla al día del ENVÍO (cohorte), aunque compre
semanas después (lo dijo Daniel Tovar en el weekly del 3-nov, `docs/weekly-2026-11-03.md`); las ventas del periodo sin envío de pauta salen
aparte en una nota de reconciliación (28 del Hub contra 13 de Pauta en Comunicarte octubre). (2) La vista **por canal oculta Gasto y ROAS**: Meta da
el gasto por anuncio, no por canal, y mostrar "—" o 0 se leería como dato. (3) Aviso de cobertura "parcial: N agendas pendientes" cuando quedan
citas de la cohorte por ocurrir; el ROAS proyectado es del 375.

**Hecho (Kiro, Codex estaba sin cupo):** `lib/queries/hechos/gasto.ts` (nuevo), un solo cargador (`roas-de-pauta.ts`, nivel `canal`,
`reconciliacion`, `agendasPendientes`, `valorVendidoUsd`), tabla única `components/pauta-roas.tsx` (`?ver_por=`), borrados `pauta-interina.ts`,
`components/pauta-interina.tsx` y su test; tres tests de paridad reescritos sobre el cargador (353 N2, escalera 349, páginas); `metricas.md` y
`overview.md` §11 al día. Verificado: typecheck, lint, 7 archivos de test del cambio + 28 de guardianes (mcp, pauta, tracker, loading…), `npm run build`.

**Falta (por eso sigue `en curso`):**
- [x] Recorrido hecho el 9-nov contra la base local (gerente, ComunicArte Local, escritorio claro y 375 px oscuro): tabla por campaña y por canal (sin Gasto ni ROAS), nota de reconciliación (16 ventas del periodo, 8 atribuidas), «Cómo se calcula», vista «todos» solo con conteos sin «(interina)», sin desbordamiento horizontal de la página (la tabla desplaza dentro de su caja), sin errores de consola de la app. Límites: la semilla no trae campañas con anuncio, así que no se abrió el detalle campaña › conjunto › anuncio; el aviso «agendas pendientes» no apareció (la semilla no tiene citas futuras). Detalle visual menor en celular: las cabeceras de la tabla se pegan («EnvíosAgendadas…») y «% no asistió» parte el texto; es del componente `Tabla` compartido, fuera del 355.
- Cómo se corre (aprendido): `preview_start` arranca desde el checkout principal; para probar un worktree se agrega temporalmente una configuración con `sh -c "cd <worktree> && PORT=3355 npm run dev:local"` a `.claude/launch.json` del principal y se revierte con `git checkout`.
- [x] `/codex:adversarial-review` hecha el 9-nov: 3 hallazgos (gasto por canal en el MCP, pendientes de deals vendidos, madurez fuera de la cobertura) corregidos en `10ec98ec`.
- [x] Commit, push y CI verde (`10ec98ec`).
