---
id: 369
etapa: hub
serves: "Weekly con Daniel Tovar del 3-nov (docs/hub.md §0, G-3) · ADR 0013, 0024, 0113 · AGENTS.md: caja y ventas son dos métricas"
depends: [377, 352, 374]
status: done
---

# 369 — El dinero en tres columnas: Vendido, Recaudado y Por cobrar

Entrega del Hub a Gerencia, fase 1 (`docs/hub.md` §0).

## Por qué

Daniel Tovar, weekly del 3-nov, en la lista detrás de una cifra de Dinero:

> "Ahí donde dice monto (...) son tres columnas distintas. No es solo una columna de dinero. Siempre tres columnas al
> tiempo. Vendido, que es el precio total al que se vendió, recaudado y monto por cobrar. (...) Si tú me dices ahí
> monto, yo no sé si ya la persona pagó los 1.500 dólares y son 1.500 dólares recaudados o son 1.500 dólares de
> cobrado."

> "Y en el vendido, siempre muéstrame la comparación de los tres. (...) No le pongas monto, sé más específico."

Hoy (3-nov): la tarjeta Vendido muestra solo el valor vendido (`app/(app)/hub/secciones.tsx:58`); Recaudado va en otra
tarjeta, **por fecha del abono** y de cualquier venta (`filtroCaja`); la cartera ("A hoy, no depende del periodo",
`components/dashboard/dinero.tsx:157`) es del programa entero y no sigue ningún filtro. Las listas muestran una
columna "Monto". Ninguna pantalla responde "de lo que vendimos en C3, cuánto ya entró y cuánto falta".

## Las tres cifras (una definición cada una, en `docs/metricas.md` §2)

Las tres se calculan sobre **el mismo conjunto de ventas**: las ventas (función del 352) que dejan pasar los filtros
del 377 (cohorte, periodo por fecha de venta, closer).

| Nombre visible | Qué es | Función |
|---|---|---|
| **Vendido** | Σ valor vendido (USD) de esas ventas | `contratadoDeDeals` (existe) |
| **Recaudado** | Σ abonos de ticket vigentes de esas ventas, **a hoy**, sin importar cuándo se abonaron | `saldosDeDeals` (existe) |
| **Por cobrar** | Vendido − Recaudado, venta por venta; un saldo negativo es sobrepago y se muestra aparte (`saldoLegible`) | `saldosDeDeals` |

Invariante probado: Vendido = Recaudado + Por cobrar − sobrepagos, al centavo.

**La caja por fecha no desaparece: cambia de nombre.** "Entró a caja" = Σ abonos vigentes con fecha en el periodo, de
cualquier venta, por moneda (la definición de hoy, ADR 0013). Contesta otra pregunta ("¿cuánta plata entró esta
semana?") y por eso tiene otro nombre (N4). La regla dura de `AGENTS.md` se cumple: caja y ventas siguen separadas y
ninguna se infiere de la otra (DH-2, decidido por Mani el 3-nov).

**Lo vendido aparte del programa (abono adicional, ADR 0113, el 1:1):** no es Vendido ni Por cobrar de la venta del
programa; se suma a "Entró a caja" y se muestra en su línea "Aparte del programa (1:1)" debajo de Recaudado, con su
lista. Cuando entre el 376 pasa a ser la venta de su propio SKU.

## Alcance

1. **Tarjeta "Vendido" del Hub (Dinero y la vista "todos"):** las tres cifras lado a lado con una barra apilada
   (recaudado / por cobrar) y el % recaudado. Cada cifra abre su lista. En "todos los programas" solo se suman en USD
   (ADR 0048).
2. **Toda lista de ventas** (detrás de Vendido, de Cupos, de cada fila de "Ventas por programa y cohorte" y de la
   escalera) lleva las tres columnas, en este orden: Vendido · Recaudado · Por cobrar, con el total al pie. La columna
   "Monto" sale de toda lista de ventas. La lista de "Entró a caja" (abonos) conserva su columna, rotulada "Abono".
3. **"Ventas por programa y cohorte"** (`secciones.tsx:177`): columnas Ventas · Vendido · Recaudado · Por cobrar.
4. **La cartera se funde en Por cobrar**: la tarjeta "cartera" deja de existir; Por cobrar con cohorte "Todas" y
   "Desde el inicio" es la cartera de hoy. Se borra lo que quede sin llamador (N7).
5. **Comisión** (Dinero): sigue sobre Vendido (ADR del valor vendido), con su porcentaje congelado (356).
6. Los nombres salen del vocabulario del 374; ninguna pantalla escribe "Monto", "Contratado" o "Caja" para estas cifras.

## Done cuando

- [x] Test: dos ventas (USD 1.500 pagada entera; USD 1.500 con un abono de 500) dan Vendido 3.000, Recaudado 2.000,
  Por cobrar 1.000; un abono anulado no cuenta; un abono adicional no cambia ninguna de las tres y sí "Entró a caja".
- [x] Test: las tres cifras siguen los filtros del 377 (cohorte, periodo, closer) y su lista suma lo mismo, página por
  página.
- [x] Test de paridad: Por cobrar con "Todas" + "Desde el inicio" = la cartera que calculaba `carteraDelPrograma`
  antes de borrarla.
- [x] Guardián: ninguna cadena visible "Monto" en `components/dashboard/`, `app/(app)/hub/` ni en las listas del Hub.
- [x] Recorrido en `dev:local` con ventas sembradas, escritorio y 375 px.
- [x] Regla N8: `docs/metricas.md` §2 (Vendido, Recaudado, Por cobrar, Entró a caja) y `overview.md` §11 en el mismo
  commit.

## Notas de la entrega (3-nov)

- Módulo único: `lib/queries/dinero-de-ventas.ts` (`dineroDeVentas`, `dineroDeSaldos`, `sumarDineroDeVentas`) sobre
  `saldosDeDeals`. Una venta sin saldo calculable (sin valor vendido o con abonos en otra moneda) queda fuera de las tres
  cifras y se cuenta aparte, para que el invariante se sostenga.
- `carteraDelPrograma`, la métrica `cartera` y la tarjeta de cartera se borraron (N7). Lo que se pierde de esa tarjeta
  en el Hub es el conteo de «vencidos» y «sin fecha de referencia»; la cartera vencida sigue viva en Students, Kanban e
  Inbox (`carteraVencida`).
- Tests: `tests/dinero-de-ventas.test.ts`. El guardián de «Monto» ya existía (`tests/hub-vocabulario-guardian.test.ts`,
  374) y cubre `components/dashboard/` y `app/(app)/hub/`.
- «Recaudado» como nombre de la caja por fecha pasó a «Entró a caja» en tarjetas, gráficas y comparativo por closer.
