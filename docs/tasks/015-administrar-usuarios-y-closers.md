---
id: 015
fase: F0
serves: "spec §5 criterio 5; ADR 0011"
depends: [011]
status: done
---

# 015 — Administrar usuarios y closers desde /ajustes

## Objetivo
Un gerente da de alta a un closer (correo, nombre, rol, `closerId`, correo de Calendly,
programas donde vende) y ese closer empieza a contar en las métricas, sin CLI. Lo mismo para
otro gerente (Mani, 16-sep: closers **y** managers se agregan desde la UI; así se da de alta
a todos los usuarios reales al salir a producción).

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
- [x] Un closer creado desde la pantalla puede entrar y ve sus programas.
- [x] Un gerente creado desde la pantalla puede entrar y ve `/ajustes`.
- [x] Un gerente no puede quitarse a sí mismo el rol (evita quedar sin administradores).
- [x] Cada cambio de rol queda en `change_log`.

## Notas (cierre 16-sep)
- Migración `0005_*` aplicada en `production` el 16-sep (sin paso por `dev`, ver incidente en el tracker).
- Los dos primeros criterios están cubiertos por tests de guards y de membresías, no por un
  login real: probarlos en `dev` junto con el login.
- Deuda: la fila del usuario (con su `change_log`) la escribe el molde en un lote propio y las
  membresías van en un segundo lote, porque el molde no acepta escrituras extra y `neon-http` no
  tiene transacciones interactivas. Si el segundo lote falla, un closer queda creado sin
  programas: ve el sidebar pero no cuenta en ningún programa. Arreglo propuesto: que el molde
  acepte escrituras adicionales dentro de su mismo `ejecutarJuntas`.
- Deuda: un uuid de programa inexistente sale como "Error interno." en vez de 400.
- El CLI de emergencia valida con el mismo esquema, así que dar de alta un closer ahora exige al
  menos un uuid de programa: `npm run usuarios -- agregar <correo> closer "Andrea" <uuid>` (antes
  bastaba el `closer_id`). Los uuids salen de `npm run db:studio`. Un gerente no los necesita; no desactiva membresías ni escribe `change_log` (la pantalla es la vía completa).
