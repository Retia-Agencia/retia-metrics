---
id: 374
etapa: hub
serves: "Weekly con Daniel Tovar del 3-nov (docs/hub.md §0, G-3, G-11: 'sé más específico') · ADR 0115 N4, N5 · reemplaza al 357 y absorbe la parte del Hub del 358 y del 359"
depends: []
status: done
---

# 374 — El Hub habla un solo idioma: un vocabulario, un formato y la regla del vacío

Entrega del Hub a Gerencia, fase 1 (`docs/hub.md` §0). Va primero porque 369 a 373 toman sus rótulos de aquí.

## Por qué

Daniel Tovar, weekly del 3-nov: "No le pongas monto, sé más específico (...) asigna tres nombres distintos para esas
cosas", y frente a la gráfica acumulada: "No entiendo esa gráfica (...) ni los datos que dicen abajo."

La auditoría del 30-oct ya lo había medido (G-01 a G-13): la misma cifra con varios nombres según la pantalla, formatos
locales de porcentaje y moneda, "—" y "0" usados indistintamente, y texto técnico visible (`utm_`, "macro", "periodo
A"). Eran tres tickets (357, 358, 359) que tocaban los mismos archivos del Hub: se juntan aquí para hacerse una vez,
**solo en el Hub y sus listas**. Lo que esos tickets tenían fuera del Hub queda en el 358 y el 359, fase 2.

## Alcance

1. **El vocabulario, un módulo en `lib/`** (lo que era el 357): por clave de métrica, nombre corto, nombre largo y una
   línea de definición, alineado con `overview.md` §11. Lista mínima: Registros, Leads (personas), Deals creados (desde
   completo / desde parcial), Agendadas, Citas, Shows, No asistió, Llamadas sin resultado, Ventas (cupos), **Vendido**,
   **Recaudado**, **Por cobrar**, **Entró a caja**, Comisión, Meta, Esperado a hoy, Faltan, Por día hábil que queda,
   Proyección. Todo el Hub, sus listas y la vista "todos" toman el rótulo de ahí.
2. **Formato único** (lo del Hub del 358): `pct`, `usd`, `cop`, `num`, `fecha`, `hora` de `lib/format.ts`; se borran
   los helpers locales del Hub.
3. **La regla del vacío** (N5) en un componente: "—" no se puede calcular (con su motivo en el tooltip), "0" es cero,
   "Sin datos" aún no hay periodo medido.
4. **Sin jerga en el Hub** (lo del Hub del 359): se quita "Lo que viene" de Hoy; las notas de Dinero pasan a tooltip
   del "—"; Origen gana la tarjeta "Calidad del rastreo" y la tabla de plantillas se va a Ajustes › Salud (developer).
5. **Un guardián, no tres** (3-nov, sin sobrediseño): ninguna cadena visible en `app/(app)/hub/`,
   `app/(app)/p/[programa]/hub/` ni `components/dashboard/` contiene `Monto`, `Contratado`, `utm_`, `macro`, `periodo A`
   ni `periodo B`. Mordido en los dos sentidos. Los guardianes de rótulo literal y de helper local quedan en el 358.

## Fuera (queda en 358 y 359, fase 2)

- Mi espacio, las listas operativas fuera del Hub, el texto de WhatsApp, el menú (DA-6) y la traducción de la calidad
  High/Mid/Low (DA-7).

## Done cuando

- [x] El guardián, mordido en los dos sentidos.
- [x] Recorrido de las cinco pestañas del Hub y "todos": ningún "Monto", "Contratado", "periodo A/B" ni `utm_` visible.
- [x] El 357 queda `reemplazado` por este ticket; el 358 y el 359 enmendados a su resto, en su archivo y en el tracker.
- [x] Regla N8: `overview.md` §11 reconciliado con el vocabulario y `docs/structure.md` §9 con la regla del vacío, en el
  mismo commit.
