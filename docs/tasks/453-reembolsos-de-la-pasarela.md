---
id: 453
etapa: dinero
serves: "ADR 0133 · D4 · manual-gestion-comercial D-9"
depends: [455]
status: todo
---

# 453 — Reembolso y contracargo: una persona escoge

## Qué
Qué hace el CRM cuando Hotmart avisa un reembolso, un contracargo o una cancelación de una compra ya registrada.
Decidido (D4): el aviso no decide solo. Deja el deal con un pendiente de reembolso, visible y evidente en la ficha y
en la bandeja, con dos salidas explícitas: **anular solo el abono** (corrige captura, no cuenta) o **pasar a Cierre
Perdido** con motivo reembolso (resultado de negocio, sí cuenta; la más común). AGENTS.md › "anular-no-es-perder"
los separa, y la pantalla tiene que explicar la diferencia en el momento de escoger.

## Done cuando
- [ ] Tests con los eventos de reembolso y contracargo sobre un deal Completo y uno Parcial: ninguno cambia de etapa
      hasta que una persona escoge.
- [ ] Las dos salidas probadas en la pantalla, con clic, y forjando la petición con un rol que no puede.
