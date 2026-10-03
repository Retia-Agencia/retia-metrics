---
id: 178
etapa: O3
serves: "docs/anotaciones.md A-81; lo que el 173 dejó sin hacer (su nota de cierre, puntos 1 y 2); ADR 0077"
depends: [173]
status: todo
---

# 178 — Ajustes sin rutas viejas: las acciones de Programas y Fuentes se mudan a Programa

Sesión **S11**, ola O3 parte 3. Sin migración.

## Por qué existe

El 173 quitó Programas y Fuentes del índice de Ajustes, pero **no pudo borrar las rutas**: `program-switcher`,
`cohortes-admin`, `fuentes-admin`, `equipo-del-programa` y `editar-programa` importan las server actions de
`app/(app)/ajustes/programas/**/acciones.ts` y `app/(app)/ajustes/fuentes/acciones.ts`. Mientras vivan ahí, A-81 no está
cerrada: hay dos puertas al mismo objeto y una de ellas escondida. Y `/ajustes/catalogos` (Motivos) sigue admitiendo
closers aunque el índice les esconda la tarjeta.

## Alcance

1. **Mover las acciones** de `ajustes/programas` y `ajustes/fuentes` a la ruta de su objeto
   (`app/(app)/p/[programa]/programa/acciones*.ts`), sin cambiar su lógica ni sus guardas. Los componentes importan
   de la ruta nueva. Primero `grep` de cada export: lo que nadie llame se va.
2. **Borrar** `app/(app)/ajustes/programas/` y `app/(app)/ajustes/fuentes/` cuando nada las importe ni las enlace
   (`grep -rn "ajustes/programas\|ajustes/fuentes" app components lib`). Un enlace viejo guardado responde 404, no
   redirige: ya no existen como puerta (si Mani prefiere redirigir una semana, se decide en la revisión).
3. **Motivos solo para quien administra:** `/ajustes/catalogos` pasa a `paginaConRol("gerente")` +
   `esAdministrador` (como Áreas), y sus acciones igual. Mordida: un closer forjando la acción recibe 403 y la base no
   se mueve.
4. La tarjeta "Rarezas de la migración" se queda hasta que el 078 cierre (lo dice el 173).

## Archivos

`app/(app)/ajustes/programas/**`, `app/(app)/ajustes/fuentes/**` (se borran), `app/(app)/p/[programa]/programa/**`,
`components/program-switcher.tsx`, `components/cohortes-admin.tsx`, `components/fuentes-admin.tsx`,
`components/equipo-del-programa.tsx`, `components/editar-programa.tsx` (solo el import), `app/(app)/ajustes/catalogos/**`.
Tests que importen las rutas viejas (`grep` en `tests/`), `tests/paginas.test.ts`.

**No toca** lo que borra el 175 (Orígenes, categorías de recurso, `/urgencias`, `/documentos`, `/mi-dia`, `/perfil`).

## Done cuando

- `grep -rn "ajustes/programas\|ajustes/fuentes" app components lib tests` no encuentra nada.
- Crear, editar y activar un programa, una cohorte y una fuente funciona desde la tab Programa (recorrido en
  `dev:local` con la consola abierta, clic en cada diálogo).
- Un closer en `/ajustes/catalogos` rebota, y forjando la acción de Motivos recibe 403 con la base quieta.
- Typecheck, lint, los tests tocados y `npm run build`.
