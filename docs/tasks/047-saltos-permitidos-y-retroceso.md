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

---

## 🟡 Propuesta 2026-09-24: retrocesos y recuperación explícitos

- Retrocesos permitidos, con motivo: 6 → 5 (el sí se cae pero sigue interesado), y los que hace el
  sistema al anular un abono (7 → etapa previa, 8 → 7). Nada más.
- Recuperar un Cierre Perdido: **solo hacia 2, 4 o 9**. De 5 a 8 se entra por un evento (Grain, abono),
  no a mano.
- Pago completo de una vez: 5 → 8 y 6 → 8 (y 2 → 7 u 8 por chat), sin inventar un paso por Compromiso
  de cero minutos.
Detalle en `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md` §2.5.

---

## ✅ Decisión 2026-09-24 (Mani, se valida con los closers): Seguimiento y "un deal, muchas llamadas"

- **Seguimiento es una etapa propia (la 11)**, después de Atendido: la llamada ocurrió y hay que volver a
  contactarlo. Separa lo que salió bien (Compromiso, pago) de lo que hay que re-contactar. Reemplaza la
  propuesta anterior de "quedarse en Atendido con fecha". El `pgEnum` gana un valor (migración de la
  sesión principal). El número no es el orden: va después de Atendido.
- **Un deal tiene muchas llamadas y nunca se duplica.** Si una llamada falla (no-show, cancelada, u
  otra llamada necesaria), el deal pasa a Re-agenda **con motivo** (5 → 3 incluido). Una llamada nueva
  de un lead con deal abierto **se agrega y se avisa al dueño**; en 1, 2, 3, 9 u 11 el deal pasa a
  Agendado, en 5, 6 o 7 la etapa no cambia.
- **La conversión cuenta deals distintos** que llegaron a una etapa, no entradas: el ir y volver no infla.
- Transiciones nuevas: T24 (5 → 11), T25 (11 → 6), T26 (11 → 7 u 8), T27 (11 → 4), T28 (11 → 9), T29
  (5 → 3 con motivo); T11 queda reemplazada y T15 pasa a 6 → 11. Perdido llega también desde 11. Tabla
  completa en `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md` §2.5 y §2.6.
- **Reemplaza** lo dicho antes en este documento sobre "la segunda llamada no hace retroceder".
