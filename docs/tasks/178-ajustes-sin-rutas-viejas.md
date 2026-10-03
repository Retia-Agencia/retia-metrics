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

## Estado y nota de cierre (S11, 3-oct) · CÓDIGO LISTO, SIN RECORRIDO NI PUSH

Implementó Kiro; Claude revisó el diff contra el "Done cuando". Rama `o3-178-rutas-viejas` (worktree `wt-178`).

**Hecho**
- Las acciones se movieron con `git mv`, sin tocar lógica ni guardas: `ajustes/programas/acciones.ts` pasó a `p/[programa]/programa/acciones-programa.ts` y `ajustes/fuentes/acciones.ts` pasó a `acciones-fuentes.ts`. `acciones.ts` (plataformas, 171) no se tocó.
- Se quitaron los `revalidatePath` a rutas muertas. `revalidarNav` perdió el parámetro `slug`, que quedó sin uso.
- Los 5 imports de componentes apuntan a la ruta nueva. Se borraron los 3 `page.tsx` viejos, que ya eran solo redirects. Un enlace guardado responde 404.
- Ningún export quedó sin llamador: los 13 de programas y cohortes y los 8 de fuentes se usan.
- `/ajustes/catalogos`: `paginaConRol("gerente")` más `esAdministrador` con 403, y se quitaron las ramas de closer. Las 3 acciones de plataformas de esa ruta exigen `requireRole("gerente")` más `esAdministrador`. Las genéricas ya exigían gerente en `lib/catalogo/operaciones.ts`.
- Tests ajustados: imports, filas de rutas borradas, `/ajustes/catalogos` pasa a la tabla exclusiva de gerente, y la aserción del índice ahora es un regex.
- `grep -rnE "ajustes/(programas|fuentes)" app components lib tests scripts` sale vacío.

**Verificado**: `npm run typecheck`, `npm run lint` y `npm run build` limpios (build con copia APFS de `node_modules`).

**Sin verificar**
- No se corrieron tests (swap 10,3 de 11,3 GB). Los deja el CI: `tests/paginas.test.ts`, `acciones-programas`, `ficha-programa`, `roles`, `bitacora-jsonb`.
- No se hizo el recorrido en `dev:local` (Docker apagado): crear, editar y activar programa, cohorte y fuente desde la tab Programa, con consola abierta.
- No se mordió la regla de permiso: un closer en `/ajustes/catalogos` debe rebotar, y forjando `crearPlataformaAccion` debe recibir 403 con la base quieta.

**Para el 175 / 177**: `compartidoConClosers` y `vinculadoAProgramas` en `lib/catalogo/registro.ts` quedan sin lector en la página. `listarItems` todavía lee el primero. La página de Motivos sigue mostrando todo el registro (plataformas, orígenes, categorías, áreas); lo que sobre lo quita el 175.
