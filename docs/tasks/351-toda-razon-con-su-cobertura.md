---
id: 351
etapa: hub
serves: "ADR 0115 N3 · auditoría 30-oct C-01, C-02, C-13, R-06"
depends: []
status: todo
---

# 351 — Toda razón con su cobertura, y el gasto que falta

Auditoría: [`docs/auditoria-metricas-2026-10-30.md`](../auditoria-metricas-2026-10-30.md). Reglas: ADR 0115.

## Por qué

- **C-01 (crítica):** `gasto_pauta` y `tasas_cambio` empiezan el 2026-10-08 (22 días). El ROAS de octubre suma ventas
  desde el 1-oct sobre gasto desde el 8-oct: ComunicArte ~1,24 contra ~0,56 en la misma ventana, Tactical 1,08 contra
  0,90. `components/pauta-roas.tsx:50` solo dice "sin pauta" cuando el gasto es 0. El cron reescribe 7 días, así que el
  hueco no se cierra solo.
- **C-02:** el % de show se mide sobre el 19 a 21 % de las citas pasadas y la pantalla lo pinta como si fuera entero.
- **C-13:** 24 a 63 % de los envíos pagos llegan sin `utm_id`; el ROAS por anuncio no lo dice en la fila.
- **R-06:** dos convertidores de gasto: `sumarEnCop` (semáforo) avisa cuando falta TRM; `convertir` (`roas-de-pauta.ts:292`)
  devuelve 0 en silencio, no suma las fotos del día en curso y cuenta 0 para cualquier otra moneda.

## Alcance

1. Un tipo `RazonConCobertura = { valor: number | null; base: number; faltan: number; motivo: string | null }` en `lib/`
   y una regla pura que decide "completa / parcial / no calculable" con un umbral de cobertura (el umbral es dato del
   programa, contrato C-1; el valor por defecto lo propone el ticket y lo confirma Mani).
2. ROAS, costo por agenda (de ventana y del semáforo), % de show, % de cierre, agenda → venta y la proyección devuelven
   ese tipo. Una razón cuyo numerador y denominador no cubren los mismos días devuelve `valor: null` con el motivo
   ("gasto de Meta desde el 8-oct").
3. `coberturaDeGasto(programa, rango)` = primer día, último día y días sin fila, leída de `gasto_pauta`.
4. Un solo convertidor de gasto en `lib/pauta/` (total, días sin TRM, monedas no soportadas como error, fotos del día en
   curso incluidas o dichas), usado por semáforo y ROAS. Se borra `convertir` de `roas-de-pauta.ts`.
5. La UI pinta "parcial · N de M" o "—" con el motivo; nunca el número a secas.
6. **Backfill del gasto del 1 al 7-oct** con la API de Meta (`time_range` por cuenta): escribe en la base, **pide el ok de
   Mani** (DA-8). Sin ok, el punto 2 basta para que la cifra no mienta.

## Fuera

La captura del resultado de la llamada (341) y la reja de la comisión (356): aquí solo se muestra la cobertura.

## Done cuando

- [x] Test: un ROAS con ventas en días sin gasto devuelve `null` y el motivo; con cobertura completa, el valor de antes.
  Evidencia: `tests/roas-de-pauta.test.ts` ("no calcula el ROAS cuando una venta queda antes del primer día de gasto" y el
  `total.roas.valor` igual a contratado ÷ gasto en el escenario de siempre).
- [ ] Test: el % de show con 3 de 10 citas resueltas sale "parcial" bajo el umbral, con base y faltan.
  **Para el 353.** La regla ya existe y está probada en puro (`tests/cobertura.test.ts`: 3 de 10 → parcial con umbral 0,8);
  falta que `tasas-del-grupo.ts` devuelva el % de show con el tipo.
- [x] Test de paridad: semáforo y ROAS convierten el mismo gasto al mismo total; una moneda no soportada es error, no 0.
  Evidencia: `tests/gasto-paridad.test.ts` (mismo gasto COP + USD con la misma TRM, y la ventana que empieza antes del gasto
  da costo `null` con `faltan`) y `tests/convertir-gasto.test.ts` (`EUR` lanza).
