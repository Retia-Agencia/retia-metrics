---
id: 225
etapa: O8
serves: "A-129"
depends: []
status: review
---

# 225 — Deals filtra por fecha de llamada y de próximo contacto

## Por qué existe

En la reunión no se podían ver "las citas de ayer": el filtro de fecha de Deals solo tiene "Creado".

## Alcance

- `app/(app)/p/[programa]/deals/page.tsx` (`CAMPOS_DE_FECHA`) y la consulta del Kanban (`lib/queries/kanban.ts`):
  - **Llamada**: deals con al menos una llamada vigente (`vigente(calls)`) cuya fecha cae en el rango (Bogotá).
  - **Próximo contacto**: `deals.fecha_seguimiento` en el rango.
- Mismo selector de periodo (`FiltroFechaLista`, ADR 0067), mismos chips de filtro activo (207). Dentro del
  programa y combinable con los demás filtros y el buscador (213).
- Sin subconsultas correlacionadas en plantillas `sql` (AGENTS.md): agrupar aparte o `inArray`.

## Done cuando

- [ ] "Llamada · ayer" muestra los deals con cita ayer, incluidas las de no-show, y no las anuladas (test).
- [ ] "Próximo contacto · esta semana" muestra los seguimientos de la semana (test).
- [ ] Un deal de otro programa nunca aparece.
- [ ] Recorrido en el Kanban, 390 px.
