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

- [ ] `tests/deshacer.test.ts`: cada regla del registro en los dos sentidos (se deshace / no se ofrece); permiso forjado
      (closer ajeno 403 sin mover la base; autor, dueño, gerente y developer pasan); un evento se deshace una vez (409);
      una fila de reversión no se deshace; motivo en blanco queda `null`; deshacer un cambio viejo pisa el posterior.
- [ ] Etapa: corrección a cualquier destino permitido en cualquier momento; rechaza ganado, perdido y salir de ganado;
      recupera el pendiente solo al volver a la etapa de origen.
- [ ] Cortesía deshecha: sale de Completo y deja de contar como venta. Abono deshecho: el motor recalcula (A1/A2).
- [ ] Actividad anulada: deja de contar como contacto y gestión (prueba con la función real que lo cuenta).
- [ ] Llamada de Calendly deshecha vuelve a sueltas; llamada del CRM se anula.
- [ ] Guardianes: `vigencia-centralizada` con `deal_actividades`, `rastro-operativo` y `motor-etapas-guardian` en verde.
- [ ] Tests existentes que fijaban "motivo obligatorio", "solo cohorte activa" o "solo el último movimiento", reescritos a
      la regla nueva (no borrados).
- [ ] typecheck, lint, tests del cambio y `npm run build` limpios. Recorrido en `dev:local` con clic en el diálogo.
- [ ] Migración 0113 aplicada en producción con el ok de Mani, antes de desplegar el código.
