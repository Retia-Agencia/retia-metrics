---
id: 273
etapa: acceso
serves: "Los gerentes y el paid trafficker de AI Second Brain Jurídico ven solo ese programa y no administran lo global (ADR 0094)"
depends: [094, 173]
status: done
---

# 273 — Un gerente o un paid trafficker limitado a sus programas

## Por qué

SBJ (EstadoX) corre en el mismo CRM que Retia. Sus gerentes y su paid trafficker no deben ver los programas de Retia
ni administrar lo global. Decisión en el ADR 0094.

## Qué

1. **Migración aditiva** (la genera y aplica la sesión principal): tabla `usuarios_programas_alcance` con `user_id`
   (FK a `users`, `cascade`), `program_id` (FK a `programs`, `restrict`), `created_at` y un índice único
   `(user_id, program_id)`. Es una tabla puente: se borra de verdad y va en `TABLAS_PUENTE_BORRABLES`.
2. **`lib/auth/alcance.ts`:** `programasVisibles` para gerente y paid trafficker lee las filas del usuario. Si tiene
   filas, devuelve solo esos programas (activos); si no tiene, todos los activos, como hoy. El developer **siempre**
   todos, tenga filas o no. Closer y customer success, sin cambios (membresías). `programaDeLaFichaPorSlug` y
   `programasInactivosParaAdministrar` respetan el mismo alcance para un usuario limitado.
3. **`lib/auth/roles.ts`:** `administraGlobal({ rol, alcanceLimitado })`: `true` para el developer, y para el gerente
   o el paid trafficker sin alcance limitado. Pura y con test.
4. **Sesión:** `alcanceLimitado: boolean` en el JWT y en la sesión (`types/next-auth.d.ts`, sobre `@auth/core/jwt`),
   recalculado en `revalidarToken` en cada emisión (`lib/auth/revalidacion.ts`). Nunca del input.
5. **Guardas:** toda la página `/ajustes` y cada subpágina, sus server actions y sus route handlers exigen
   `administraGlobal`. Un usuario limitado que entra rebota a su vista, igual que cualquier ruta sin permiso. La
   navegación no le muestra Ajustes.
6. **Las 49 lecturas de `esAdministrador`:** se clasifican una por una. Las que deciden *dentro de un programa*
   (`exigirAccesoAlPrograma`, la pestaña Programa, metas, plataformas, productos, recursos, Inbox) siguen con
   `esAdministrador` pero el programa tiene que estar en `programasVisibles`. Las que deciden algo global pasan a
   `administraGlobal`. En el reporte final, la lista de las 49 con su clasificación.
7. **`/ajustes/usuarios`:** para un gerente o un paid trafficker, un selector "Programas que ve": *Todos* (sin filas) o
   *Solo estos* (multiselección de programas). Solo lo ve y lo guarda el developer (`esAccesoTotal`); la acción lo
   vuelve a comprobar en el servidor. Cada cambio deja rastro en `change_log` por el molde de `lib/catalogo/`. No
   aparece para closer, customer success ni developer.
8. **Docs:** `AGENTS.md` (la regla de alcance y la sexta pregunta, `administraGlobal`), `docs/structure.md` (quién ve
   qué) y `docs/operations.md` §2.2 (cómo se limita a un gerente de SBJ).

## Done cuando

- `tests/alcance.test.ts` (o el archivo de alcance que exista): gerente sin filas ve todos; con una fila ve solo ese;
  paid trafficker igual; developer con filas ve todos; closer sin cambios; un programa inactivo fuera del alcance no
  aparece para un administrador limitado.
- `tests/roles.test.ts`: `administraGlobal` en los cinco roles y en los dos estados.
- `tests/paginas.test.ts` y `tests/guards.test.ts`: un gerente limitado rebota de `/ajustes` y de cada subpágina, y
  recibe 404 en el programa ajeno (`/p/<slug ajeno>/...`); uno sin límite entra como hoy.
- Una server action de Ajustes invocada por un gerente limitado responde 403 y la base no se mueve. Una server action
  de un programa ajeno (crear plataforma, editar meta) se rechaza igual.
- Solo el developer puede guardar el alcance: un gerente que invoca la acción recibe 403.
- `tests/revalidacion-sesion.test.ts`: cambiar el alcance cambia `alcanceLimitado` en la próxima emisión.
- Typecheck y lint limpios; `npm run build` limpio (toca componentes cliente).
