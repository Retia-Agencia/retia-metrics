---
id: 123
etapa: E7
serves: "ADR 0063 · docs/analytics.md PT-09, PT-22, PT-25, PT-27 a PT-32, PT-51"
depends: [085, 089, 115, 120, 244, 247, 262, 351]
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

---

## Enmienda 14-oct (audit del Hub, ADR 0087 y 0088, `docs/hub.md` §5.2)

- **Las definiciones son las de `docs/hub.md` §5.2**: el costo por agenda divide entre las **agendas del CRM** (ADR
  0088); las de Meta van al lado y su diferencia es del 249.
- **La TRM es la de cada día del gasto** (244), y la pantalla dice la que usó; la "TRM de la cohorte" ya no existe (A12
  cerrada).
- **Fuera:** la burbuja "sin UTM · según el comercial" (el origen declarado se retiró, ADR 0081) y la cubeta "sin
  clasificar" (ADR 0087).
- **Se construye sobre la capa de hechos** (262); el área sale de la regla del 246 y el detalle de pauta del 247.
- **Vive en Hub › Pauta** (ADR 0086).
- **Absorbe el 067** (ROAS por cohorte: es el atajo de cohorte del periodo) y la parte de costos del 090.

## Enmienda 19-oct: se adelanta al Hub

Anderson pidió (mensaje de Michael, 19-oct) "embudo de agendas por canal, creativo y UTM". Decidido con Mani: el 123 y
el 125 se construyen **antes del 250**, sobre la capa de hechos (262), en una ruta de Programa; el 250 los mueve al Hub
sin rehacerlos. "Creativo" es el anuncio de Meta (`utm_id`, ADR 0062). El 244 y el 247 están integrados.


## Enmienda 20-oct (ADR 0099)

Toda cifra por anuncio muestra su cobertura: cuántas agendas, citas o ventas quedaron sin anuncio ("12 de 40 sin anuncio"), nunca un total que cuadra a la fuerza (ADR 0099 punto 6). La cobertura sale de la misma función del 290.

## Enmienda 30-oct (auditoría de métricas)

El gasto de Meta en la base empieza el 8-oct (C-01): todo CPL, CAC o costo por etapa que construya este ticket devuelve
cobertura con el tipo del 351 y no se pinta sobre días sin gasto. El convertidor de gasto es el único del 351, no uno
nuevo. Depende además de 351. Auditoría: `docs/auditoria-metricas-2026-10-30.md`.
