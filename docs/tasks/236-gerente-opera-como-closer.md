---
id: 236
etapa: roles
serves: "Michael, 12-oct: un gerente con facultades de closer full, sin perder las de gerente (ADR 0084)"
depends: []
status: todo
---

# 236 — Un gerente puede operar como closer

## Por qué existe

Michael (gerente) toma deals cuando una closer tiene un problema. "El deal es de quien lo cierre" y cobra comisión.
Hoy `trabajaLeads(rol)` lo frena: 403 al marcar Show, al registrar un abono ("Pagó ahora"), y no puede ser dueño.
Decisión en el ADR 0084.

## Qué se construye

- Columna `users.opera_como_closer` (migración 0077, ya generada y revisada por la sesión principal).
- `trabajaLeads({ rol, operaComoCloser })` en `lib/auth/roles.ts`; todo llamador lo pasa.
- La sesión y los actores llevan `operaComoCloser` (de `revalidarToken`).
- Switch en `/ajustes/usuarios`, por el molde de catálogo, con `change_log`.
- Nav y Mi espacio: quien administra y trabaja leads ve Mi espacio con las secciones de closer y además "Por decidir".

## Done cuando

- Un gerente con la capacidad registra llamadas y abonos, aparece en `duenosPosibles` con membresía activa y su
  comisión sale por los deals de los que es dueño. Sin la capacidad, todo sigue como hoy (403).
- Apagar la capacidad lo saca en la siguiente emisión del token.
- Tests: `tests/roles.test.ts` (la tabla de la verdad con y sin la capacidad), permiso de llamada y abono para un
  gerente con y sin la capacidad, `duenosPosibles`, el switch con su `change_log`, y nav/secciones.
- Typecheck, lint y los tests del cambio limpios; `npm run build` (toca componentes cliente).

## Después (sesión principal, con el ok de Mani)

Aplicar la 0077 en producción, prender la capacidad a Michael, cargarle `closer_id` y membresía en ComunicArte y
Tactical.
