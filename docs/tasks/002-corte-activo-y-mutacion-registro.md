---
id: 002
serves: "spec §5 criterio 1 — el registro queda guardado con closer, corte y programa correctos"
status: todo
---

# 002 — corteActivo() y la mutación de registro nativo

## Objetivo
Existe una función que, dado un programa, devuelve su corte activo, y una función que guarda una
llamada (y su venta, si cerró) escrita por un closer autenticado.

## Alcance
- Dentro: `lib/queries/cortes.ts` con `corteActivo(programId)`; `lib/mutations/registro.ts` con
  `registrarLlamada(session, { personId, resultado, notas, venta? })` que inserta en `calls`
  (`origen="app"`, `closerId` copiado de `session.user.closerId`, `cohortId` de `corteActivo`) y,
  si `resultado === "cerrada"`, inserta también en `sales` en la misma transacción.
- Fuera: no incluye la UI (ticket 003). No incluye el enforcement de rol en la ruta que la llame;
  eso lo hace el server action/route handler que la invoque, con `requireRole`.

## Done cuando
- [ ] `corteActivo` devuelve `null` si no hay corte activo, no revienta.
- [ ] `registrarLlamada` rechaza si `session.user.closerId` es null, con mensaje claro.
- [ ] Si `resultado !== "cerrada"`, no se toca `sales`.
- [ ] Test unitario cubre: llamada sin cierre, llamada con cierre, closer sin `closerId`.

## Notas
Depende del ticket 001 (necesita `plataformaPago` en el insert de `sales`). Ver ADR 0010 y 0011.
