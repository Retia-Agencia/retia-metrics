---
id: 123
etapa: E7
serves: "ADR 0063 · docs/analytics.md PT-09, PT-22, PT-25, PT-27 a PT-32, PT-51"
depends: [085, 089, 115, 120]
status: todo
---

# 123 — El embudo de Pauta y los costos por etapa

## Objetivo

Las dos vistas que Anderson dijo que le bastan: el panel de atribución por área (captura 1 de
`docs/analytics.md`) y el de costos por etapa (captura 2), sobre los datos del CRM y el gasto de Meta.

## Alcance

- **Dentro, consultas** (una definición por métrica, `docs/analytics.md` §6; series con dimensiones, 089):
  registros (tokens), agendas, llamadas, show, calificadas, ventas, contratado, caja y gasto, por área,
  canal, campaña, conjunto y anuncio. Costos por etapa, ROAS y ad profit con la TRM de la cohorte a la vista.
  Calidad de la traza (N3 a N0). La burbuja "sin UTM · según el comercial" (121). El embudo partido por
  `lead_value` y por `hvm_tier`.
- **Dentro:** `programs.valores_calificados` (por defecto MUY ALTO y ALTO VALOR), editable, con rastro.
- **Dentro, pantalla:** secciones del Dashboard (095): los cinco KPI con su reparto por área y su
  comparativo, la composición semanal por área, y el bloque de costos con su embudo.
- **Dentro:** pauta cuenta envíos y venta cuenta deals con el origen del envío que los abrió (ADR 0060).
- **Fuera:** el árbol por anuncio (125) y el cumplimiento (124).

## Las reglas

- Sin gasto o sin denominador en una rebanada, "sin pauta", nunca $0 (ADR 0045).
- Ninguna tasa ni costo se suma entre programas (ADR 0048).
- La TRM se muestra junto a cada ROAS y ad profit.

## Done cuando

- [ ] Un parcial y su completa cuentan un registro, con test.
- [ ] Una llamada con show de un lead ALTO VALOR cuenta como calificada y una de BAJO VALOR no, con test.
- [ ] El ROAS de un caso armado a mano da lo mismo que en la pantalla.
- [ ] Recorrido con clic en todo lo que se abre, claro y oscuro.

## Kiro

Sí, con revisión del contrato de las consultas y revisión visual.

---

## Heredado del 087 (30-sep)

El 087 se cerró sin consulta de costo porque no existía. Este ticket la construye y trae sus dos tests: un lead
con `entrada = 'formulario'` de área Comercial (link del closer) y uno orgánico de Media **no cuentan** en el
denominador del costo de Pauta. El área sale de `emparejar` (085), el conteo es por token (DP-11), y
`leads.entrada` no se lee (ADR 0044 punto 5).

> ⚠️ **1-oct: abierto.** La migración 0057 quita `cohorts.trm_cohorte` (Mani). De dónde sale la TRM del ROAS es
> la decisión A12 de `docs/plan.md` §7, y se toma antes de E7. Hasta entonces, lo que este documento dice de la
> "TRM de la cohorte" describe la intención, no una columna que exista.
