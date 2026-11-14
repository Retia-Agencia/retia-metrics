---
id: 368
etapa: crm
serves: "ADR 0117 (deshacer), enmienda ADR 0026 y 0078; Michael Castellanos vía Mani, 3-nov"
depends: []
status: en main
---

# 368 — Deshacer desde el log del deal, en cualquier momento, con motivo opcional

## Por qué

Michael (3-nov): *"que lo pueda revertir... deshacerlo con un motivo y ya."* Mani (3-nov): en cualquier momento, no solo
lo último, motivo opcional en texto libre, un deshacer no se deshace y queda registrado, sin vacíos. Decisión completa
en el ADR 0117; este ticket es cómo se construye.

## Ya hecho por la sesión principal

- Esquema y migración `drizzle/0113_deshacer.sql` (probada en PGlite, **sin aplicar en producción**): tabla
  `reversiones` (índice único parcial por evento), `reversion_id` en `change_log` y `deal_etapa_historial`, la terna
  `anulado_*` en `deal_actividades`, y los CHECK de anulación de `deals`, `calls`, `abonos` y `deal_actividades` con
  motivo opcional (nulo, nunca en blanco). Índice `change_log_registro_idx`.

## Alcance

### 1. Quién puede (`lib/deals/permiso.ts`, no `lib/auth/`)

`puedeDeshacer(actor, { autorId, ownerUserId, campo? })`: `esAdministrador` (incluye developer), o el autor del evento,
o el dueño del deal si `trabajaLeads`. Para `deals.onboardedAt`, además `puedeMarcarOnboarding`. Una sola función; nada
de `rol === "..."`.

### 2. El registro exhaustivo (`lib/deshacer/registro.ts`)

Por cada tabla con rastro del CRM (`deals`, `calls`, `abonos`, `deal_actividades`), un
`Record<keyof typeof tabla.$inferSelect, ReglaDeCampo>`: **una columna nueva no compila** hasta clasificarla.

- `{ restaurar: (tx, actor, registroId, valorAnterior, reversionId) => Promise<void> }`: vuelve el campo a su valor
  anterior **por la función de dominio que valida ese campo** (dueño por `cambiarDuenoDeal`, cohorte por
  `cambiarCohorte`, fecha límite con `exigirFechaLimiteValida`, onboarding, acuerdo, valor vendido, setter, link enviado,
  Grain, comprobante...). Si no hay función de dominio, `editarConRastro` con la validación mínima que ese campo pide.
- `{ no: "razón" }`: ids, fechas de creación, `programId`, `etapa` y `pendiente` (los mueve el motor, ver §4), la terna
  `anulado_*` (una anulación no se revierte), columnas que escribe solo el sistema.
- `calls.dealId`: si el valor anterior es nulo y la llamada es de Calendly, deshacer = **devolverla a las sueltas** del
  Inbox (no se anula). Cualquier otro caso, `no`.
- `deals.cortesia` (true → false): quita la cortesía, vuelve `valorVendidoUsd` a su valor anterior y saca el deal de
  Completo con la corrección (§4) a la etapa de origen de la fila del historial que lo llevó a Completo. Solo administra.

Un evento "creado" (primer grupo de un registro, todos los valores anteriores nulos):

| Tabla | Deshacer |
|---|---|
| `abonos` | `anularAbono` (el motor recalcula la etapa) |
| `deals` | `anularDeal` (arrastra llamadas y abonos) |
| `calls` origen `crm` | `anularLlamada`, nueva, con rastro |
| `deal_actividades` | `anularActividad`, nueva, con rastro |

### 3. La operación (`lib/deshacer/deshacer.ts`)

`deshacerEvento(db, actor, { dealId, evento: { tipo: "etapa", id, a } | { tipo: "cambio", changeLogId }, motivo? })`,
en UNA transacción con el deal bloqueado:

1. Lee el evento y lo valida: es de este deal, lo hizo una persona (`user_id` no nulo), no lo escribió otra reversión
   (`reversion_id` nulo), el registro no está anulado, y `puedeDeshacer`.
2. Inserta la fila de `reversiones` (motivo `trim`, vacío = `null`). El índice único hace que un segundo deshacer del
   mismo evento falle con 409 legible ("Esto ya se deshizo"), no 500.
