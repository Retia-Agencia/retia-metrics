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

## Avance 22-sep (status sigue `todo`: falta la mitad que escribe en `production`)

- ✅ **Código:** `parsearFecha(celda, zona)` lee con la zona de la fuente. Bogotá conserva el
  `-05:00` literal y las demás zonas pasan por `Intl` (con horario de verano). Una zona que no
  existe lanza `ZonaHorariaInvalidaError` (422) y el sync se detiene antes de escribir. El dedup
  recibe `zonaDe(fila)` y el sync pasa `sources.tz_fechas` de cada fuente. Tests en
  `tests/zona-por-fuente.test.ts`: la misma celda en UTC y en Bogotá da cinco horas de
  diferencia, el default no cambia, hay horario de verano, el centinela sigue siendo null, una zona
  inválida falla, y el sync se probó de punta a punta sobre PGlite.
- ✅ **Grep** del "done": no hay `new Date(` con tres argumentos para una fecha de negocio. El
  `toISOString().slice(0,10)` de `lib/rangos.ts` es aritmética de calendario sobre `Date.UTC`,
  no un instante, y se deja.
- 🩸 **El desfase está confirmado por evidencia documentada, no medido en esta sesión** (el
  checkout no tenía `.env.local`). `flujo-de-leads-y-closers-retia.md:251-256` cita una fila con
  `Submitted At` 16/9 23:05 sellada por el Apps Script a las 18:08 de Bogotá, y los consolidados
  C2 solo cuadran con Urgencias restando cinco horas.
- ⏳ **Falta, y pide el ok de Mani porque escribe en `production`:** poner `tz_fechas = 'UTC'` en
  las dos fuentes reales. **El código es inerte hasta ese UPDATE.** Después, el sync siguiente
  corrige solo, con bitácora, las fechas de ~4.800 leads, porque las fechas están en
  `CAMPOS_COMPARABLES`. Conviene hacerlo primero en `dev` y medir que se muevan exactamente las
  cinco horas.
- ⏳ **Falta:** que el botón **Probar** muestre el último envío convertido.
