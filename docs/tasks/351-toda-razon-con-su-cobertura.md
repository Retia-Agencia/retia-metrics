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

- [ ] Test: un ROAS con ventas en días sin gasto devuelve `null` y el motivo; con cobertura completa, el valor de antes.
- [ ] Test: el % de show con 3 de 10 citas resueltas sale "parcial" bajo el umbral, con base y faltan.
- [ ] Test de paridad: semáforo y ROAS convierten el mismo gasto al mismo total; una moneda no soportada es error, no 0.
- [ ] Ninguna tarjeta de razón recibe un `number` suelto (el tipo no lo deja).
- [ ] Recorrido de Hub › Pauta y Hoy con octubre: el ROAS dice desde cuándo hay gasto.
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y cualquier ADR que cambie quedan reescritos en el mismo commit, título e índice incluidos.