3. Aplica la regla del registro. **Un grupo** = las filas de `change_log` con la misma tabla, `registro_id`,
   `detectado_en` y `user_id`; se restauran todos sus campos.
4. Toda fila que escriba lleva `reversion_id`: `Contexto` de `lib/crm/rastro.ts` gana `reversionId?` (lo escriben
   `crearConRastro`, `editarConRastro` y `crearVariosConRastro`) y `moverEtapa` también.

`eventosDeshacibles(...)` en el mismo módulo responde, para cada evento del log, si muestra "Deshacer", qué va a pasar
(texto corto para el diálogo: "Dueño: Ana → queda Pedro") y si ya está deshecho (quién, cuándo, motivo). La usan la ficha
y el servidor: **una sola respuesta** (N1).

### 4. La etapa (enmienda del ADR 0078 en `lib/deals/mover-etapa.ts` y `etapas.ts`)

- La corrección (`CORR`) ya no sale del historial: `destinosDeCorreccion(etapaActual)` (pura) = todas las etapas salvo
  la actual, `ganado_parcial`, `ganado_completo` y `cierre_perdido`; **ninguna** si la actual es ganada. `moverEtapa`
  valida contra ella. `CORR.exigeMotivo = false`: el motivo vive en `reversiones`.
- Pendiente: si el destino es la etapa de origen del evento deshecho, recupera su `pendiente_de` (con la espera de
  Próxima cohorte que ya restaura `datosDeEsperaParaCorreccion`); si no, `null`.
- Se borra la regla "no se corrige una corrección" y la detección por motivo `correccion`: una fila con `reversion_id`
  (o, en la historia vieja, con motivo de tipo `correccion`) no muestra "Deshacer", pero **"Corregir etapa"** de la ficha
  y del Kanban siempre está (evento = nulo), porque corregir es cambiar, no deshacer.
- Toda corrección pasa por `deshacerEvento` (escribe su reversión). El camino `correccion` de `moverConHechoAccion` y
  del Kanban se redirige ahí.
- `motivos` de tipo `correccion`: se quitan de los selectores y de Ajustes › Motivos (N7). El valor del enum se queda.

### 5. Anulaciones con motivo opcional

- `anularAbono`, `anularDeal`, `descartarLlamadaSuelta` y sus esquemas: motivo opcional (`trim`, vacío = `null`).
- `anularAbono` pierde la ventana de "cohorte activa" (ADR 0026 punto 5 enmendado) y usa `puedeDeshacer`.
- Los botones de anular de la ficha (abono, deal) abren el diálogo de deshacer del evento de creación, así quedan con
  su reversión.

### 6. Las actividades se anulan (`vigente`)

- `vigente(dealActividades)` / `incluyendoAnulados(dealActividades)` en `lib/queries/vigente.ts`, y
  `tests/vigencia-centralizada.test.ts` las vigila igual que `calls`, `deals` y `abonos` (mordido en los dos sentidos).
- Cada lectura de `deal_actividades` en `lib/`, `app/`, `components/` y `scripts/` decide. Las que cuentan gestión,
  contacto registrado, último contacto, estancado o En Contacto usan `vigente`; la ficha lista las anuladas tachadas.

### 7. Pantalla (Tinta, `docs/structure.md` §9; sin colores a mano)

- `components/deals/ficha/ficha-historial.tsx`: en cada fila deshacible, botón pequeño "Deshacer" (variante ghost). Fila
  deshecha: `<Badge variant>` neutro "Deshecho" con quién, cuándo y el motivo si hay. Fila escrita por una reversión:
  etiqueta "Deshacer" en el título y sin botón.
- `components/deals/ficha/dialogo-deshacer.tsx` (uno solo): título "Deshacer", el resumen de lo que cambia, para etapa un
  select de destino (por defecto la etapa de origen; solo `destinosDeCorreccion`), textarea "Motivo (opcional)", botones
  Cancelar / Deshacer. Lo usan el log, "Corregir etapa" (ficha y Kanban) y los botones de anular. Tras éxito,
  `router.refresh()`.
- Texto sin jerga (N5): nada de "reversión", "change_log", ids ni nombres de columnas.
- Lo que el cliente necesita llega por props desde el servidor (`import type` donde se pueda): `npm run build` obligatorio.

### 8. Documentos en el mismo commit (N8)

