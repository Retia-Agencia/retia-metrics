---
id: 185
etapa: O4
serves: "docs/anotaciones.md A-86, A-88, A-95, A-06; ADR 0077"
depends: [181, 183, 184, 186]
status: done
---

# 185 — Pantalla fija en Leads, Calls, Inbox y Students: cada sección hace su propio scroll

Sesión **S6**, ola O4 parte 2. Arranca cuando 181, 183 y 184 estén en `main` (toca las mismas pantallas). Sin
migración.

## Por qué existe

- **A-86 (Mani, 3-oct noche).** Lo del tablero de Deals (181) debería ser la regla general: la página tiene el alto de
  la ventana, nada empuja la página hacia abajo y el scroll vive dentro de cada sub-sección. Hay que decidir, pantalla
  por pantalla, si se reacomoda para que todo quepa o si una parte pasa a una sub-página o a un pop-up. Es el A-06
  ("ninguna pantalla crece en scroll infinito") hecho sistema.
- **A-88 (Mani).** En Programa, "Sin fuente principal" y "Rehacer webhook" no se entienden.

## Alcance

**Acotado por Mani (3-oct, noche):** las pantallas son **Leads, Calls, Inbox y Students**. Mani va a **reorganizar
cómo se muestra la información** en cada una, así que este ticket **no arranca con código**: arranca con la propuesta
de Mani por pantalla, y la tabla de abajo la llena la sesión con él. Mi espacio, Dashboard, la ficha del deal y Ajustes
quedan fuera (si después se quieren, es otro ticket).

1. **Primero la reorganización de Mani, después el código.** Por cada una de las cuatro pantallas, la tabla dice qué
   bloques tiene, cuál hace scroll por dentro y qué pasa a **sub-página** o a **pop-up**. La sesión central la revisa
   con Mani **antes** de codear. Students probablemente también crece sin fin (sin datos reales todavía): se mide
   con la base local sembrada.
2. **Aplicar** `components/layout/pantalla-fija.tsx` (del 181) a lo decidido. Las listas largas paginan en el
   servidor o hacen scroll dentro de su tarjeta; ningún scroll anidado sin necesidad; a 375 px se vale volver al
   scroll de página si la pantalla fija no cabe (se decide y se escribe).
3. **Programa (A-88):**
   - "Sin fuente principal" dice qué significa y qué hacer: *"Ningún formulario está marcado como principal: es el
     que se usa para generar los links de captación (ADR 0068). Edita el formulario, pega su URL pública y márcalo
     como principal."*, con el enlace a ese paso.
   - "Rehacer webhook" pasa a **"Reconectar Calendly"** con una línea: *"Vuelve a crear la suscripción de Calendly
     de este programa con el token guardado. Úsalo si las citas dejaron de llegar o si cambiaste el token."* (es
     `conectarCalendly`, `lib/calendly/suscripcion.ts`).
4. La regla queda en `docs/structure.md` §9 (cuándo pantalla fija, cuándo sub-página, cuándo pop-up).

## Decisiones (aprobadas por Mani el 4-oct)

Medido en `dev:local` (ComunicArte local: 175 leads, 77 llamadas, 17 students; 1440×900, gerente): Leads 9.518 px,
Calls 8.940 px, Inbox 5.370 px (6 secciones sin tope), Students 2.273 px (113 px por fila).

| Pantalla | Fijo arriba (`shrink-0`) | Scroll por dentro | Sub-página o pop-up |
|---|---|---|---|
| Leads | Buscador, filtro de fecha, filtros | La lista; encabezado ("Leads · N", Tarjetas/Tabla) pegado arriba y paginación pegada abajo, dentro de la tarjeta | **Posibles duplicados → sub-página**: dos pestañas, "Leads" y "Posibles duplicados (N)", en la URL (`?seccion=duplicados`), para que "Volver" (174) regrese a ella |
| Calls | Filtros | La lista, **paginada en el servidor** (50 por página, como Leads; toca `lib/queries/llamadas.ts`) | El detalle sigue en pop-up |
| Inbox | Franja de aviso "Hosts sin cuenta" (alerta, no cola) | La sección elegida | **Las secciones → pestañas con su conteo**: Sin resultado · Sin dueño · Perdidos en Calendly · Sueltas · Atención. Abre en la primera con algo, en ese orden. En la URL (`?seccion=`) |
| Students | Filtros y los 4 KPI en una franja compacta | La lista, con **filas compactas** (~56 px: saldo y vencimiento en la misma línea) | Ninguno |

**375 px:** la pantalla fija aplica desde `md` (768 px), como Deals; por debajo vuelve el scroll de página. Las
pestañas de Leads e Inbox se quedan también en móvil.

**La regla (va a `docs/structure.md` §9):** pantalla fija para toda lista o cola de trabajo; sub-página (pestaña con
URL) para una segunda lista con acciones o paginación propias; pop-up para el detalle de un registro o un formulario
corto.

## Archivos

`app/(app)/p/[programa]/leads/*`, `calls/*`, `inbox/*`, `students/*`, `components/page-shell.tsx`, `components/layout/*`,
`app/(app)/p/[programa]/programa/page.tsx` y `editar-programa.tsx`. Los componentes internos de cada pantalla solo
donde el reacomodo lo pida.

## Done cuando

- La tabla de decisiones está en el ticket y la aprobó Mani.
- Ninguna pantalla de la tabla crece con cada registro nuevo; el scroll vive en su sub-sección.
- Programa explica "Sin fuente principal" y "Reconectar Calendly".
- `npm run build` en verde; recorrido en `dev:local` de cada pantalla como closer y gerente, escritorio y 375 px,
  consola abierta, abriendo todo lo que se abre.

## Nota de cierre (S5, 4-oct)

Implementado por Codex (effort medium) y revisado contra la tabla. Medido en `dev:local` a 1440×900, como gerente y
como closer: Leads, Calls, Inbox y Students ocupan 900 px (antes 9.518, 8.940, 5.370 y 2.273) y el scroll vive en la
lista. Calls pagina de a 50 (`LLAMADAS_POR_PAGINA`, el corte se hace en la página sobre el resultado de
`llamadasDelPrograma`, que no cambió). Inbox: el gerente ve 13 · 10 · 2 · 1 · 25; la closer, 5 · 10 · 2 · 1 · 8;
"Volver" desde un deal regresa a la pestaña. Students: filas de 34 px (antes 113). A 375 px vuelve el scroll de página
y las pestañas hacen scroll horizontal en su franja. Abiertos: detalle de llamada (pop-up), selector "Asignar a" de Sin
dueño, Editar programa con "Reconectar Calendly". Consola limpia.

Arreglos de la revisión, hechos aquí: la paginación de Calls pasaba JSX del servidor al componente cliente (warning de
`key` de React); ahora pasa los enlaces ya armados, como `PosiblesDuplicados`. Las pestañas se partían en móvil.

Verificado: typecheck, lint, `tests/llamadas-programa.test.ts` (9/9), `npm run build`. No hay reglas de permiso
nuevas: las guardas de las cuatro páginas no cambiaron. "Sin fuente principal" no se pudo ver en la base local (ningún
programa sembrado está sin fuente principal); el texto se revisó en el diff.

Queda suelto: `avisoDelFormulario` (`lib/queries/ficha-programa.ts`) ya no lo usa ninguna pantalla, solo su test. No lo
borré porque no es de este ticket; se quita en la próxima limpieza.
