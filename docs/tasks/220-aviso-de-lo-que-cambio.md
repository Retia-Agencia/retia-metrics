---
id: 220
etapa: O8
serves: "A-124; ADR 0081 punto 8"
depends: [217, 219]
status: done
---

# 220 — El aviso de lo que cambió

## Por qué existe

Pegar el Grain pasa el deal a Atendido y nadie lo nota. Mani: *"un pop-up que solo lo cierran y ya"*.

## Alcance

- Toda server action de Mover y Anotar devuelve un **resumen de lo que cambió**, armado en el servidor desde lo
  que el motor escribió (`MovimientoHecho`) y no desde lo que se pidió: etapa nueva, pendiente puesto o quitado
  con su fecha, llamada creada, abono registrado. Una función, `resumenDelCambio`, en `lib/deals/`.
- El cliente lo muestra con `sonner` (`components/ui/sonner.tsx`, ya instalado), en la esquina, **sin cierre
  automático** (`duration: Infinity`) y con X. Texto en español del negocio: "El deal pasó a Atendido", "Quedó en
  Seguimiento hasta el 12-oct", "Se creó la llamada del 14-oct, 3:00 p. m.".
- Si no cambió nada visible (solo un comentario), el aviso dice "Anotación guardada".
- Sin tiempo real: lo que cambia por fuera (Calendly) llega a Notificaciones (222).

## Done cuando

- [ ] Show + Grain muestra "El deal pasó a Atendido" y se queda hasta cerrarlo.
- [ ] Test de `resumenDelCambio` por caso (etapa, pendiente, llamada, abono, solo nota).
- [ ] Recorrido: el aviso no tapa el diálogo ni los botones en 390 px.
