---
id: 186
etapa: O4
serves: "docs/anotaciones.md A-93, A-94; ADR 0035, 0060, 0075"
depends: [184]
status: todo
---

# 186 — Los posibles duplicados: cada closer decide solo los de sus deals, y la lista no crece sin fin

Sesión **S7**, ola O4 parte 2. Sin migración.

## Por qué existe

Mani recorriendo el 183 y el 184 (3-oct, noche):

- **A-93.** La lista de posibles duplicados (Mi espacio y Leads) es un scroll infinito: en producción hay **73** sin
  decidir y la lista los pinta todos.
- **A-94.** Un closer solo debe poder decidir los posibles duplicados de **sus** deals. Hoy decide cualquiera que
  trabaje el programa (`exigirAccesoAlPrograma` en `lib/ingesta/separar.ts`, ADR 0060), y Mi espacio le muestra los
  del programa entero (`components/mi-espacio/tab-atencion.tsx` lo dice en un comentario:
  *"PosibleDuplicado no trae dueño ni deal"*). Es la misma regla del ADR 0075 ("el closer ve solo sus deals"),
  aplicada a la identidad del lead.

## Decisiones (sesión central, 3-oct noche)

1. **Quién decide** un posible duplicado (confirmar o separar): **el dueño del deal abierto del lead**, o quien
   administra (`esAdministrador`). Si el lead no tiene deal abierto o su deal no tiene dueño, decide solo quien
   administra (el closer primero reclama el deal en el Inbox). La regla vive en **una función** (en `lib/deals/permiso.ts`
   junto a `puedeTrabajarDeal`, o en `lib/auth/roles.ts` si no hay deal de por medio) y la usan `confirmarCorreo`,
   `separarCorreo`, la ficha del deal y las listas. **Se enforza en el servidor**: un closer que forja la acción sobre
   el duplicado de un deal ajeno recibe 403 y la base no se mueve.
2. **Qué ve cada uno:** el closer ve en Mi espacio y en Leads **solo los duplicados de sus deals**; quien administra
   ve los del programa. `PosibleDuplicado` gana el dueño del deal del lead (campo opcional, el contrato del 184 con el
   183 se respeta).
3. **La lista no crece:** paginada en el servidor (25 por página, como Leads), con el total arriba ("73 posibles
   duplicados") y dentro de su tarjeta. En Mi espacio, las 5 más recientes y un enlace "Ver todos" a Leads filtrado
   por posible duplicado.

## Archivos (suyos)

`lib/ingesta/separar.ts`, `lib/queries/leads.ts` (`posiblesDuplicadosDelPrograma`), `lib/deals/permiso.ts`,
`components/leads/posibles-duplicados.tsx`, `components/mi-espacio/tab-atencion.tsx`,
`app/(app)/p/[programa]/leads/page.tsx` (solo la lista de duplicados), `components/deals/ficha/ficha-alertas.tsx` (el
botón solo para quien puede decidir).

Tests: `tests/separar-correo.test.ts` (dueño decide; closer ajeno 403 sin mover la base; sin deal o sin dueño, solo
administra), la lista del closer trae solo lo suyo, paginación (25 y la segunda página).

## Done cuando

- Un closer solo ve y decide los posibles duplicados de sus deals; forjar la acción sobre uno ajeno da 403 sin escribir.
- Quien administra ve y decide los del programa.
- La lista pagina de a 25 en Leads y muestra 5 en Mi espacio con "Ver todos".
- `npm run build` en verde; recorrido en `dev:local` como closer y gerente, consola abierta.
