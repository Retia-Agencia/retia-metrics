---
id: 120
etapa: E6
serves: "ADR 0062 puntos 2 y 3 · docs/analytics.md PT-14, PT-24, PT-39, PT-58"
depends: [119]
status: done
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

- [x] Correr la sincronización dos veces no duplica gasto, con test.
- [x] Un ajuste de Meta sobre un día pasado actualiza ese día, con test.
- [x] Un envío con `utm_id` resuelve a su anuncio, conjunto y campaña.
- [x] El gasto cuadra con el Administrador de anuncios en un día elegido a mano (nota de cierre).

## Kiro

Sí, con revisión. La migración y la primera corrida en producción, la sesión principal con el ok de Mani.

---

## Enmienda 14-oct (audit del Hub, ADR 0087 y 0088, `docs/hub.md` §2.4 y §4)

- **Además del gasto, las agendas según Meta**, por anuncio y día: el campo `conversions`, action_type
  `offsite_conversion.fb_pixel_custom.invitee_meeting_scheduled` (el mismo en todos los programas, verificado el
  13-oct). `actions` no sirve: trae la suma de todos los eventos personalizados. Se guardan al lado del gasto y nunca
  entran al costo oficial (ADR 0088).
- **De cada anuncio se guardan sus `url_tags`**, para que el 248 muestre qué plantilla de UTM usa cada cuenta, y de
  cada campaña su **objetivo** (`OUTCOME_LEADS`, `OUTCOME_ENGAGEMENT`...), para HQ-4.
- **Un registro de cada corrida** (`pauta_sincronizaciones`: inicio, fin, estado, filas, error), para que "no corrió"
  no se vea igual que "no pasó nada"; el semáforo (258) lo lee para su nota de calidad.
- **El árbol completo, paginado:** Tactical tiene 818 anuncios y Milena 815 (la mayoría inactivos y sin `url_tags`). Se
  traen todos los niveles con su estado; el gasto solo existe para lo que entregó.
- **La moneda:** cada fila en la de su cuenta; dos cuentas USD de CA hacen que un programa sume gasto en dos monedas.
  Convertir es de la consulta, con la TRM del 244.
- **Durante el día** la sincronización la dispara el endpoint del 259 (Juanito, ADR 0089); el cron diario de Vercel
  cierra el día y re-lee los últimos siete.
- **Lo que no se borra:** `ad_spend` sigue retirándose aquí (vacía, 0 filas el 14-oct).

## Nota de cierre (14-oct)

- Implementó Codex; el arreglo (corrida cortada, gasto corregido a cero, monto como texto) lo hizo Kiro porque Codex
  se quedó sin cuota. La sesión cambió la puesta en cero a "cero la ventana de la cuenta y reescribir" en una
  transacción, y bajó la página de anuncios a 100 (Meta rechaza 500 con el creativo anidado en las cuentas grandes).
- Migración 0081 aplicada en producción con el ok de Mani (`lock_timeout`, RLS en las tres tablas, `ad_spend` sin
  `CASCADE`: tenía 0 filas y ninguna FK).
- Primera corrida real: 107 s, 435 filas, 1.883 anuncios en el árbol. Del 9 al 13-oct contra el audit (`docs/hub.md`
  §2.4): TI 4.238.878 COP contra 4.235.327 y 47/47 agendas; CA 4.375.799 contra 4.372.647 y 51/51; CcC 510.281
  contra 510.266 y 5/5. La diferencia (< 0,1%) es el ajuste hacia atrás de Meta.
- Queda para otros tickets: el hecho del gasto en la capa del 262 y conectar `arbolDePauta` al emparejador (247).
  Propuesta para el 259 (sin decidir): sincronizar al abrir el Hub con `after()` si la última corrida tiene más de
  1 h, en modo liviano (solo hoy, el árbol si tiene más de 24 h).
