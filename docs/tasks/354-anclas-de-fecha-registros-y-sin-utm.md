---
id: 354
etapa: hub
serves: "ADR 0115 N1, N2 · auditoría 30-oct C-04, C-10, C-11, C-14, R-07, R-08"
depends: []
status: todo
---

# 354 — Cada hecho con su día, y registro, lead y "sin UTM" una vez

Auditoría: [`docs/auditoria-metricas-2026-10-30.md`](../auditoria-metricas-2026-10-30.md). Reglas: ADR 0115.

## Por qué

- **C-04:** el 100 % de los parciales de Typeform llega con `fecha_envio` NULL (515/515, 675/675, 517/517) y
  `embudo-formulario.ts:~97-111` los descarta: "Dejó datos" = "Completó". El ROAS sí los cuenta (`created_at`). Faltan
  178, 261 y 179 personas que solo dejaron datos.
- **R-07:** ~19 `AT TIME ZONE 'America/Bogota'` fuera de `hechos/fechas.ts`, y el día del envío tiene cuatro expresiones.
- **C-11:** "Deals creados" por día del envío en el Hub y por `created_at` en la escalera (Tactical 885 contra 948).
- **C-10:** "Leads" son personas en Comercial (875) y registros en Hoy (927).
- **C-14:** tres definiciones de "Sin UTM" que hoy coinciden por casualidad.
- **R-08:** `lunesDe` ×4, `sumarDias` ×2 y el calendario repartido entre `rangos.ts` y `dias-habiles.ts`.

## Alcance

1. En `lib/queries/hechos/fechas.ts`, un ancla con nombre por hecho (envío = `coalesce(fecha_envio, created_at)`, agenda
   creada, cita, venta, abono) y un solo `diaEnBogota(col)`. Filtros, hechos, embudo del formulario, ROAS y Pauta las
   importan. O, si es más limpio, la ingesta escribe `fecha_envio` en el parcial y se rellena lo viejo (escribe en la
   base: ok de Mani).
2. "Deals creados" con una sola ancla, también en la escalera.
3. `leadsDelRango` se borra o pasa a llamarse "Personas nuevas"; la meta de leads por día mide registros con
   `hechos/envio.ts`.
4. La categoría "sin UTM / macro / con UTM" deriva de `resolverCanal` y su gemela SQL; se borran `categoriaUtmSql` y
   `categoriaDe`.
5. `lib/dias-habiles.ts` es el único módulo de calendario; `rangos.ts` queda solo con los presets.
6. Guardián (N1): ningún `AT TIME ZONE` ni `getUTCDay` fuera de los dos módulos de fecha.

## Done cuando

- [ ] Test: un parcial sin `fecha_envio` cuenta 1 en "Dejó datos" y 0 en "Completó", y el mismo día en embudo y ROAS.
- [ ] Test de paridad SQL/TS de la categoría de UTM con `''`, macro y campaña sin source.
- [ ] Test: "Deals creados" da lo mismo en el Hub y en la escalera.
- [ ] Guardián de anclas de fecha mordido en los dos sentidos.
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y cualquier ADR que cambie quedan reescritos en el mismo commit, título e índice incluidos.
