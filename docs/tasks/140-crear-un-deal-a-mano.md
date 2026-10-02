---
id: 140
etapa: NC1
serves: "comercial.md §9.1 (Mani, 1-oct)"
depends: []
status: done
---

# 140 — Crear un deal a mano

## Objetivo

Que un closer, gerente o developer cree un deal desde la app, como el "Add deals" de HubSpot.

## Alcance

- **Dentro:** una acción "Nuevo deal" en el Kanban y en la lista de deals: se elige un lead existente del
  programa o se crea el lead primero con el alta manual que ya existe (`lib/mutations/personas.ts`, ticket
  026). Nunca un deal suelto, sin lead.
- **Dentro:** el deal se abre por el mismo escritor que usa la ingesta (`abrirDeal`), en la etapa de entrada
  que corresponda, con dueño (quien lo crea si `trabajaLeads`), rastro y su fila de historial.
- **Dentro:** si el lead ya tiene un deal abierto en el programa, se rechaza con el enlace a ese deal (índice
  `deals_uno_abierto_por_lead_y_programa_idx`, ADR 0037): la base es la reja, el mensaje la explica.
- **Dentro:** la guarda por rol en el servidor y el programa con su alcance (ADR 0048): un closer solo en sus
  programas. Se muerde forjando la server action desde un programa ajeno.
- **Fuera:** elegir una etapa avanzada al crear (un deal a mano nace en la de entrada; lo demás lo mueve el
  motor).

## Done cuando

- [x] Crear un deal sobre un lead sin deal abierto lo deja en su etapa de entrada con rastro.
- [x] Sobre un lead con deal abierto, el mensaje enlaza al existente y la base no se mueve.
- [x] La acción forjada contra un programa sin membresía responde 404/403 y no escribe.

## Codex

Sí, esfuerzo `medium`.

## Hecho (1-oct)

- `lib/deals/crear-a-mano.ts` (`crearDealAMano`): alcance del programa (404 fuera), lead existente del programa o alta manual (`crearPersonaManual`), rechazo `DealYaAbierto` con el id del abierto (lectura previa para el mensaje; el índice sigue siendo la reja y en una carrera se relee), y el deal lo abre `abrirDeal` en `ETAPA_DE_ENTRADA` (En gestión, ADR 0071 punto 6) con quien lo crea como dueño; el dueño lo decide el motor, no este módulo.
- 🔴 Duda abierta: el ADR 0071 hace dueño a quien crea, también a un gerente, y el ADR 0003 dice que el gerente administra y no vende (`trabajaLeads`). Hoy un deal creado por un gerente queda con el gerente de dueño.
- Server action `crearDeal` en `app/(app)/p/[programa]/deals/acciones.ts`; botón "Nuevo deal" (`components/deals/nuevo-deal.tsx`) en el encabezado del tablero de Deals. "Lead nuevo" solo se ofrece a quien trabaja leads (ADR 0003).
- Tests: `tests/crear-deal-a-mano.test.ts` (14), por la acción real forjada.