`docs/adr/README.md` (fila 0117, y 0026/0078 marcadas como enmendadas), `docs/overview.md` §11 (Deshacer, Corregir
etapa), `docs/structure.md` (fila `CORR` del motor), `docs/metricas.md` (las actividades anuladas no cuentan),
`AGENTS.md` (contrato "Que registros cuentan" incluye `deal_actividades`; fila nueva "Como se deshace algo").

## Fuera de alcance (ADR 0117)

Confirmar o separar correo; catálogo, ajustes y Media; lo que escribe el sistema (sync, webhook, motor).

## Done cuando

- [x] `tests/deshacer.test.ts`: cada regla del registro en los dos sentidos (se deshace / no se ofrece); permiso forjado
      (closer ajeno 403 sin mover la base; autor, dueño, gerente y developer pasan); un evento se deshace una vez (409);
      una fila de reversión no se deshace; motivo en blanco queda `null`; deshacer un cambio viejo pisa el posterior.
      *(13-nov: "el registro clasifica exhaustivamente…", "corregir etapa sin fila rechaza al closer ajeno sin mover la base",
      "restaura un cambio viejo, guarda motivo vacío como null y solo permite una vez" (409 al repetir y a la fila de reversión)
      y "%s puede deshacer" para autor, dueño, gerente y developer.)*
