---
id: 196
etapa: O6
serves: "docs/anotaciones.md A-100; A-06, A-86; ticket 174"
depends: [185]
status: todo
---

# 196 — Las pantallas de Ajustes: pantalla fija y "← Ajustes"

Sesión **P4**, frente de pantallas de la ola O6. **No depende del 193**: arranca ya. Sin migración.

## Por qué existe

**A-100 (Mani, 4-oct).** Cada pantalla que se abre desde una tarjeta de Ajustes crece en scroll de página, y ninguna
tiene cómo volver a Ajustes.

## Alcance

Las pantallas son las de `app/(app)/ajustes/*`: **usuarios, canales, catálogos (motivos), áreas, salud (Webhook
Health) y migración**.

1. **Volver.** Cada una pasa `volver={{ porDefecto: { href: "/ajustes", etiqueta: "Ajustes" } }}` a `PageShell`. Es
   la pieza del 174 que ya usan las fichas ("← Deals"); no se crea un breadcrumb nuevo. Si alguna se abre también desde
   otro lugar, recibe `desde` como en el 174.
2. **Pantalla fija** (`PageShell fija` + `PantallaFija`): lo de arriba fijo (texto de ayuda, formulario de crear,
   filtros) y la lista con scroll por dentro. Medir primero cada una en `dev:local`: la que no crece (por ejemplo una
   de pocas filas fijas) se deja como está y se dice en la nota de cierre.
3. **Los formularios que hoy viven debajo de la lista** y se alcanzan con `scrollIntoView` (Canales, Estados de
   llegada, ticket 117) no pueden quedar fuera de la vista: pasan arriba de la lista o a un diálogo, lo que sea más
   chico. Si la pantalla pasa a fija, el `scroll-mt-28` deja de servir.
4. Sin cambio de permisos (estas pantallas son de quien administra, `paginaConRol`).

## Archivos

`app/(app)/ajustes/{usuarios,canales,catalogos,areas,salud,migracion}/page.tsx` y `components/admin/*` solo donde el
reacomodo lo pida.

## Done cuando

- Las seis tienen "← Ajustes" y ninguna crece con sus filas desde `md`.
- Typecheck, lint, `npm run build` (`components/admin/` tiene clientes).
- Recorrido en `dev:local` como gerente y developer, escritorio y 375 px, consola abierta: en cada pantalla, crear,
  editar y desactivar una fila, y abrir cada select y diálogo. Un closer sigue recibiendo la negativa de siempre.
