---
id: 059
etapa: E4
serves: "plan v2 §6 etapa 4 · tarea E4-3 · ADR 0015 (se conserva), insumo §3"
depends: [057]
status: todo
---

# 059 — `no_show` y `cancelada` mandan el deal a Pendiente Re-agenda

## Objetivo

Que el resultado de una llamada fallida tenga una consecuencia automatica y visible, en vez de
dejar el deal donde estaba.

## Las reglas

- `no_show` o `cancelada` → el deal pasa a **Pendiente Re-agenda** (etapa 3), por `moverEtapa()`.
- Los dos resultados **siguen siendo distintos** (ADR 0015): aviso antes ≠ no aparecio. Que
  disparen el mismo movimiento no los fusiona.
- Crear una Call con fecha sobre un deal en Re-agenda lo devuelve a **Agendado**.
- ⚠️ **La Re-agenda expira solo por decision del closer** (insumo §3). **No hay timer** que mande
  nada a Cierre Perdido: un deal que lleva dos semanas ahi se pinta, no se cierra solo.

## Alcance

- **Dentro:** los dos movimientos automaticos y el de vuelta.
- **Dentro:** `fechaSeguimiento` se conserva en `calls` (ADR 0015) y sigue siendo el dato que
  necesitaria un recordatorio futuro.
- **Fuera:** el recordatorio. La spec §2 dice que no se envia, y sigue sin enviarse.
- **Fuera:** el color del Kanban. Es etapa 6.

## Done cuando

- [ ] Los dos resultados mueven a Re-agenda con su fila de historial.
- [ ] Una Call nueva con fecha sobre un deal en Re-agenda lo devuelve a Agendado.
- [ ] Ningun test necesita esperar tiempo: no hay expiracion que probar.

## Kiro

Si.
