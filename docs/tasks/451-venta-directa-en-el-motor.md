---
id: 451
etapa: deal
serves: "ADR 0133 puntos 4, 5 y 6 · D1, D2, D5"
depends: []
status: done
---

# 451 — La venta directa: abono del sistema y flecha a Ganado sin dueño

## Qué
El motor, sin saber de Hotmart: dada una venta confirmada (deal, monto, moneda, plataforma, fecha, referencia
externa), registrar el abono como sistema y mover el deal. Lo llama el 455; se construye en paralelo con 448 a 450.
- Deal **con dueño** → abono y flechas de siempre (E6, E11, E12). Es venta del closer.
- Deal **sin dueño** → flecha nueva S4 (sistema) desde Potencial, Registrado o Calificado a Ganado Pago Parcial o
  Ganado Pagado Completo, sin exigir dueño. Cae en Students.

## Dónde mirar
`lib/deals/etapas.ts:137` (`FILAS_ETAPA`) · `lib/deals/requisitos.ts:85` (`requisitosDe`) y `:126`
(`PROPIEDADES_POR_ETAPA`, que hoy exige `dueno` en las dos ganadas) · `lib/deals/mover-etapa.ts:408` (CAPI y aviso a
Customer Success salen solos) · `lib/deals/abonos.ts:139` (`registrarAbono` exige un closer: falta la puerta del
sistema) · `abonos.origen` (hoy `app` o `mcp`).

## Cómo
1. Migración: `abonos.referencia_externa` + índice único parcial `(origen, referencia_externa)`. La aplica la sesión
   principal (memoria: migraciones las aplica Claude).
2. Puerta de abono del sistema: mismo cálculo de saldo y la misma transacción con el deal bloqueado que `registrarAbono`;
   `registrado_por_user_id` nulo, origen `hotmart`. No se duplica la lógica del saldo: se extrae y se comparte.
3. S4 en `FILAS_ETAPA` con `quien: "sistema"`; sus requisitos son los de pago sin `dueno`. La exención de `dueno` en
   `PROPIEDADES_POR_ETAPA` aplica solo a la venta directa, y se pregunta con una función central, no con un `if` suelto.
4. Valor vendido = ticket de la cohorte con descuento 0, por `congelarValorVendido` (`lib/deals/valor-vendido.ts:36`),
   el único escritor (D1); saldo = valor vendido − abonos (D2); Completo solo con saldo cero. El descuento lo escribe
   gerencia después por la edición de siempre, que ya lleva a Completo (`lib/deals/editar-deal.ts:148`): no se toca.
   Fecha límite de un parcial: el cierre de ventas de la cohorte (D2, pendiente menor; una constante con nombre).
5. El deal queda sin dueño (D5): ni la flecha ni el abono asignan uno.
6. Un deal ya en Agendado o más adelante y sin dueño no existe hoy (Agendado exige dueño); si aparece, test que lo diga.

## Done cuando
- [x] Tests: completo sin dueño, parcial sin dueño, con dueño (flecha de closer), compra repetida (un solo abono),
      deal anulado (no se toca). (`tests/venta-directa.test.ts`)
- [x] Test: el Purchase de Meta queda en cola y el aviso a CS se encola (los dispara `moverEtapa`).
- [x] No corre `db:generate` ni `db:migrate`: deja el cambio en `lib/db/schema.ts` y la sesión principal genera la
      migración (memoria del repo).

## Hecho (16-nov)
- `registrarVentaDeLaPasarela` (`lib/deals/venta-de-la-pasarela.ts`) es la puerta que llama el 455.
- S4 vive aparte del índice (`FILAS_VENTA_DIRECTA`, `lib/deals/etapas.ts`): Calificado → Ganado ya es E6.
- La base prohibía una venta sin dueño (`deals_venta_con_dueno`). Excepción nombrada nueva: `deals.venta_directa_en`,
  que escribe solo S4; y `deals_venta_directa_sin_dueno` impide que esa venta reciba dueño (D5). El 452 puede
  preguntar "¿es venta directa?" por esa columna.
- **Migración pendiente** (la genera la sesión principal con `db:generate`): `abonos.referencia_externa` + índice único
  parcial, `deals.venta_directa_en`, los dos CHECK y el valor `hotmart` en `origen_cambio`.

## Arreglo del CI (16-nov, Alejandro, carril P)

El CI de `552f9aa4` quedó en rojo por dos guardianes que no conocían lo nuevo de Hotmart:
- `tests/patron-de-ruta.test.ts`: la carpeta `app/api/webhooks/pagos` no estaba en `SEGMENTOS_DE_RUTA` (`lib/db/medidor.ts`). Agregada.
- `tests/mcp-cobertura-guardian.test.ts`: `buscarLeadsParaPagoAccion` queda como lectura (`buscar_leads`) y
  `asignarCompraAccion` como pendiente de operación en `lib/mcp/cobertura.ts`. El trinquete
  `TOPE_DE_PENDIENTES_DEL_MCP` sube de 96 a 97 por esa capacidad nueva (decisión de Alejandro); baja cuando el MCP la exponga.
