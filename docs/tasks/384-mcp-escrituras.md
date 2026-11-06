---
id: 384
etapa: mcp
serves: "ADR 0119 punto 8: toda escritura se muestra antes y se confirma en el chat · ADR 0042 (rastro) · ADR 0117 (deshacer)"
depends: [348]
status: todo
---

# 384 — El MCP del CRM: escrituras con vista previa y confirmación en el chat

> **Para una sesión sin contexto.** Lee el **ADR 0119** y el ticket **348** antes. Este ticket le da al MCP la
> capacidad de **cambiar** el CRM: mover deals, registrar resultados, anotar. Es la parte con más riesgo de todo el
> proyecto, porque un error aquí se ve igual que un cambio correcto y **no lanza ningún error**. Puede arrancar con el
> 348 terminado (los developers lo prueban por token personal); los closers lo usan cuando el 383 también esté.

## La regla fundamental (Mani, 6-nov, punto 8 del ADR)

> "Se confía en el cliente, pero es regla que TODA escritura pide confirmación y antes de eso muestra los datos que se
> van a cambiar. La idea es que puedan hacer todo desde aquí sin fricción, pero de manera estructurada, visible y
> ordenada, sin romper el funcionamiento. En caso de necesitar, siempre se podrá deshacer."

Lo que ve la persona en el chat, siempre:

> **Claude:** Voy a mover estos 3 deals de Agendado a Cierre perdido (motivo: no contesta): Ana Pérez, Luis Gómez,
> Marta Ruiz. ¿Confirmo?
> **Closer:** sí
> **Claude:** Listo, los 3 quedaron en Cierre perdido. Si quieres deshacerlo, dímelo.

**Nunca sale del agente**: nada de códigos que la persona tenga que copiar, ni enlaces para confirmar en otra parte.

## Cómo se garantiza (el molde de dos llamadas)

El servidor impone la regla; no depende de que el modelo se porte bien.

1. **`preparar_<accion>`** recibe lo que se quiere hacer, **no escribe nada**, y devuelve:
   - la vista previa legible, renglón por renglón: qué deal (nombre y enlace), qué campo, **antes → después**, y qué
     renglones **no se podrán aplicar y por qué** (la flecha no existe, falta el motivo, el deal es de otro closer);
   - un **id de confirmación** interno, de un solo uso, que vence en **10 minutos**;
   - en la descripción de la herramienta, la instrucción explícita al modelo: muéstrale la vista previa a la persona y
     llama `confirmar` solo si dice que sí.
2. **`confirmar_cambio`** recibe solo ese id. Vuelve a cargar lo preparado, **comprueba que cada deal siga igual que
   cuando se preparó** (huella: `deals.updated_at` u otro marcador que de verdad cambie con cada escritura; verifica
   cuál, y si `updated_at` no se toca en todas las escrituras, ese es el primer bug a arreglar), aplica y marca el id
   como usado. Si algo cambió (otro closer movió el deal), ese renglón se rechaza con "cambió desde la vista previa,
   vuelve a prepararlo" y el resto sigue.
3. La respuesta de `confirmar` dice qué quedó, qué no y por qué, y **cómo deshacer** cada cambio.

**Tabla `mcp_confirmaciones`**: `id`, `token_id`, `user_id`, `herramienta`, `argumentos` (jsonb canónico), `vista_previa`
(jsonb), `huellas` (jsonb: deal → marcador), `creado_en`, `vence_en`, `usado_en`, `resultado` (jsonb). Es también el
registro de qué se le mostró a quién antes de cada cambio.

**Lotes:** permitidos, hasta **50 deals por preparación**. Con más, `preparar` responde "son N: divídelo en tandas de 50"
sin preparar nada (no es un error duro, es una instrucción al modelo). Al confirmar, **cada deal se aplica en su propia
transacción** (cada uno con su rastro y su deshacer): una flecha rechazada en un deal no bloquea los otros 49, y la vista
previa ya avisó cuáles no iban a pasar. Nada se reintenta solo.

**Cliente:** `confirmar_cambio` lleva `destructiveHint: true` para que Claude y ChatGPT pidan aprobación con su propia
interfaz; `preparar_*` lleva `readOnlyHint: true` (no escribe).

## Antes de empezar, lee

1. `docs/adr/0119-el-mcp-del-crm.md`, `docs/tasks/348-mcp-del-crm.md`.
2. ADR 0037 (el deal y sus etapas), `docs/structure.md` "el motor de etapas y su tabla de transiciones", ADR 0042
   (rastro), ADR 0117 (deshacer con motivo opcional), ADR 0038 (anular no es Cierre perdido).
