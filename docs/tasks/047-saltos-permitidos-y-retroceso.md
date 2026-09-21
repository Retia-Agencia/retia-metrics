---
id: 047
etapa: E2
serves: "plan v2 §6 etapa 2 · tarea E2-5 · insumo §3"
depends: [045]
status: todo
---

# 047 — Los saltos permitidos y el retroceso con motivo

## Objetivo

Cerrar el motor con los casos que no son "la siguiente etapa": el cierre por chat, el retroceso y
la recuperacion de un Cierre Perdido.

## Alcance

- **Dentro:** **En Contacto → Compromiso Verbal**, el cierre por chat sin llamada. 🎯 El dashboard
  distingue "cierre con llamada" de "cierre por chat" porque **un deal sin Call es un cierre por
  chat**: no hace falta campo nuevo, y agregarlo seria una copia derivada.
- **Dentro:** un **deal manual** puede nacer en 1, 2 o 6 (ADR 0021, alta manual).
- **Dentro:** **retroceso permitido con motivo**, y queda en el historial.
- **Dentro:** **Cierre Perdido se recupera a cualquier etapa, con motivo obligatorio**. Reaplicar
  despues de un Cierre Perdido **abre un deal nuevo**, no recupera el viejo (ADR 0037): recuperar
  es para el que se cerro mal; reaplicar es un hecho nuevo.
- **Fuera:** timers. **La Re-agenda expira solo por decision del closer** (insumo §3): no hay nada
  que mande un deal a Perdido solo porque paso el tiempo.
- **Fuera:** el rojo del Kanban para compromisos vencidos. Es pintura (etapa 6), no regla.

## Done cuando

- [ ] El salto En Contacto → Compromiso Verbal pasa; los saltos no listados se rechazan.
- [ ] Un retroceso sin motivo se rechaza; con motivo pasa y deja historial.
- [ ] Recuperar un Cierre Perdido exige motivo y deja historial.
- [ ] Ningun test necesita esperar tiempo: no hay expiracion automatica que probar.

## Kiro

Si, con revision.
