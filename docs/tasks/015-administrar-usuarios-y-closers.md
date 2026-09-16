---
id: 015
fase: F0
serves: "spec §5 criterio 5; ADR 0011"
depends: [011]
status: todo
---

# 015 — Administrar usuarios y closers desde /ajustes

## Objetivo
Un gerente da de alta a un closer (correo, nombre, rol, `closerId`, correo de Calendly,
programas donde vende) y ese closer empieza a contar en las métricas, sin CLI.

## Alcance
- Dentro: columna `users.calendlyEmail` y tabla `miembros_programa` (`userId`, `programId`,
  `activo`), con índice único por par.
- Dentro: `lib/catalogo/usuarios.ts` sobre el molde. Un usuario se desactiva (`activo=false`),
  nunca se borra; el callback de Auth.js ya lo saca en el siguiente request.
- Dentro: `/ajustes/usuarios`, solo gerente.
- Dentro: validar que un closer tenga `closerId` y al menos un programa antes de guardarlo.
- Dentro: `npm run usuarios` sigue funcionando (es el acceso de emergencia) y pasa por el mismo
  esquema zod.
- Fuera: el rol developer (024).

## Done cuando
- [ ] Un closer creado desde la pantalla puede entrar y ve sus programas.
- [ ] Un gerente no puede quitarse a sí mismo el rol (evita quedar sin administradores).
- [ ] Cada cambio de rol queda en `change_log`.