- [ ] Ninguna tarjeta de razón recibe un `number` suelto (el tipo no lo deja).
  **Mitad de pauta hecha:** la celda de ROAS solo pinta `<CifraDeRazon razon>` (`components/cifra-de-razon.tsx`) y
  `RenglonRoas.roas` es `RazonConCobertura`. El costo por agenda expone `costoCobertura`, pero `costo` sigue como
  `number | null` porque el contrato de WhatsApp es estricto: la tarjeta del semáforo y el mensaje lo pasan al tipo
  junto con las tarjetas de Hoy y Comercial (353).
- [x] Recorrido de Hub › Pauta y Hoy con octubre: el ROAS dice desde cuándo hay gasto.
  Evidencia (30-oct, `dev:local` desde el worktree, que tiene `node_modules` copiado; base local con gasto pago sembrado
  solo del 15 al 30-sep, porque producción ya quedó cubierta con el backfill): con el periodo 1 al 30-sep, Total Paid
  muestra ROAS "— · Gasto de Meta desde el 15 sep 2026" y "Cómo se calcula" dice "Hay gasto de Meta desde el 15 sep 2026
  hasta el 30 sep 2026"; con el 15 al 30-sep vuelve a número. Hoy y Programa › Ventas cargan; consola sin errores.
  Nota: a 800 px de ancho el motivo se parte en cuatro líneas dentro de la columna del ROAS (la tabla es `table-fixed`).
- [x] Regla N8 (ADR 0115): para esta mitad, `docs/metricas.md` (Conceptos, Gasto, Costo por agenda, ROAS) y
  `docs/overview.md` §11 (ROAS y Cobertura de una razón); ningún ADR cambia. El 353 repite la casilla para el % de show.
  Texto original: la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y cualquier ADR que cambie quedan reescritos en el mismo commit, título e índice incluidos.

## Avance (30-oct, ola 1, mitad de pauta)

Hecho: `RazonConCobertura` y `estadoDeCobertura` (`lib/cobertura.ts`, umbral por defecto 0,8, **confirmado por
Mani el 30-oct**), `coberturaDeGasto` (`lib/pauta/cobertura-de-gasto.ts`), un solo convertidor (`lib/pauta/convertir-gasto.ts`;
se borró `convertir` de `roas-de-pauta.ts` y el semáforo usa el mismo), ROAS por renglón y costo por agenda de ventana con
cobertura, y `<CifraDeRazon>` para pintarla. El día en curso: el semáforo lo lee de las fotos; el ROAS no las lee y lo
dice (si hoy no tiene gasto cargado, la venta de hoy cae en `faltan`). Los días interiores sin fila cuentan como cubiertos
(una campaña pausada gasta 0).

Backfill (punto 6): `scripts/rellenar-gasto-de-pauta.ts --desde 2026-10-01 --hasta 2026-10-07 --aplicar`, **corrido el
30-oct con el ok de Mani** contra `hfqmiyiuyqapdsbywrag`: 349 filas de gasto, 0 omitidas, y 21 publicaciones de TRM
(1 al 31-oct, ningún día de gasto sin TRM). Ahora el gasto empieza el 1-oct en ComunicArte y Tactical, y el 6-oct en
Comunícate con Confianza (Meta no devolvió gasto antes). Con eso el ROAS de octubre vuelve a calcularse entero; la
cobertura sigue protegiendo cualquier otro hueco.

Queda para el 353: el % de show, % de cierre, agenda → venta y la proyección con el tipo; la columna del umbral por
programa (migración, la aplica la sesión principal); la tarjeta del semáforo, el mensaje de WhatsApp y las tarjetas de Hoy
y Comercial recibiendo `RazonConCobertura` en vez de `number`. Fuera de las dos mitades sigue C-13 (el ROAS por anuncio
no dice en la fila cuántos envíos llegaron sin `utm_id`).
