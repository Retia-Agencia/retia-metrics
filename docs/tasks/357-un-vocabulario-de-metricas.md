---
id: 357
etapa: hub
serves: "ADR 0115 N4 · auditoría 30-oct G-02 a G-09, K-08, U-05, U-07, U-08, U-09, U-15, U-17, U-21"
depends: []
status: todo
---

# 357 — Un vocabulario de métricas, y un guardián

Auditoría: [`docs/auditoria-metricas-2026-10-30.md`](../auditoria-metricas-2026-10-30.md). Reglas: ADR 0115.

## Por qué

El mismo concepto tiene hasta cinco nombres en pantalla, y a veces el mismo nombre son dos cosas:

- Llamada que ocurrió: Show, Realizadas (show), Llamadas atendidas, Ocurridas, Atendidos (que son deals) — G-02.
- Envío completo: Registros, Leads, Envíos — G-03 (y C-10: "Leads" son personas en Comercial y registros en Hoy).
- Venta: Cierres, Ventas, Cupos vendidos, Vendido (cantidad en Metas, USD en Dinero), Contratado — G-05.
- Meta del día: meta dinámica, Meta de hoy, Esperado, Deuda — G-04. Plata cobrada: Recaudado, Caja cobrada, Caja — G-06.
- Llamada sin resultado: cuatro nombres — G-07. "Agendas" son citas en Comercial y agendas creadas en Origen — G-08, K-08.
- "vendidos hoy" con cualquier periodo (U-07, U-15); "{n} registros" para abonos o llamadas en la lista (U-17); "meta
  dinámica" y "periodo A/B" (U-08, U-09); el mensaje de WhatsApp con "ag", "reg", "c/u" y verde/amarillo/rojo frente a "En
  meta / Atención / En peligro" de la UI (U-21).

## Alcance

1. Un módulo en `lib/` con, por clave de métrica: nombre corto, nombre largo y una línea de definición, alineado con
   `overview.md` §11. Propuesta (N4): Registros, Leads (personas), Agendadas, Citas, Llamadas realizadas, No asistió,
   Llamadas sin resultado, Ventas, Valor vendido (USD), Recaudado, Por cobrar, Meta de hoy, Esperado a hoy, Cupos que
   faltan.
2. Hub (todas las pestañas y la vista "todos"), listas, Mi espacio, Pauta y el texto de WhatsApp toman el rótulo de ahí.
   Los títulos de lista (hoy en dos copias) y el semáforo (tres vocabularios) también.
3. Las frases que dicen "hoy" se condicionan al periodo; la frase de pendientes vive en un componente único.
4. Guardián: un rótulo literal para una clave del vocabulario en `app/`, `components/` o `lib/reporte-whatsapp/` falla.
5. `overview.md` §11 se reconcilia con el vocabulario (hoy desaconseja "registro").

## Done cuando

- [ ] Grep: ninguna de las variantes retiradas (Cierres, Contratado, Caja cobrada, meta dinámica, No-show, Deuda cupos)
  aparece en texto visible.
- [ ] Guardián mordido en los dos sentidos.
- [ ] Recorrido de Hoy, Comercial, Dinero, Pauta, Origen, Mi espacio y una lista, sin términos de dos nombres.
- [ ] Regla N8 (ADR 0115): la fila de `docs/metricas.md`, el vocabulario de `overview.md` §11 y cualquier ADR que cambie quedan reescritos en el mismo commit, título e índice incluidos.
