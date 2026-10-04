---
id: 185
etapa: O4
serves: "docs/anotaciones.md A-86, A-88, A-06; ADR 0077"
depends: [181, 183, 184]
status: todo
---

# 185 — Pantalla fija en toda la app: cada sección hace su propio scroll

Sesión **S6**, ola O4 parte 2. Arranca cuando 181, 183 y 184 estén en `main` (toca las mismas pantallas). Sin
migración.

## Por qué existe

- **A-86 (Mani, 3-oct noche).** Lo del tablero de Deals (181) debería ser la regla general: la página tiene el alto de
  la ventana, nada empuja la página hacia abajo y el scroll vive dentro de cada sub-sección. Hay que decidir, pantalla
  por pantalla, si se reacomoda para que todo quepa o si una parte pasa a una sub-página o a un pop-up. Es el A-06
  ("ninguna pantalla crece en scroll infinito") hecho sistema.
- **A-88 (Mani).** En Programa, "Sin fuente principal" y "Rehacer webhook" no se entienden.

## Alcance

1. **Inventario primero, código después.** Una tabla en el ticket con cada pantalla (Leads lista y ficha, Calls,
   Inbox, Students, Programa, Mi espacio, Dashboard y su lista, ficha del deal, Ajustes) y su decisión: **cabe** (se
   reacomoda en columnas o tabs) · **sub-página** · **pop-up** · **se queda con scroll de página** (con la razón; por
   ejemplo, la ficha del deal si partirla la vuelve peor). La sesión central la revisa con Mani **antes** de codear.
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

## Archivos

Las páginas de `app/(app)/p/[programa]/*` (salvo Deals, ya hecho), `app/(app)/mi-espacio/page.tsx` solo el
contenedor, `app/(app)/ajustes/*` el contenedor, `components/page-shell.tsx`, `components/layout/*`,
`app/(app)/p/[programa]/programa/page.tsx` y `editar-programa.tsx`. Los componentes internos de cada pantalla solo
donde el reacomodo lo pida.

## Done cuando

- La tabla de decisiones está en el ticket y la aprobó Mani.
- Ninguna pantalla de la tabla crece con cada registro nuevo; el scroll vive en su sub-sección.
- Programa explica "Sin fuente principal" y "Reconectar Calendly".
- `npm run build` en verde; recorrido en `dev:local` de cada pantalla como closer y gerente, escritorio y 375 px,
  consola abierta, abriendo todo lo que se abre.
