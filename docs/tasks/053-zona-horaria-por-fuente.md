---
id: 053
etapa: E3
serves: "plan v2 §6 etapa 3 · tarea E3-6 · regla dura de fechas (AGENTS.md), insumo §5.2"
depends: [039, 049]
status: todo
---

# 053 — Zona horaria por fuente, default Bogota

## Objetivo

Que una fecha de la hoja se interprete con la zona **de esa fuente** y no con la del proceso que
corre el sync.

🩸 **Las dos hojas de hoy vienen en UTC** (Typeform), y hoy se parsean como si fueran de Bogota.
Eso corre cada fecha cinco horas: de 7pm a medianoche, el dia cambia.

## Alcance

- **Dentro:** usar `sources.tz_fechas` (creada en el ticket 039, default `America/Bogota`) en
  `parsearFecha` y en todo lo que convierta una celda a `timestamptz`.
- **Dentro:** poner **UTC** en las dos fuentes reales, explicito, no por defecto.
- **Dentro:** el boton **Probar** muestra **el ultimo envio convertido**, para que el gerente vea
  con sus ojos si cuadra (insumo §5.2).
- **Fuera:** la zona de lo que la app **prellena**. Eso es `hoyEnBogota()` y no cambia.

## Las reglas duras que aplican aqui

- **Toda fecha de negocio es de Bogota y el `-05:00` va explicito.** Colombia no tiene horario de
  verano.
- **`new Date(a, m, d)` y `toISOString().slice(0,10)` estan PROHIBIDOS**: el primero usa la zona
  del proceso, el segundo da el dia en UTC, que de 7pm a medianoche ya es manana.
- Los dos unicos lugares que implementan esto son `parsearFecha` (`lib/sheets/mapeo.ts`) y
  `hoyEnBogota()` (`lib/format.ts`). **No debe haber un tercero.**
- El piso de plausibilidad (`ANO_MINIMO_PLAUSIBLE`) se conserva: un centinela devuelve `null`.

## Done cuando

- [ ] La misma celda leida con `tz = UTC` y con `tz = America/Bogota` produce instantes distintos,
      probado.
- [ ] Las dos fuentes reales quedan en UTC y las fechas de `dev` no se mueven respecto de hoy
      (o se mueven **las cinco horas esperadas**, medido, no intuido).
- [ ] Probar muestra el ultimo envio ya convertido.
- [ ] `grep` no encuentra `new Date(` con tres argumentos ni `toISOString().slice(0,10)` para una
      fecha de negocio.

## Kiro

Si, con revision. Es un cambio chico con radio grande.