- [x] Etapa: corrección a cualquier destino permitido en cualquier momento; rechaza ganado, perdido y salir de ganado;
      recupera el pendiente solo al volver a la etapa de origen. *(13-nov: "corrige libremente la etapa y solo recupera el
      pendiente al volver al origen" y "no corrige desde %s" con ganado parcial, ganado completo y perdido, 409 sin mover la base.)*
- [x] Cortesía deshecha: sale de Completo y deja de contar como venta. Abono deshecho: el motor recalcula (A1/A2). *(13-nov: "deshacer una
      cortesía restaura el valor y saca el deal de Completo" (no sale en `ventasConDiaEn`) y "deshacer la creación de un abono lo
      anula y recalcula la etapa".)*
- [x] Actividad anulada: deja de contar como contacto y gestión (prueba con la función real que lo cuenta). *(13-nov: "una actividad creada se anula y deja
      de estar vigente", con `leerHechos` del motor: `tieneContactoRegistrado` pasa a falso.)*
- [x] Llamada de Calendly deshecha vuelve a sueltas; llamada del CRM se anula. *(13-nov: "una llamada de Calendly asignada vuelve a sueltas y una
      llamada CRM creada se anula".)*
- [x] Guardianes: `vigencia-centralizada` con `deal_actividades`, `rastro-operativo` y `motor-etapas-guardian` en verde. *(13-nov: `dealActividades` está en
      `TABLAS_ANULABLES` de `tests/vigencia-centralizada.test.ts`; los tres en verde en el CI de `cp-20261113-1`.)*
- [x] Tests existentes que fijaban "motivo obligatorio", "solo cohorte activa" o "solo el último movimiento", reescritos a
      la regla nueva (no borrados). *(13-nov: `9182f37b` reescribió `mover-etapa`, `abonos-del-deal`,
      `ficha-deal-mutaciones`, `inbox-descartar-suelta` y `vigencia-centralizada`; ninguno se borró.)*
- [x] typecheck, lint, tests del cambio y `npm run build` limpios. Recorrido en `dev:local` con clic en el diálogo. *(13-nov: CI verde en
      `cp-20261113-1` (typecheck, lint, build y suite); recorrido del 3-nov anotado en el tracker: nota anulada con motivo, etapa
      corregida sin motivo, actividad tachada.)*
- [x] Migración 0113 aplicada en producción con el ok de Mani, antes de desplegar el código. *(Anotado en el tracker el 3-nov.)*
- [x] **(Enmienda 13-nov.) Deshacer el resultado de una llamada fallida también deshace el pendiente Re-agenda.** Ver
      "Hallazgo del 13-nov" abajo. *(Evidencia: casos a, b, c y e en `tests/deshacer.test.ts`; caso d por
      `deshacer_evento` en `tests/mcp-acciones-ola2.test.ts`.)*

## Hallazgo del 13-nov: deshacer un no show deja el pendiente Re-agenda puesto

Encontrado al construir el 411 F2 (handoff del 13-nov) y **fijado como comportamiento actual, no como regla**, en
`tests/mcp-acciones-ola2.test.ts` › "hallazgo: deshacer el resultado de una fallida deja Re-agenda".

- **Qué pasa.** `marcarFallida` con `no_show` (o `cancelada`) escribe dos cosas: `calls.resultado` y `deals.pendiente =
  "reagenda"`. `eventosDeshacibles` ofrece deshacer el cambio de `calls.resultado`; `deshacerEvento` devuelve la llamada a
  `agendada` pero no toca el deal. Queda un deal con una cita vigente y a la vez el pendiente Re-agenda.
- **A quién le duele.** Al closer: el deal sigue en la columna Re-agenda del Kanban (296, ADR 0103) y en su bandeja, con una
  cita que no hay que reagendar. No cambia ninguna métrica de dinero.
- **Por qué pasa.** El registro de `lib/deshacer/registro.ts` trata cada columna con rastro por separado; el pendiente del deal
  es otro evento de `change_log`, sin vínculo con el de la llamada. Es el mismo problema que `docs/mcp.md` §3 nombra como
  "reversión compuesta de una operación".
- **Dos caminos, decide Mani** (ninguno asumido):
  1. **Agrupar:** `marcarFallida` escribe sus dos cambios con un mismo id de operación y deshacer uno deshace los dos. Es la
     base de la reversión compuesta que el 411 dejó pendiente; sirve después para otras operaciones de dos escrituras.
     Probablemente lleva una columna en `change_log` (migración).
  2. **Regla puntual:** al deshacer un `calls.resultado` que venía de fallida, si el deal tiene `pendiente = "reagenda"` puesto
     por esa misma operación y no hay otra llamada fallida vigente, se limpia. Sin migración, pero es una regla que conoce un
     caso; el siguiente caso pide otra.
  Recomendación: la 1 si el 411 va a necesitar la reversión compuesta de todos modos (lo tiene como pendiente nombrado); la 2
  si se quiere cerrar ya el síntoma.
- **Decidido (13-nov).** Mani delegó la elección ("elige tú la que mejor consideres: fácil, consistente, intuitivo y rápido") y
  queda **el camino 2, la regla puntual**. Por qué: no lleva migración, se arregla en un commit y para el closer el resultado es
  el que espera (deshace el no show y el deal sale de Re-agenda). El camino 1 es mejor diseño pero es una pieza grande que hoy
  nadie necesita para otra cosa. **Condición para que no quede como parche:** la regla vive en un solo lugar, dentro de
  `lib/deshacer/` (no en la pantalla ni en el MCP), con un comentario `ponytail:` que diga que se reemplaza cuando exista la
  reversión compuesta del 411; ese pendiente del 411 la absorbe y la borra.
- **Regla exacta a implementar:** al deshacer un cambio de `calls.resultado` cuyo valor deshecho era `no_show` o `cancelada`, si
  el deal tiene `pendiente = "reagenda"` y **no** le queda otra llamada vigente con resultado `no_show` o `cancelada`, el pendiente
  vuelve al valor que tenía antes de esa operación (se lee del `change_log` del deal: el evento de `deals.pendiente` de la misma
  operación; si no se encuentra, queda nulo). La escritura pasa por `editarConRastro`, así deja su fila de rastro. Casos del test:
  (a) un solo no show deshecho → sin pendiente; (b) dos no shows, se deshace uno → sigue Re-agenda; (c) el deal ya tenía otro
  pendiente antes del no show → vuelve a ese; (d) lo mismo por `deshacer_evento` del MCP; (e) un closer ajeno recibe 403 y la
  base no se mueve.
- **Al arreglarlo:** el test "hallazgo: …" se reescribe a la regla nueva (el pendiente vuelve a su valor anterior) y se le quita
  la palabra "hallazgo". El deshacer del MCP (`deshacer_evento`) usa el mismo caso de uso, así que queda arreglado a la vez; se
  verifica con un caso en ese mismo archivo. Regla N8: `docs/mcp.md` §3 y el ADR 0117 en el mismo commit.
- **Estado del ticket (N9).** 13-nov: marcadas con su evidencia las nueve casillas originales; **queda abierta la de la enmienda**
  (la regla del Re-agenda no está construida), así que sigue "en main". Antes decía: estaba "en main" desde el 3-nov con las nueve casillas sin marcar. Antes de pasarlo a
  `done` hay que marcar cada una con su evidencia (el test que la cubre) o decir cuál no se cumple.
