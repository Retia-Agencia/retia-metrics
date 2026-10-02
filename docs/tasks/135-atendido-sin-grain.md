---
id: 135
etapa: NC1
serves: "ADR 0066 · comercial.md R-2, GC-20"
depends: []
status: done
---

# 135 — Atendido sin Grain: se acepta, cuenta como show y se ve en rojo

## Objetivo

Que el closer pueda pasar un deal a Atendido sin pegar el Grain, y que Gerencia vea cuántos shows no tienen
grabación.

## Alcance

- **Dentro:** una flecha manual a Atendido (desde Agendado y desde Re-agenda: las de T10 y T7) que mueve el
  closer dueño, gerente o developer por `moverEtapa()`. Requisito: una llamada vigente con fecha. En la misma
  transacción esa llamada queda `resultado = show` (y `fecha_llamada` si estaba vacía), con rastro. Las
  flechas de sistema de pegar el Grain (058) siguen igual.
- **Dentro:** la pregunta derivada "¿esta llamada es atendida sin Grain?" en UN módulo
  (`lib/deals/` o `lib/queries/`): resultado en `RESULTADOS_QUE_OCURRIERON` y `link_grain` vacío, vigente.
  La usan la ficha, el Kanban, el 128 y el dashboard. **Nada se guarda.**
- **Dentro:** la cifra del dashboard: *"N de M shows sin Grain (X%)"* por programa y periodo, al lado del
  show-up. Con su lista cuando exista el 137.
- **Dentro:** actualizar `structure.md` §3 (tabla de transiciones: la flecha nueva y el requisito de T7/T10).
- **Fuera:** el bloque de alertas de la ficha (128 lo pinta con esta función).

## Done cuando

- [x] Mover a Atendido sin Grain deja el deal en Atendido y la llamada en show; el show-up la cuenta.
- [x] Esa llamada aparece en "sin Grain"; al pegarle el Grain desaparece sin tocar nada más.
- [x] El "sucedió sin grabar" también cuenta como sin Grain (test).
- [x] Sin llamada vigente, la flecha se rechaza con un mensaje claro.

## Codex

Sí, esfuerzo `medium`.
