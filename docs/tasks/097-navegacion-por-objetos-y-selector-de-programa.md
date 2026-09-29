---
id: 097
etapa: E6
serves: "ADR 0050 · propuesta 24-sep §3.5"
depends: [094]
status: done
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

- [x] Cada rol ve sus tabs y ninguna ruta confía en que la tab esté escondida.
- [x] Cambiar de programa mantiene la tab y cambia la URL.
- [x] Recorrido haciendo clic en todo lo que se abre (menú, selector), con la consola abierta.
- [x] Probado en celular (29-sep, ver "Cierre" abajo).

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

**Recorrido en el navegador (28-sep, Alejo, sesión de developer contra producción, solo lectura):**
- `/` aterriza en `/p/comunicarte/dashboard`; el selector muestra el nombre del programa, no el slug.
- Selector: Comunicarte → Tactical cambia la URL y mantiene la tab. Desde `/ajustes` lleva al
  Dashboard del programa elegido.
- `/programas/comunicarte?rango=mes` → `/p/comunicarte/dashboard?rango=mes`, con el filtro aplicado.
- `/p/no-existe/dashboard` da 404 y el selector no nombra el slug.
- Menú de usuario: abre. "Como gerente" quita Mi día; "Como closer" (cuenta sin membresías) quita el
  selector y el Dashboard, y Tactical responde 404 (ADR 0048).
- Consola: un solo error, el de `next-themes` ("script tag while rendering React component"), que ya
  existía.
- **Celular:** la ventana no bajó a 390 px (DevTools dejó el viewport en ~110 px), así que se probó
  el **comportamiento**: el botón abre el cajón (`aria-expanded`, velo), y lo cierran Escape, el velo
  y navegar desde un link. **El aspecto a 390 px no se vio.**
- El recorrido destapó un orden de capas frágil: cajón y popups en `z-50`. El cajón bajó a `z-40`
  y el velo a `z-30`, así el selector y el menú abren siempre encima.

**Hallazgo fuera de alcance (para el 075):** los filtros del dashboard (`components/filtro-dashboard.tsx`)
muestran el valor crudo ("hoy", "todos") y no la etiqueta ("Hoy", "Todos los closers"): a su `Select`
le falta `items`, igual que al selector antes de este ticket.

**Falta para cerrar:** ver el marco a 390 px en un teléfono real o en el modo dispositivo de DevTools.

## Cierre (29-sep, Alejo): el aspecto en celular

Recorrido en producción con la sesión de developer, solo lectura. Chrome no baja una ventana de ~658 px de
ancho, así que se probó a 658 px (ya es el diseño de celular: el corte del marco es `md`, 768 px) y además con el
contenido limitado a 390 px. El marco no usa clases `sm:` (`app-sidebar.tsx`, `page-shell.tsx`), así que a 390 px
se comporta igual que a 658.

- Barra de arriba: logo y botón completos; sin scroll horizontal a 658 ni a 390 (ningún elemento pasa de 390 px).
- Cajón (~240 px): cabe en 390; selector de programa, tabs y usuario legibles.
- El selector y el menú de usuario abren ENCIMA del cajón. Cambiar de programa desde el cajón lleva de
  `/p/comunicarte/dashboard` a `/p/tactical-investor/dashboard`, mantiene la tab y cierra el cajón.
- Consola sin errores de la app.

**Para el 075 (fuera de alcance):** a 390 px la tabla "Closers" del Dashboard queda muy apretada (Show, % show,
Cierres, % cierre y Caja casi pegadas); con nombres reales de closer se va a desbordar.
