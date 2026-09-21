---
id: 036
etapa: E1
serves: "plan v2 §6 etapa 1 · tarea E1-1 · ADR 0035, ADR 0032"
depends: []
status: todo
---

# 036 — `people` pasa a `leads`, `estado` pasa a texto, `responsable_closer_id` se va

> **Todo lo de la etapa 1 va en UNA rama y UNA migracion** (`0020`). Este ticket es el primero de
> siete (036 a 042) y **ninguno se fusiona a `main` por separado**. Ver el plan v2 §6 etapa 1.

## Objetivo

Que la tabla del lead se llame como el dominio la llama, antes de que exista un solo registro
operativo encima. Es mecanico y no agrega una sola funcion; lo que lo justifica es el momento
(ADR 0035).

## Alcance

- **Dentro:** `people` → `leads` en `lib/db/schema.ts` y en los ~39 archivos que la nombran
  (tipos, variables, consultas, rutas internas, tests).
- **Dentro:** `leads.estado` de `pgEnum` a **texto** (ADR 0032, que ya lo decidio el 19-sep). El
  enum `estadoPersonaEnum` desaparece del codigo.
- **Dentro:** `leads.responsable_closer_id` **se elimina**. Su reemplazo, `deals.owner_user_id`,
  lo crea el ticket 037.
- **Dentro:** el vocabulario visible al usuario: `/personas` y lo que diga "persona" en pantalla.
  Si el renombre de la RUTA cuesta mas de lo que aclara, se anota y se hace en la etapa 6 con el
  resto de la UI. **Lo que no se negocia es el nombre de la tabla y de los tipos.**
- **Fuera:** cualquier cambio de comportamiento. Si un test cambia de expectativa, algo se colo.
- **Fuera:** generar o aplicar la migracion. Eso es el ticket 042 y **lo hace la sesion principal**
  (AGENTS.md), nunca un subagente.

## Por que ahora, con el numero

`calls`, `sales` y `abonos` tienen **0 filas** en `production` (medido el 21-sep). Renombrar hoy
cuesta un reemplazo revisado; con 300 llamadas encima cuesta semanas y no se hace nunca.

## La trampa

Un reemplazo de texto sobre `people` toca palabras que no son la tabla (`peopleId`, comentarios,
`lead` en ingles dentro de otras frases). **Se revisa el diff archivo por archivo**, no se confia
en el contador de coincidencias. Y el diff no lleva ninguna decision escondida: un cambio de 39
archivos donde ademas hay logica nueva no lo revisa nadie de verdad.

## Done cuando

- [ ] `grep -rn "\bpeople\b" lib app components scripts tests` no devuelve nada (salvo migraciones
      viejas, que son historia y no se tocan).
- [ ] `npm test`, `npm run typecheck` y `npm run lint` limpios, **sin cambiar ninguna expectativa
      de test** salvo los nombres.
- [ ] `estadoPersonaEnum` no existe en el codigo y `leads.estado` acepta cualquier texto.
- [ ] `responsable_closer_id` no aparece en ningun archivo.

## Kiro

**Si, la parte mecanica.** El esquema y la migracion no.
