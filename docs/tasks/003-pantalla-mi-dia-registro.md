---
id: 003
serves: "spec §4 flujo pasos 1-4; criterio 1"
status: todo
---

# 003 — Pantalla de /mi-dia: buscar persona y registrar resultado

## Objetivo
Un closer entra a `/mi-dia`, busca a la persona con la que habló, registra el resultado de la
llamada y, si cerró, la venta, todo en una sola pantalla.

## Alcance
- Dentro: reemplazar el `ProximaFase` de `app/(app)/mi-dia/page.tsx` por un buscador de personas
  (por nombre o correo, dentro del programa del closer) y un formulario con el resultado y los
  campos de venta condicionales. Agregar los componentes shadcn que falten (input, label,
  textarea, form, combobox/command).
- Fuera: no incluye el dashboard (ticket 005) ni el historial de persona (ticket 006).

## Done cuando
- [ ] El closer puede buscar y encontrar una persona ya sincronizada.
- [ ] Elegir "cerrada" muestra los campos de venta; cualquier otro resultado no.
- [ ] Al guardar, usa `registrarLlamada` del ticket 002 vía server action con
      `requireRole("closer", "gerente")`.
- [ ] El formulario se limpia y muestra confirmación tras guardar.

## Notas
Depende del ticket 002. Los componentes shadcn nuevos se agregan en este ticket, no antes
(ADR 0006).
