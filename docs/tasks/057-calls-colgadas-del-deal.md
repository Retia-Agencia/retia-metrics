---
id: 057
etapa: E4
serves: "plan v2 §6 etapa 4 · tarea E4-1 · ADR 0015 (enmendado), insumo §2.5"
depends: [052]
status: todo
---

# 057 — Las Calls cuelgan del deal, y el sync crea la `agendada` sin fecha

## Objetivo

Reescribir el registro de llamadas sobre el modelo nuevo: una Call es de una **oportunidad**, no
de una persona.

## Alcance

- **Dentro:** `calls (deal_id, closer_user_id, fecha_programada?, fecha_llamada?, link_calendly?,
  link_grain?, resultado, motivo_id?, notas)`.
- **Dentro:** cuando el sync trae `estado = Con Calendly`, **el sistema crea la Call en `agendada`
  sin fecha** y el deal queda *Unclaimed* (ticket 052 la dispara; aqui vive su forma).
- **Dentro:** al reclamar el deal, el closer completa **link de Calendly y fecha**.
- **Dentro:** los ocho `resultado` del ADR 0015 se conservan tal cual.
- **Fuera:** Calendly por API. El PAT es **por programa** y llega despues (spec §7, cerrado el
  21-sep).
- **Fuera:** mover etapas a mano. Todo por `moverEtapa()`.

## Done cuando

- [ ] Una Call no puede existir sin deal.
- [ ] El sync crea la Call `agendada` sin fecha y el deal queda sin owner.
- [ ] Un closer reclama, pone fecha y link, y queda registrado quien lo hizo.
- [ ] Ninguna escritura de `calls` ocurre sin su fila de `change_log` (ticket 041).

## Kiro

Si.
