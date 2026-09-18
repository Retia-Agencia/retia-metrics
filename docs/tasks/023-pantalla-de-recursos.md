---
id: 023
fase: F3
serves: "spec §5 criterio 6"
depends: [022]
status: done
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
- [x] Un closer ve y copia; no ve botones de edición y la acción de servidor lo rechaza.
- [~] En celular se usa sin scroll horizontal (los closers trabajan desde el teléfono).

## Notas de cierre (17-sep)

**El filtro VA en la URL (`?programa=&q=`), al contrario que el buscador de `/mi-dia`.** La
diferencia es deliberada: en `/mi-dia` lo que se teclea es el nombre o el correo de un lead, un dato
personal que `AGENTS.md` prohíbe en query strings; el título de un brochure no lo es. Aquí gana que
el filtro sea compartible y recargable (ADR 0023). El programa viaja por **slug**, no por uuid.

**Leer lo pueden los dos roles; escribir solo el gerente.** No es como `/productos`, donde el ADR
0016 abrió la edición al closer: ese ADR es específico de productos. Las seis acciones de escritura
pasan por `requireRole("gerente")` y hay test de que un closer recibe `ok:false` en las seis, no solo
de que no ve el botón.

**Un recurso global (`programId` nulo) aparece con cualquier filtro de programa**, porque sirve para
todos. Hay test.

**El criterio de celular queda a medias, marcado `[~]`.** El marcado se construyó mobile-first (sin
tablas, sin anchos fijos, URLs con `break-all`) y se verificó por inspección del código, pero
**nadie lo ha abierto en un teléfono**. Un test no ve un layout roto. Pendiente de revisión visual.