3. `lib/deals/mover-etapa.ts` entero: **`moverEtapa` es el único camino para escribir `deals.etapa`** y
   **`revisarMovimiento`** (línea ~1142) ya es una vista previa pura que usa la app antes de mover: la del MCP sale de
   ahí, no de una regla nueva.
4. `app/(app)/p/[programa]/deals/acciones.ts` y `app/(app)/p/[programa]/deals/[id]/acciones.ts`: cada server action es
   la referencia de qué hace la app al escribir.

## 🩸 La regla de oro: la herramienta y la server action llaman lo mismo

Cada server action hace tres cosas: arma el actor desde la sesión, llama una función de `lib/deals/` y a veces hace algo
más (otra validación, un efecto, un `revalidatePath`). Si la herramienta llama la función de `lib/` pero no hace "lo
más", el MCP escribe distinto que la app **sin un solo error**. Por cada escritura:

1. Lee su server action línea por línea.
2. Si hace algo además de llamar `lib/` (salvo `revalidatePath`/`router.refresh`, que son de pantalla), **muévelo a la
   función de `lib/`** (o a una función de caso de uso nueva en `lib/deals/`) que importen la acción y la herramienta.
   Con su test, y la acción queda como antes por fuera.
3. Recién entonces escribe `preparar_` y la herramienta que aplica.

## El origen `mcp` en el rastro

Hoy `lib/crm/rastro.ts` escribe `origen: "app"` fijo (líneas ~149 y ~271) y el enum `origen_cambio`
(`lib/db/schema.ts:181`) tiene `sync`, `app`, `upload`, `whatsapp`. Hay que:

- sumar `mcp` al enum (migración);
- llevar el origen **explícito** desde el actor hasta `Contexto` de `rastro.ts` (campo opcional, por defecto `app`),
  para que toda función de `lib/deals/` lo herede sin tocar su lógica. Explícito y no implícito (AsyncLocalStorage o
  global) porque un guardián lo puede leer y un test lo puede morder;
- test: una escritura por el MCP deja `origen = 'mcp'`, la misma por la app deja `app`.

## Qué herramientas (por olas)

Cada una es un par `preparar_` + la aplicación dentro de `confirmar_cambio`. La capacidad sale de `roles.ts`; el permiso
fino lo vuelve a decidir `lib/` (`puedeTrabajarDeal` en `lib/deals/permiso.ts`, la reja del motor en
`mover-etapa.ts:903`). Verifica cada firma antes de usarla.

**Ola 1, el pipeline del closer** (lo que más tiempo ahorra):

| Acción | Función de `lib/` | Server action de referencia | Quién |
|---|---|---|---|
| Mover de etapa (con motivo si la flecha lo exige) | `moverEtapa` / `revisarMovimiento` (`mover-etapa.ts`) | `moverDeal`, `revisarMovimientoAccion` | `trabajaLeads` o `esAdministrador`, y dueño del deal |
| Mover con el hecho que lo justifica | `moverConHecho` (`mover-con-hecho.ts`) | `moverConHechoAccion` | ídem |
| Anotar en el deal | `anotar` (`anotar.ts`) | `anotarAccion` | ídem |
| Registrar actividad (contacto hecho, próximo contacto) | la que use `registrarActividadAccion` (`actividades.ts`) | `registrarActividadAccion` | ídem |
| Pegar el link de Grain | `pegarGrain` (`llamadas.ts`) | `pegarGrainAccion` | ídem |
| Marcar show / no show | `marcarShow`, `marcarFallida` (`llamadas.ts`) | `marcarShowAccion`, `marcarFallidaAccion` | ídem |
| Corregir el resultado de una llamada | `corregirResultado` (`llamadas.ts`) | `corregirResultadoAccion` | ídem |
| Reclamar un deal sin dueño | `reclamarDeal` (`reclamar.ts`) | la del Inbox | `trabajaLeads` |
| Marcar / desmarcar onboarding | `marcarOnboarded`, `desmarcarOnboarded` (`estudiante.ts`) | `marcarOnboardedAccion` | `marcaOnboarding` (customer success incluido) |
| Deshacer | `eventosDeshacibles`, `deshacerEvento` (`lib/deshacer/deshacer.ts`) | `deshacerEventoAccion` | `puedeDeshacer` (`permiso.ts`) |

**Ola 2, dinero y efectos externos** (más cuidado, se hace después de la ola 1 en verde):

