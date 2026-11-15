---
id: 432
etapa: configuracion
serves: "Mani, 14-nov: la ficha tiene cinco pestañas y las integraciones partidas · ADR 0132 punto 4 · docs/onboarding-de-programa.md F4 y F5"
depends: [430]
status: en main
---

# 432 — La ficha de un programa activo en tres pestañas

## Qué
- Programa (datos, destinos, equipo y los pendientes recomendados del 430), Ventas (sin cambios), Integraciones
  (formularios y secretos, Calendly, Meta, Meta CAPI, Typeform, Dapta, reporte por WhatsApp).
- La tarjeta "Fuera de esta pestaña" se borra. `?seccion=general|equipo` → `programa`; `captacion` → `integraciones`.
- `presentacionDeLaFicha`: configura → `programa, ventas, integraciones`; si no → `programa, ventas`.

## Done cuando
- [ ] Mapa de secciones viejas con test; `tests/paginas.test.ts` actualizado.
- [ ] Typecheck, lint, tests del cambio y build en verde; recorrido visual en claro, oscuro y 375 px.
- [ ] Tracker y `status:` iguales (N9).
