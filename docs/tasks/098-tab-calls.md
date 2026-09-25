---
id: 098
etapa: E6
serves: "ADR 0050 · propuesta 24-sep §3.5"
depends: [057, 096, 097]
status: todo
---

# 098 — La tab Calls

## Objetivo

Ver las llamadas del programa: las de hoy, las próximas, las que no tienen resultado y las **sueltas**
(sin deal, ADR 0049).

## Alcance

- **Dentro:** lista con filtros por closer, resultado y fecha; desde cada llamada se abre su deal.
- **Dentro:** pegar el Grain y elegir cómo terminó (pagó ahora · compromiso · seguimiento · próxima
  cohorte · perdido), que llama al motor de etapas.
- **Dentro:** asignar una llamada suelta a un deal.
- **Fuera:** métricas de show y cierre: son del Dashboard.

## Done cuando

- [ ] Las sueltas se ven y se asignan.
- [ ] Pegar el Grain desde aquí mueve el deal a Atendido (ticket 058).
- [ ] Recorrido visual con la consola abierta, también en celular.

## Kiro

Sí, con revisión visual.

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
