---
id: 164
etapa: O2
serves: "docs/anotaciones.md A-46, A-05 (decidida el 2-oct)"
depends: [163]
status: todo
---

# 164 — Mi espacio: el hub del closer

## Decisión (Mani, 2-oct)

`/mi-dia` deja de ser una pantalla vacía (ticket 038 la vació) y pasa a ser **"Mi espacio"**: la landing de cada
closer con lo que le incumbe. El **Inbox se queda como está**: es la cola compartida del programa (deals sin dueño
para reclamar, llamadas sueltas) más "lo mío que necesita atención". Resuelve la pregunta abierta de A-05.

## Alcance

1. **Perfil** arriba: sus programas con membresía activa, su cuenta de Calendly por programa (`/perfil` ya la
   edita, ADR 0074) y su rol.
2. **Selector de programa obligatorio** (el programa es frontera, AGENTS.md): todo lo de abajo es de UN programa.
3. Por programa, en tabs o secciones plegables (P-2: nada se apila):
   - **Mis deals:** las tarjetas de sus deals con los mismos filtros del Kanban (reusar el filtro, no copiarlo).
   - **Mis llamadas:** las suyas, con el detalle del 163.
   - **Mis students:** sus deals en Abonado o Completo.
   - **Pendientes:** lo de "lo mío que necesita atención" del Inbox (misma consulta, `lib/queries/inbox.ts`).
4. **Sin consultas nuevas que dupliquen respuestas**: cada sección llama la consulta que ya existe filtrada por
   dueño. Si una no admite el filtro, se le agrega el parámetro en su módulo (AGENTS.md: la respuesta vive en un
   módulo y los dos la importan).
5. La guarda: `paginaConRol("closer")` deja pasar al developer (ADR 0025). Lo que ve el developer es la unión de
   sus membresías (ADR 0028). Un closer sin membresía ve un mensaje claro ("todavía no tienes programas
   asignados"), que es el pendiente de A-04.
6. `rutaInicial` (`lib/nav.ts`): decidir si el closer entra a Mi espacio o sigue entrando al Inbox. Recomendación:
   Mi espacio, con su bloque de Pendientes arriba. `lib/nav.ts` es del dominio de Alejo: el cambio se le avisa.

## Archivos

Toca: `app/(app)/mi-dia/`, componentes nuevos, `lib/nav.ts`. Reusa el 163 y los filtros del Kanban. Los tests de
la ruta vieja (`tests/mi-dia.test.ts`, `tests/acciones-mi-dia.test.ts`, `tests/paginas.test.ts`) se revisan:
afirman la pantalla vacía.

## Done cuando

- Un closer con dos programas ve su perfil y, por programa, sus deals, llamadas, students y pendientes.
- Nada de otro closer ni de otro programa aparece (forjar el programa en la URL: 404).
- Recorrido en `dev:local` como closer y como developer, consola abierta, escritorio y 375 px.
