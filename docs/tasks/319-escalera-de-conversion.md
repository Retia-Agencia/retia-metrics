---
id: 319
etapa: media
serves: "ADR 0109 · propuesta.md §3.1 (la escalera ya responde preguntas sin IA)"
depends: []
status: done
---

# 319 — La escalera de conversión

## Alcance

- Migración: `programs.corte_pago_rapido_dias` (entero, nulo permitido, CHECK > 0), editable en Programa por quien
  administra, con rastro.
- `lib/queries/escalera.ts`: `escaleraDeDeals`, sobre la capa de hechos (C-2), con la regla y la precedencia del
  ADR 0109; días hábiles de Retia y fechas de Bogotá; `vigente()` en `calls`, `deals` y `abonos`. Corte nulo: une 2 y 3
  en "pagó después" y lo marca.
- **Medición antes de mostrar** (solo lectura en producción): por programa, cuántas ventas caen en el escalón 1 y una
  muestra para que Mani o gerencia confirmen que son "pagó en la llamada". El resultado va al archivo de este ticket; si
  no cuadra, se para y se enmienda el ADR 0109.
- `docs/metricas.md`: la escalera, en el mismo commit.

## Done cuando

- Tests por escalón en los dos sentidos, con anulados, corte nulo y cambio de escalón cuando el deal paga.
- La suma de los escalones de venta (1 a 4, ADR 0109 enmendado) en un periodo es igual a las ventas del Hub en el mismo periodo (test).
- La medición está escrita en este archivo.

## Avance (28-oct, sesión carril M)

**Hecho:** `lib/queries/escalera.ts` (`escalonDeDeal` pura, `cargarEscalera`, `escaleraDeDeals`, `agruparEscalera`),
corte editable en Programa (campo `cortePagoRapidoDias` en `esquemaPrograma`, formulario y KPI; rastro en
`change_log` por el molde), `docs/metricas.md` §3.1. Tests: `tests/escalera-regla.test.ts`,
`tests/escalera.test.ts` (los siete escalones, anulados, corte nulo, cambio de escalón al pagar y la suma 1 a 4
contra la lista `cierres`) y el caso del corte en `tests/acciones-programas.test.ts`.

**Decisión de universo (a confirmar con Mani, no está en el ADR 0109):** los escalones 1 a 4 son las ventas del periodo
y los 5 a 7 los deals creados en el periodo que nunca se han vendido; así la suma 1 a 4 cuadra con las ventas del Hub.

## Medición en producción (solo lectura, 28-oct)

Hecha con SQL de solo lectura que NO lee `corte_pago_rapido_dias` (la 0105 no está aplicada). Ventas históricas
(`ventasConDiaEn` equivalente), primer abono de ticket vigente y última cita atendida no posterior a él:

| Programa | Ventas | Escalón 1 (mismo día) | Pagó 1 día hábil después | Resto después | Sin llamada registrada |
|---|---|---|---|---|---|
| comunicarte | 32 | 10 | 1 | 3 (4, 7 y 10+ hábiles) | **18** |
| tactical-investor | 18 | 9 | 2 | 0 | **7** |
| comunicate-confianza | 2 | 1 | 1 | 0 | 0 |

Muestra de escalón 1 (cita y primer abono el mismo día; ids de deal completos):
- comunicarte: `ad6a8676-c2a4-4692-8b62-c02040ac7fc0` (7-oct), `ca323819-024e-4326-946c-d4710b020e40` (8-oct),
  `735c480d-870d-4a42-9905-7b30479b11e4` (8-oct), `126a8911-8293-4dc5-8076-5a04d274be36` (12-oct),
  `529f876b-21fc-4e76-b335-dae2075a1dbe` (12-oct), `bf5d4398-aca5-4969-ae42-811806c8fe9e` (15-oct).
- tactical-investor: `e659d4df-dc73-4e1d-8bd4-fac0d2b71957` (7-oct), `9c844b37-4828-48c7-83b9-78184e1bab72` (7-oct),
  `b1cab821-e88d-4896-8c82-71f7779decc8` (12-oct), `86ffa48f-c9cb-449e-8c89-7fb5add851ed` (12-oct),
  `49325d74-b51e-4dbd-b817-e8b2bdb8a854` (15-oct), `e02914be-92cb-443f-8df5-6ac71584ae01` (19-oct).
- comunicate-confianza: `498ae234-665e-4841-8ff9-1aa36e6ea29c` (20-oct).
(Los scripts desechables de la medición se borraron; la consulta es la de `ventasConDiaEn` + primer abono de ticket + última cita atendida no posterior.)

**Hallazgo y decisión (Mani, 28-oct):** 25 de las 52 ventas (**48 %**) no tienen NINGUNA llamada registrada: 20 vienen de
la migración de las hojas (deal y abonos, sin llamadas) y 5 se crearon a mano en octubre sin cita; ninguna tiene llamadas
anuladas ni sueltas con su correo. No hay contra qué medirlas, así que son un **escalón aparte, «Pagó sin llamada
registrada»** (ADR 0109 enmendado): las ventas son los escalones 1 a 4 y los sin venta, 5 a 7.

**Pendiente (Mani / sesión principal):** (1) aplicar la 0105 (con el ok de Mani); (2) que Mani o gerencia confirmen
que la muestra de escalón 1 es de verdad «pagó en la llamada»; (3) que gerencia cargue el corte de cada programa en Programa. Mientras no haya corte la tarjeta junta 2 y 3.
