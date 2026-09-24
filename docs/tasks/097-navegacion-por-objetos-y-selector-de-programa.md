---
id: 097
etapa: E6
serves: "ADR 0050 · propuesta 24-sep §3.5"
depends: [094]
status: todo
---

# 097 — La navegación por objetos y el selector de programa

## Objetivo

Reemplazar la barra de hoy (Mi día, un ítem por programa, Personas, Productos, Recursos, Ajustes, Nerd
Stats) por **tabs por objeto** y un **selector de programa** arriba.

## Las tabs (ADR 0050)

Inbox · Dashboard · Leads · Deals · Calls · Students · Campañas · Programs · Products · Resources ·
Ajustes · Nerd Stats (solo developer). Cuáles ve cada rol: matriz en el documento del 24-sep §3.5.

## Alcance

- **Dentro:** `lib/nav.ts` y el marco (`components/app-sidebar.tsx`), con el sistema "Tinta"
  (`docs/design-system.md`).
- **Dentro:** el selector ofrece solo los programas visibles (ticket 094) y el programa elegido vive
  en la URL, nunca en la sesión (ADR 0023).
- **Dentro:** `rutaInicial`: el closer aterriza en Inbox; gerente y developer, en Dashboard.
- **Dentro:** redirecciones desde las rutas viejas (`/mi-dia`, `/programas/[slug]`, `/personas`).
- **Fuera:** el contenido de cada tab (tickets 069 a 074, 095, 098 a 100).

## Done cuando

- [ ] Cada rol ve sus tabs y ninguna ruta confía en que la tab esté escondida.
- [ ] Cambiar de programa mantiene la tab y cambia la URL.
- [ ] Recorrido haciendo clic en todo lo que se abre (menú, selector), con la consola abierta.
- [ ] Probado en celular.

## Kiro

Sí, con revisión visual obligatoria.
