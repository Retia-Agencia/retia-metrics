---
id: 017
fase: F1
serves: "ADR 0016"
depends: [011]
status: done
---

# 017 — Productos por programa

## Objetivo
Gerentes y closers crean, editan y desactivan los productos de cada programa (programa completo,
reserva, 1:1...) para usarlos al registrar una venta.

## Alcance
- Dentro: tabla `productos` (`programId`, `nombre`, `precioLista`, `moneda`, `activo`,
  `createdAt`), índice único por (`programId`, `nombre`).
- Dentro: semilla por programa: "Programa completo" (Comunicarte USD 797, Tactical USD 1.500) y
  "Reserva de cupo" (Comunicarte USD 400).
- Dentro: `lib/catalogo/productos.ts` sobre el molde.
- Dentro: `/productos` con `paginaConRol("gerente", "closer")`; las escrituras con
  `requireRole("gerente", "closer")`. Un closer solo ve y edita productos de sus programas.
- Dentro: componente de creación en línea reutilizable por `/mi-dia` (003).
- Fuera: descuentos y becas como productos (la beca sigue siendo `sales.becaAplicada`).

## Done cuando
- [x] Un closer crea un producto y queda en `change_log` con su usuario.
- [x] Un producto desactivado no aparece al registrar, pero las ventas viejas lo siguen mostrando.
- [x] Precio validado: positivo y con moneda.

## Notas (cierre 16-sep)
- Migración `0007_*` generada, sin aplicar. Las semillas viven en `scripts/seed-datos.ts` (no en la
  migración: en una base nueva los programas no existen aún) y solo insertan lo que falta.
- "Las ventas viejas lo siguen mostrando": `productoPorId` devuelve también inactivos; la columna
  `sales.productoId` llega en 018.
- `moneda` es un tipo (`USD` | `COP`), no un catálogo.
