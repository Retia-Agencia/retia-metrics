---
id: 097
etapa: E6
serves: "ADR 0050 · propuesta 24-sep §3.5"
depends: [094]
status: en curso
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

---

## Avance 28-sep (Alejo)

**Decisiones (Alejo, 28-sep):**
- El programa va como **segmento de ruta**: `/p/<programa>/<tab>`. El Dashboard de "todos los
  programas" (095) será `/dashboard`, sin segmento; Ajustes y Nerd Stats no tienen programa.
- **Solo se muestran las tabs que ya tienen pantalla.** Cada ticket que construye una tab la agrega a
  `TABS_DE_PROGRAMA` y a la nav (`lib/nav.ts`). Así producción no enseña pantallas vacías.

**Hecho:**
- `lib/nav.ts`: `navParaRol(rol, programa)` recibe el programa elegido y ya no lleva un ítem por
  programa. Funciones puras nuevas: `rutaDePrograma`, `programaDeRuta` y `rutaAlCambiarDePrograma`
  (mantiene la tab; suelta el id y la query, que son del programa anterior).
- El dashboard pasó de `/programas/[slug]` a `/p/[programa]/dashboard`. La ruta vieja redirige con la
  query intacta, y `/p/[programa]` a secas lleva a la tab por defecto. El 404 de un programa ajeno lo
  sigue dando la página (`programaVisiblePorSlug`).
- El marco (`components/app-sidebar.tsx`): el selector de programa arriba (`ProgramSwitcher`, con
  `items` para que el trigger muestre el nombre y no el slug) y las tabs abajo. **En celular es un
  cajón**: barra arriba con botón, velo detrás (token nuevo `--velo`, claro y oscuro) y se cierra al
  navegar o con Escape. `PageShell` deja de ser `sticky` en móvil, para no quedar debajo de esa barra.
- `rutaInicial`: gerente y developer aterrizan en `/p/<primero>/dashboard`.
- Tests: `tests/roles.test.ts` (nav y funciones puras) y `tests/paginas.test.ts` (ruta nueva y
  redirecciones). Suite completa (1.156), lint y build limpios.

**Desviaciones del ticket:**
- **El closer sigue aterrizando en Mi día**, y Mi día sigue en la barra: el Inbox (071) no existe.
  Redirigir `/mi-dia` a una pantalla que no existe dejaría al closer sin pantalla de inicio.
- **`/personas` no redirige todavía:** busca en todos los programas visibles, y la tab Leads, que es
  de un programa, es el 072.
- **Productos y Recursos siguen fuera del segmento de programa:** hoy muestran la unión de los
  programas visibles, y cambiar eso es cambiar su contenido (fuera de alcance).

**Falta para cerrar:** el recorrido en el navegador (abrir el selector y cambiar de programa, el menú
de usuario, el cajón en celular, con la consola abierta) y verlo en celular.
