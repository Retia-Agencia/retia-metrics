---
id: 171
etapa: O3
serves: "docs/anotaciones.md A-63, A-70, A-71, A-72 (Recursos), A-75; ADR 0077 punto 1; enmienda ADR 0034"
depends: []
status: entregado (S4, 3-oct; lo marca done la sesión central tras el checkpoint)
---

> **3-oct (sesión central):** la migración **0062** hace nula `recursos.categoria_id` (`lib/queries/recursos.ts` ya tipa `categoriaId: string | null`). Un recurso libre se guarda sin categoría. **Aplicada en producción el 3-oct** con el ok de Mani (columna nula verificada).


# 171 — Todo lo del programa vive en la tab Programa

Sesión **S4** de la ola O3. Dos tandas **en serie** en la misma sesión: (a) puntos 1 a 3, (b) puntos 4 y 5. Sin
migración (las plataformas ya son una tabla, ADR 0034; si la tanda (b) descubre que necesita una, para y avisa).

## Por qué existe

Lo de un programa vive en cuatro lugares: la tab Programa, Ajustes → Programas, Ajustes → Fuentes, Catálogos →
Plataformas y Recursos → Enlaces de pago. Memorable quedó inactivo y sin forma de editarse (A-63:
`components/programas-admin.tsx` solo ofrece "Editar" a un programa activo, y activarlo exige formulario y token).
Las membresías (quién vende en un programa y con qué Calendly) están escondidas en Ajustes → Usuarios (A-75).

## Alcance

**Tanda (a) · el programa se administra desde su tab**

1. **Editar desde la tab (A-70).** El botón "Editar en Ajustes" se reemplaza por **"Editar"**, que abre un pop-up con
   lo de hoy en Ajustes → Programas: nombre, slug, ticket, comisión, estancado tras N días, Forms Link y Calendly
   Token (el token se escribe, nunca se muestra; las reglas del ADR 0057 siguen), y "Rehacer webhook". Solo quien
   administra (`esAdministrador`); un closer lee.
2. **Un programa inactivo se edita y se activa (A-63).** Un programa inactivo tiene su tab (para quien administra)
   con una **lista de lo que le falta para activarse** (formulario, token, fuente principal) y cada punto lleva al
   control que lo resuelve; "Activar" se habilita cuando no falta nada. El selector de programa muestra los
   inactivos solo a quien administra, marcados. Memorable se puede completar y activar sin tocar la base a mano.
   "Nuevo programa" vive en el selector de programa (para quien administra), no en Ajustes.
3. **Formularios y Equipo en la tab.** La sección **Formularios** absorbe Ajustes → Fuentes de ese programa
   (fuentes, principal, mapeo, prueba, secreto, salud de la fuente), reusando `components/admin/fuentes-admin.tsx`.
   La sección **Equipo** (A-75) muestra quién vende en el programa (las membresías), su rol y su cuenta de Calendly
   (con el componente del 169 si ya está en `main`; si no, el de hoy y se cambia al cerrar el 169), y permite
   agregar o quitar a alguien. Ajustes → Usuarios queda para crear usuarios y su rol; las casillas de programas se
   van de ahí. `/ajustes/programas`, `/ajustes/programas/<slug>` y `/ajustes/fuentes` redirigen a la tab del primer
   programa o del programa del slug (el índice de Ajustes lo limpia el 173).

**Tanda (b) · el dinero del programa y Recursos**

4. **Plataformas y links de pago en el programa (A-71, enmienda ADR 0034).** La sección **Plataformas de pago** de la
   tab: crear una plataforma nueva (nombre libre; el índice `lower(nombre)` evita duplicados entre programas: si ya
   existe, se vincula en vez de crearse), vincular o desvincular una existente, y **sus links de pago** (crear,
   editar, retirar), con una línea que dice para qué son: "los closers los copian desde Recursos para cobrar".
   Catálogos → Plataformas desaparece (el 173 quita la pestaña). Los links se siguen guardando como hoy
   (`lib/catalogo/enlaces-pago.ts`), con `change_log`.
5. **Recursos libre (A-72).** La tab Recursos muestra, por programa, los links de pago vigentes (solo lectura, copiar
   en un clic) y los **recursos libres** (brochure, guion, lo que sea): cualquiera que trabaje el programa crea,
   edita y retira los suyos ahí mismo, sin categoría (el catálogo de categorías de recurso deja de mostrarse; su
   tabla la retira el 175 con migración). Recursos adopta el componente de filtros del 170 si ya está en `main`.

## Archivos

Suyos: `app/(app)/p/[programa]/programa/*`, `lib/queries/ficha-programa.ts`, `components/programas-admin.tsx`,
`components/cohortes-admin.tsx`, `components/admin/fuentes-admin.tsx`, `app/(app)/ajustes/programas/*`,
`app/(app)/ajustes/fuentes/*`, `components/usuarios-admin.tsx` (solo quitar las casillas de programas),
`components/program-switcher.tsx`, `lib/catalogo/plataformas.ts`, `enlaces-pago.ts`, `recursos.ts`,
`lib/queries/recursos.ts`, `components/resources/*`, `app/(app)/recursos/*`.
**No toca** `app/(app)/ajustes/page.tsx` ni `catalogos-admin.tsx` (173), `lib/nav.ts` (170 en esta ola).

Tests: `tests/plataformas-programa.test.ts`, `tests/acciones-recursos.test.ts`, `tests/fuentes.test.ts`,
`tests/programas*.test.ts`, `tests/paginas.test.ts` (guardas de las secciones nuevas: un closer no edita, forjando).

## Done cuando