| Acción | Función | Cuidado |
|---|---|---|
| Registrar abono sin comprobante | `registrarAbono` (`abonos.ts`), sin `archivo` | El MCP no sube archivos: el abono queda "sin comprobante" y la app ya lo marca (`abono-sin-comprobante.ts`). La reja del sobrepago es la de la app, un centavo de más se rechaza. La vista previa muestra monto, moneda, saldo antes y después (`lib/queries/saldo.ts`). |
| Marcar link de pago enviado | la de `marcarLinkEnviadoAccion` | — |
| Editar el acuerdo | la de `editarAcuerdoAccion` | Dinero: vista previa con antes y después del valor. |
| Cambiar de cohorte / próxima cohorte | `cambiarCohorte` (`estudiante.ts`), la de `proximaCohorteAccion` | — |
| Reagendar una llamada | `reagendarLlamada` (`llamadas.ts`) | **Efecto externo:** toca Calendly y al lead le llega un correo. La vista previa lo dice con todas las letras ("Calendly le avisará a Ana"). |
| Crear un deal a mano | la de `crearDeal` (`crear-a-mano.ts`) | Respeta el índice de un deal abierto por lead y programa. |
| Cambiar el dueño (administración) | `cambiarDuenoDeal` (`cambiar-dueno.ts`) | Solo `esAdministrador`. |

**Fuera del MCP** (no se construyen aquí; si se quieren, es una enmienda al ADR 0119): anular un deal, una llamada o un
abono (es una corrección rara, mejor con la ficha delante, ADR 0038), todo Ajustes, usuarios, secretos, fuentes y
borrar.

## Rejas que no se pueden olvidar

- **Scope:** un token `lectura` nunca ve las herramientas de escritura y, si las llama forjando la petición, se rechaza.
- **"Ver como":** con `vista` puesta, toda escritura se rechaza (ticket 172). Ya lo deja listo el 348; aquí se prueba.
- **Programa:** el deal tiene que ser de un programa en el alcance, con el mismo "No existe" del 348.
- **Anulados:** un deal anulado no se mueve (lo dice `moverEtapa`); la vista previa lo muestra como "no se puede".
- **Ninguna escritura fuera del molde:** guardián que recorre `lib/mcp/` y falla si una herramienta llama una función
  de escritura de `lib/` fuera de `confirmar_cambio`. Mordido en los dos sentidos.
- **Guardianes que ya existen** y deben seguir en verde: `tests/rastro-operativo.test.ts` (toda escritura con rastro),
  `tests/vigencia-centralizada.test.ts`, el del motor de etapas (`deals.etapa` solo por `moverEtapa`).

## Migración

`mcp_confirmaciones` y el valor `mcp` en `origen_cambio`. La aplica la sesión principal; `ALTER TYPE ... ADD VALUE` sobre
un enum que usa `change_log` (tabla caliente): `SET lock_timeout = '5s';` al inicio y mirar `pg_stat_activity` antes.

## Tests

- **Vista previa = lo aplicado:** preparar, confirmar y comparar la base contra la vista previa, renglón por renglón.
- **Nada sin vista previa:** confirmar un id inexistente, vencido, ya usado o de otro token → rechazado y la base sin
  moverse.
- **Cambió en el medio:** preparar, mover el deal por otra vía, confirmar → ese renglón rechazado, los demás aplicados.
- **Lote:** 51 deals → "divídelo", nada preparado; 50 con 2 inválidos → la vista previa marca los 2 y confirmar aplica 48.
- **Paridad con la app:** la misma escritura por la server action y por el MCP deja la misma fila y el mismo rastro,
  salvo `origen`.
- **Permisos forjando la petición:** closer sobre un deal ajeno, token `lectura` llamando `confirmar_cambio`, developer
  con `vista` escribiendo, paid trafficker intentando mover → todos rechazados con la base intacta.
- **Deshacer:** cada cambio confirmado aparece en `eventosDeshacibles` y se deshace por el MCP.
- **Ola 2:** abono que sobrepasa el saldo por un centavo → rechazado en la vista previa; reagendar avisa del correo al
  lead en la vista previa.

## Done cuando

- [ ] Ola 1 completa: un closer, en Claude Code (y en claude.ai cuando esté el 383), mueve varios de sus deals, registra
      resultados y anota, siempre viendo la vista previa y diciendo "sí", y lo deshace desde el chat.
- [ ] Cada cambio queda en `change_log` con `origen = 'mcp'` y en la ficha del deal en la app.
- [ ] Ola 2 completa con sus cuidados.
- [ ] Tests de arriba en verde; typecheck, lint y `npm run build` limpios; mordida a mano con `curl` de una escritura
      sin preparar y de una con el id de otro.
- [ ] `docs/operations.md` dice qué se puede hacer por el MCP y qué no; tracker y `status:` iguales.
