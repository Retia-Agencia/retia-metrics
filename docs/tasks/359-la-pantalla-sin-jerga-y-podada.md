---
id: 359
etapa: hub
serves: "ADR 0115 N5, ADR 0077 · auditoría 30-oct U-01, U-02, U-06, U-10, U-11, U-14, U-16, U-18, U-19, U-21, U-23, G-01"
depends: [357]
status: todo
---

# 359 — La pantalla sin jerga, y podada

Auditoría: [`docs/auditoria-metricas-2026-10-30.md`](../auditoria-metricas-2026-10-30.md). Reglas: ADR 0115.

## Por qué

Quienes usan el CRM no son técnicos, y la pantalla todavía habla como el código:

- **U-01:** `components/dashboard/origen.tsx:48-51` muestra `ad_id`, `utm_id={{ad.id}}` y "ADR 0099";
  `components/pauta-interina.tsx` muestra `utm_content`/`utm_term`, "Macro sin expandir", "Sin envío de origen".
- **U-02:** tres tarjetas de diagnóstico de captación bajo el reporte de Origen. **U-16:** "Sin token" para gerencia.
- **U-06:** la tarjeta "Lo que viene · Se está construyendo" en Hoy. **U-10:** tres reglas de diseño como aviso fijo en
  Dinero. **U-11:** Origen y Pauta descritas casi igual.
- **U-14:** pestaña "Por decidir" (es salud), "Webhook Health". **U-18:** Comercial con ~10 bloques y tres cortes del
  mismo embudo, "owner". **U-19:** "Shows sin Grain" y "Atendidos sin Grain".
- **U-21:** WhatsApp con "fbclid" y "envíos pagos". **U-23 / G-01:** menú con Calls, Students, Nerd Stats junto a
  Próxima cohorte y Ajustes.

## Decisión abierta

- **DA-6:** nombres del menú. Propuesta mínima: Calls → Llamadas y Students → Estudiantes (no son vocabulario del
  negocio); Lead y Deal los decide Mani.

## Alcance

1. Origen: una tarjeta "Calidad del rastreo" ("X de Y registros pagados llegan hasta el anuncio" y su lista); la tabla de
   plantillas y "contenido con código que no reconocemos" pasan a Ajustes › Salud (developer).
2. Se quita "Lo que viene" de Hoy (el plan vive en `docs/plan.md`); las notas de Dinero se vuelven tooltip del "—".
3. Comercial: Embudo, Por closer y Agendas por semana; el resto, plegado en "Diagnóstico".
4. Mi espacio: "Por decidir" → nombre según lo que contiene; "Webhook Health" → "Conexión de formularios".
5. Una bandera "Llamadas sin grabación (Grain)" con dos números.
6. Menú y subtítulos desde un diccionario único en `lib/nav.ts`, según DA-6.
7. Guardián (N5): ninguna cadena visible en `app/` o `components/` contiene `utm_`, `ad_id`, `ADR `, `ticket`,
   `macro`, `periodo A` o `periodo B`.

## Done cuando

- [ ] Guardián de jerga mordido en los dos sentidos.
- [ ] Recorrido de cada pestaña del Hub y de Mi espacio con cada rol (`npm run test:humo` en verde).
- [ ] Ninguna tarjeta que el ADR 0077 mande quitar sigue en pantalla.
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y cualquier ADR que cambie quedan reescritos en el mismo commit, título e índice incluidos.
