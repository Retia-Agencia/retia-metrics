---
id: 382
etapa: ajustes
serves: "Mani, 5-nov: el gerente siempre puede crear usuarios, y el alta es una sola pestaña · ADR 0118 (enmienda el 0094) · ADR 0077 · ADR 0025"
depends: []
status: en main
---

# 382 — Un solo alta de usuarios, abierta a todo gerente

## Por qué

Dar de alta a alguien son dos pasos en dos pantallas (`/ajustes/usuarios` crea la persona; la pestaña Equipo del
programa crea la membresía), y un gerente con alcance limitado (EstadoX) no entra a Ajustes ni puede invitar a su
gente. Las decisiones están cerradas en el **ADR 0118**; este ticket las construye. No se re-litigan.

## Qué se construye

1. **Pregunta nueva en `lib/auth/roles.ts`** (p. ej. `administraUsuarios`): la cumplen developer y todo gerente, con o
   sin alcance. `requireRole("gerente")` de las acciones de usuarios y `paginaConAdministracionGlobal` de
   `/ajustes/usuarios` pasan a usarla. Nunca `rol === "gerente"` a mano. El resto de Ajustes sigue en
   `administraGlobal`.
2. **Una sola operación de alta** en `lib/catalogo/usuarios.ts`, en una transacción: usuario + programas + Calendly por
   programa. Un selector de programas; el rol decide el efecto: closer, customer success y media escriben
   `miembros_programa`; gerente y paid trafficker escriben `usuarios_programas_alcance` (vacío = ve todos, solo lo deja
   vacío `administraGlobal`). Las tablas siguen separadas (ADR 0094).
3. **Reglas por actor** (todas en el servidor y por la fila que toca, no por el slug de la ruta):
   - Gerente limitado: los programas que asigna salen de su alcance; nadie nace viendo más que él. Crea cualquier rol
     salvo developer. Gerente y paid trafficker nacen con alcance fijo a un subconjunto del suyo.
   - Edita y desactiva usuarios cuyos programas estén **todos** dentro de su alcance. Cambiar el rol de un usuario
     existente a gerente, paid trafficker o developer es solo de `administraGlobal`.
   - El alcance de un gerente/paid lo fijan el gerente global y el developer; el limitado solo asigna subconjuntos
     del suyo y no deja a nadie sin límite. `guardarAlcanceDeUsuario` deja de exigir `esAccesoTotal`.
   - Correo existente: error "ya existe", aun si el usuario solo está en programas ajenos. No se suma a nada.
4. **Pantalla**: `/ajustes/usuarios` muestra a un gerente limitado solo los usuarios de su alcance. La pestaña Equipo
   del programa queda como vista de los mismos datos más "Agregar existente"; se retira su alta propia
   (ADR 0077: antes de agregar, quitar).
5. **Docs en el mismo commit** (N8): `docs/overview.md` (§ roles y §11), `docs/structure.md` (pantallas y quién ve qué),
   `AGENTS.md` (la pregunta nueva en "Seguridad y privacidad"), título/índice del ADR 0094 ya enmendados.

## Fuera de alcance

Cambiar el modelo de datos (no hay migración), el flujo de Calendly, el developer ("ver como") y los permisos de
Canales y Meta.

## Archivos

`lib/auth/roles.ts`, `lib/auth/guards.ts`, `lib/auth/page-guards.ts`, `lib/auth/alcance.ts`, `lib/catalogo/usuarios.ts`,
`app/(app)/ajustes/usuarios/{page,acciones}.ts(x)`, `components/usuarios-admin.tsx`,
`app/(app)/p/[programa]/programa/acciones-programa.ts` (`agregarAlProgramaAccion`, `exigirProgramaDeMembresia`),
la pestaña Equipo.

## Done cuando

- [ ] Todo gerente, con o sin alcance, abre `/ajustes/usuarios` y crea usuarios; el resto de Ajustes sigue cerrado al
      limitado (test de página).
- [ ] El alta escribe usuario, membresías o alcance y Calendly en una transacción; un fallo no deja usuario a medias.
- [ ] **Petición forjada** (server action invocada a mano) de un gerente limitado: crear un developer, asignar un
      programa fuera de su alcance, crear un gerente/paid sin alcance, ascender a un existente a gerente/paid/developer
      o editar/desactivar a alguien con programas ajenos responde 403 y la base no se mueve.
- [ ] Un limitado no ve en la lista ni en candidatos a usuarios que solo pertenecen a programas ajenos.
- [ ] Correo existente responde "ya existe" y no modifica nada.
- [ ] El developer no queda limitado aunque tenga filas (ADR 0025); un gerente global puede fijar y quitar alcance.
- [ ] Cada cambio queda en `change_log` con quién lo hizo; `quitarDelProgramaAccion` y el alta de Equipo siguen
      cubiertos.
- [ ] typecheck, lint, tests del cambio (`usuarios`, `acciones-usuarios`, `guards`, `paginas`), `npm run build` (toca
      componentes cliente); recorrido en claro, oscuro y 375 px con gerente global, gerente limitado y developer;
      Rams `quick_review` de la pantalla.
