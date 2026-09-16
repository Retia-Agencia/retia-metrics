---
id: 023
fase: F3
serves: "spec §5 criterio 6"
depends: [022]
status: todo
---

# 023 — Pantalla de Recursos

## Objetivo
Cualquier usuario encuentra el brochure o el link de pago vigente en segundos y lo copia en un
clic; un gerente los administra.

## Alcance
- Dentro: `/recursos` reemplaza a `/documentos` (redirección permanente) y el ítem del sidebar
  pasa a llamarse "Recursos".
- Dentro: filtro por programa (incluye "Todos") y búsqueda por título; enlaces de pago agrupados
  por programa y producto, con monto, moneda y plataforma visibles.
- Dentro: botón copiar y abrir; historial desplegable de versiones anteriores.
- Dentro: crear, reemplazar y desactivar, solo gerente (supuesto en `docs/spec.md` §7).
- Fuera: subir archivos (ADR 0017).

## Done cuando
- [ ] Un closer ve y copia; no ve botones de edición y la acción de servidor lo rechaza.
- [ ] En celular se usa sin scroll horizontal (los closers trabajan desde el teléfono).
