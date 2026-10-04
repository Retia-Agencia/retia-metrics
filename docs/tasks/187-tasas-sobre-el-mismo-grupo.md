---
id: 187
etapa: O6
serves: "ADR 0079; 148 (Lo que sigue, punto 3); overview.md §7"
depends: [148]
status: todo
---

# 187 — Las tasas del embudo sobre el mismo grupo de personas

## Por qué existe

El % de cierre dividía ventas por fecha de venta entre shows por fecha de llamada: dos grupos distintos, y podía
pasar de 100%. Por closer mezclaba al dueño del deal con quien tomó la llamada. Mani decidió (4-oct, ADR 0079) que
toda tasa sea real: el mismo grupo arriba y abajo.

## Alcance

1. **Un módulo** en `lib/queries/` con la cohorte de citas del rango (ADR 0079 puntos 1 y 2) y la cadena: % de show,
   % de cierre, agenda → venta, por programa y por closer (punto 4). Pura la cuenta, aparte la lectura, como el 065.
2. **Lo usan todos:** el Pulso y la Operación comercial del dashboard, el comparativo entre closers, Mi espacio ›
   Métricas (`lib/queries/mi-espacio-metricas.ts`) y la lista de cada tasa (`metricas-con-filas.ts`): la lista abre
   exactamente los deals del grupo (ADR 0067).
3. **"Aún madurando"** cuando el rango termina hace menos de 30 días (punto 5), en una línea junto a la tasa.
4. Las cantidades (ventas, caja, contratado) no cambian.
5. `analytics.md` §6 y `structure.md` §9 dicen la definición si la nombran.

## Done cuando

- Un test con PGlite: un deal con show la semana pasada y venta hoy entra al grupo de la semana pasada, no al de
  esta; ninguna tasa pasa de 100%; % de show × % de cierre = agenda → venta; un no-show re-agendado con show cuenta
  una vez; anulados, cortesías, citas futuras y otro programa no cuentan.
- Por closer: un deal cuyo show tomó Ana y cuyo dueño es Beto cuenta en el % de cierre de Ana.
- El dashboard, el comparativo y Mi espacio dan el mismo número para el mismo closer y rango.
- Cada tasa abre su lista y la lista tiene tantas filas como dice la cifra.
- Typecheck, lint, tests del ticket, `npm run build`; recorrido en `dev:local` como gerente y closer, 375 px.
