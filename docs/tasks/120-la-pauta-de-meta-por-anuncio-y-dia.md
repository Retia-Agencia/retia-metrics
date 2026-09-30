---
id: 120
etapa: E6
serves: "ADR 0062 puntos 2 y 3 · docs/analytics.md PT-14, PT-24, PT-39, PT-58"
depends: [119]
status: todo
---

# 120 — La pauta de Meta: el árbol de campañas y el gasto por anuncio y día

## Objetivo

Que el gasto de cada anuncio entre solo al CRM, colgado del mismo id que traen los envíos (`utm_id`).

## Alcance

- **Dentro:** migración (sesión principal): `pauta_objetos` (nivel campaña, conjunto o anuncio; id de Meta
  único; id del padre; nombre; estado; formato del creativo; cuenta) y `gasto_pauta` (fecha, monto, moneda,
  origen `meta_api` o `manual`, y **exactamente un destino**: anuncio de Meta, o campaña o área para lo
  manual, por CHECK). `ad_spend` (vacía) se retira en la misma migración.
- **Dentro:** **una sola función** escribe el gasto (`registrarGasto`); la usan la sincronización y la
  captura manual (067).
- **Dentro:** la sincronización: Insights de Meta a nivel anuncio y por día, más los nombres y el padre de
  cada objeto. Re-lee los últimos 7 días (Meta ajusta el gasto hacia atrás), idempotente por (anuncio,
  día), por lotes. Un cron diario (cabe en Vercel Hobby, R3) y un botón "sincronizar ahora".
- **Dentro:** "última sincronización hace X" a la vista, y el error de la última corrida si falló.
- **Dentro:** el formato del creativo (video, imagen, carrusel) desde la API, para el filtro de PT-24.
- **Fuera:** crear o pausar campañas en Meta (el CRM lee, no administra). Tipo y autor del creativo (PQ6).

## Las reglas

- La moneda va con cada fila y al lado de cada cifra; nunca se convierte al guardar.
- Los tests no llaman a Meta: usan respuestas grabadas.
- Un anuncio de una cuenta de otro programa nunca se cuelga de este (frontera).

## Done cuando

- [ ] Correr la sincronización dos veces no duplica gasto, con test.
- [ ] Un ajuste de Meta sobre un día pasado actualiza ese día, con test.
- [ ] Un envío con `utm_id` resuelve a su anuncio, conjunto y campaña.
- [ ] El gasto cuadra con el Administrador de anuncios en un día elegido a mano (nota de cierre).

## Kiro

Sí, con revisión. La migración y la primera corrida en producción, la sesión principal con el ok de Mani.