- Todo lo de un programa se edita desde su tab; Ajustes → Programas y Fuentes solo redirigen.
- Memorable (o un programa inactivo de prueba) se completa y se activa desde la tab, sin SQL.
- Se crea una plataforma nueva, se le pone un link y el closer lo copia desde Recursos.
- Un closer crea un recurso libre en Recursos; no edita el programa (403 forjando la acción, base sin moverse).
- `npm run build` en verde; recorrido en `dev:local` como gerente y como closer, consola abierta, escritorio y 375 px.

## Cierre 3-oct (S4: Codex implementa la tanda (a), Kiro la (b) por límite de uso de Codex; Claude revisa; rama `o3-171-programa`, sin migración)

**Qué quedó.** Tanda (a): "Editar" abre un pop-up con el formulario del programa (el slug se ve y no se cambia:
`editarPrograma` lo prohíbe a propósito); "Estancado tras N días" es editable por primera vez (`diasSinActividad` en
`esquemaPrograma`, ≥ 1). Un programa inactivo lo abre solo quien administra (`programaDeLaFichaPorSlug`) con la lista
"Le falta para activarse" (Forms Link, Calendly Token, fuente principal; `faltaParaActivar`), y "Activar"
(`activarProgramaDesdeFichaAccion`) vuelve a comprobar los tres en el servidor. "Nuevo programa" vive en el selector y
crea el programa inactivo con nombre, slug y ticket. Formularios reusa `FuentesAdmin`; Equipo agrega y quita
membresías (`agregarMembresia`/`quitarMembresia` sobre `sincronizarMembresias`: `change_log`, nunca DELETE; el gerente
no es elegible, ADR 0003) y reusa `CalendlyMembresias` tal cual. Tanda (b): Plataformas de pago en la tab
(`crearOVincularPlataforma`: un nombre ya existente se vincula en vez de duplicarse, uno desactivado da 409) con sus
links (crear, cambiar URL, retirar); Recursos queda con recursos libres sin categoría y links de solo lectura, acotado
a `programasVisibles`, y adopta `FiltroSelect` del 170.

**Fuera de la lista de archivos, mínimo y por necesidad:** `lib/auth/alcance.ts` (dos funciones nuevas),
`lib/catalogo/programas.ts` (solo el campo), `lib/catalogo/usuarios.ts` (`programas` opcional: si no viene, no se tocan
las membresías — sin eso, quitar las casillas de Usuarios dejaba al closer sin programas al editarlo, sin error; y se
quita "un closer necesita al menos un programa"), `app/(app)/layout.tsx` y `components/app-sidebar.tsx` (pasan
inactivos y `puedeCrear` al selector), `scripts/usuarios.ts` (compatibilidad), `components/resources/helpers.ts`.

**Encontrado en el camino.** (1) Recursos le mostraba a un closer los links de TODOS los programas (usaba
`programasActivos`): rompía la frontera del ADR 0048; ahora sale de `programasVisibles`. (2) El filtro de Programa de
Recursos mostraba el valor crudo `todos` (Select de Base UI sin `items`); se arregló al adoptar `FiltroSelect`.
(3) `ProgramasAdmin` quedó sin uso con la redirección y se borró; `FormularioPrograma` perdió su tarjeta (se veía
doble marco en el pop-up) y el Calendly Token dejó de ser `required` (bloqueaba guardar el Forms Link de un programa a
medias; la lista de lo que falta ya lo cubre).

**Para el 175.** Con `categoria_id` nula, el índice `recursos_vigente_idx` (`programa, categoria, lower(titulo)`) ya
no impide dos recursos libres vigentes con el mismo título en un programa (Postgres trata los NULL como distintos). Al
quitar la columna, rehacer el índice sobre `(coalesce(programa), lower(titulo))`.

**Queda igual a propósito.** "Editar" un link de pago cambia solo la URL (`reemplazarEnlacePago` de siempre): otro
monto es retirar y crear. Las plataformas y sus links los maneja también el closer del programa (ADR 0016 y 0034); las
acciones exigen membresía. `app/(app)/ajustes/catalogos/acciones.ts` conserva sus acciones de plataformas para el 173.

**Verificado.** Typecheck, lint y `npm run build` en verde tras rebasar sobre `dc9e477` (169 y 170). Tests del ticket
en local: 13 archivos, 278 en verde, más `roles`, `bitacora-jsonb` y re-corrida tras la limpieza (185). Recorrido en
`dev:local` (base local con la 0062 aplicada): como gerente se creó "Memorable Prueba" desde el selector, se completó
(Forms Link, token falso, días, comisión, fuente webhook con secreto, activa y principal) y se activó desde la tab sin
SQL; plataforma "Wompi Prueba" y su link creados en la tab; Carlos agregado al Equipo (el gerente no sale en la lista).
Como closer: sin "Editar" ni controles de Equipo; Mani Closer (sin membresía en Memorable) no ve su link en Recursos,
Carlos sí y con "Copiar"; Mani crea un recurso libre. Forjando con la cabecera `Next-Action` desde la sesión de Mani
Closer: activar, agregar al Equipo, crear plataforma y crear link en Memorable → los cuatro rechazados, y los conteos de
`miembros_programa`, `enlaces_pago`, `plataformas_pago`, `plataformas_programa` y `change_log` idénticos antes y
después. `/ajustes/programas` y `/ajustes/fuentes` redirigen (closer a su inicio, gerente a la tab `#formularios`).
375 px sin scroll horizontal, pop-up dentro de la pantalla; consola sin errores. "Copiar" no se pudo comprobar: el panel
del navegador niega el portapapeles (`writeText` directo da `NotAllowedError`); ese código no cambió.
