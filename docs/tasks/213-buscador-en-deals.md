---
id: 213
etapa: corte
serves: "Mani, 9-oct: encontrar un deal rápido"
depends: [207]
status: todo
---

# 213 — Buscador en Deals: por nombre, correo o teléfono

## Por qué existe

Leads tiene buscador; Deals no. Con más de 100 deals por programa, encontrar uno obliga a recorrer el
Kanban o la tabla. Mani: una barra de búsqueda en Deals para filtrar por nombre, correo o número.

## Alcance

- El slot `buscador` de `BarraDeLista` (`components/filtros/barra-de-lista.tsx`) en Deals, en la misma
  posición que en Leads (el 207 la fija: Buscar · Filtros · Ordenar).
- Busca en el lead del deal: nombre, correo (principal y contactos de correo) y teléfono (normalizado: sin
  espacios, sin `+`, sin el indicativo si el usuario no lo escribe). Se filtra en el servidor, dentro del
  programa (frontera, ADR 0043), y respeta los demás filtros y el orden.
- El texto va en la URL como los demás filtros, sin datos personales en la ruta: el parámetro es la búsqueda
  escrita por quien busca, igual que en Leads. Revisar que esto cumpla la regla de "ningún dato personal en
  URLs"; si no, la búsqueda vive en el estado del cliente y se manda por POST.
- Funciona en Kanban y en tabla.

## Done cuando

- [ ] Buscar por parte del nombre, por correo y por teléfono (con y sin indicativo) encuentra el deal.
- [ ] Un deal de otro programa nunca aparece.
- [ ] Tests de la consulta; recorrido en Kanban y tabla, a 390 px.
