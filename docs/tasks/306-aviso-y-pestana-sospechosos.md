---
id: 306
etapa: envios-falsos
serves: "ADR 0105 puntos 1 y 4"
depends: [304]
status: todo
---

# 306 — El aviso de Sospechoso, la pestaña en Inbox y "Es real"

## Por qué

El deal sospechoso no se esconde: sigue en su etapa y en la lista del closer, con un aviso que dice por qué (ADR 0105
punto 1). Lo resuelve quien hoy puede anular el deal (punto 4).

## Alcance

1. Aviso en la tarjeta del kanban y en la ficha del deal: "Sospechoso" con sus razones (de las reglas y de la IA), con
   `<Badge variant>` del sistema Tinta (`docs/structure.md` §9). Un deal sin revisar por IA lo dice.
2. Pestaña **Sospechosos** en Inbox: los deals sospechosos sin resolver **y las llamadas sueltas sospechosas** del
   programa (ADR 0105 punto 7), las dos con sus razones, con el selector de programa
   obligatorio.
3. Botón **"Es real"**: guarda la resolución en el veredicto (304), con rastro, y el aviso se va. Permiso
   `puedeTrabajarDeal`; el servidor lo exige.
4. El botón "Anular por envío falso" aparece al lado, deshabilitado hasta el 307 (o el 307 lo agrega).

## Done cuando

- [ ] Recorrido en `dev:local` con el troll sembrado: el aviso sale en el kanban, la ficha e Inbox, y "Es real" lo
  quita. `npm run test:humo` sin errores.
- [ ] Forjando la server action desde un closer que no es el dueño: 403 y la base sin moverse.
- [ ] typecheck, lint, `tests/paginas.test.ts` y `npm run build` (toca componentes cliente).
