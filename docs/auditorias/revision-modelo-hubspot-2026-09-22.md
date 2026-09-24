# Revisión del modelo HubSpot, la arquitectura y el plan — 22-sep-2026

> **24-sep:** varias fichas se cerraron o avanzaron con la dirección de producto del 24-sep (§5c y
> `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md`, ADR 0048 a 0052).
>
> **Estado: por decidir.** Este documento no cambia nada todavía. Cada ficha termina en `Estado`
> y `Decide`. Lo que se decida entra al repo por el camino normal (ADR o enmienda vía
> `/grill-with-docs`, y tickets en `docs/tasks/`). Hasta entonces, **los ADR, la spec y el plan v2
> siguen mandando**.

## Método y límites

- **Qué se revisó:** los 46 ADR (0035-0046 enteros, más las enmiendas de los anteriores), `docs/spec.md`,
  `docs/plan-crm-v2.md`, `docs/agents/context.md`, el handoff (CIERRE 18-21), las notas de
  `docs/insumos/`, el tracker y los tickets 036-093. En código: `lib/`, `app/`, `tests/`, `drizzle/`
  y la configuración.
- **HubSpot:** se leyó el portal de **30X** (el molde de donde salieron las etapas) por API, con
  la Personal Access Key y **solo en lectura**. La API rechazó la lectura de pipelines, flows y forms
  para un token de usuario, así que las etapas se reconstruyeron de las propiedades
  `hs_v2_date_entered_*`, que traen el nombre de cada etapa y de su pipeline.
- **Codex** no participó: la cuenta tenía el límite de uso agotado. Si se quiere una segunda
  opinión de otro modelo (el principio del "cadenero"), conviene pasarle este documento cuando
  vuelva la cuota.
- **Qué no se corrió:** `npm test` y `npm run typecheck`, porque el checkout no tiene `node_modules`.
  Las conclusiones sobre el código salen de leerlo, no de ejecutarlo.

---

## 1. Resumen ejecutivo

**Estado real.** E1 está aplicada en `production` (migración 0020). Pero `deals`, `calls`, `abonos`,
`submissions`, `lead_contactos`, `cuotas_pactadas` y `ad_spend` tienen **0 filas**. Ningún camino de
producción escribe `deals`: `crearConRastro` solo lo llaman los tests. El registro de llamadas,
ventas y abonos se quitó de `/mi-dia` (`app/(app)/mi-dia/page.tsx:33`, "vuelve en la etapa 4").
**Los closers siguen trabajando en Sheets y hoy el CRM solo lee leads.** Por eso es el momento más
barato para cambiar el modelo: cambiar una etapa no obliga a migrar datos.

Tres mensajes:

1. **El modelo está bien encaminado y en varios puntos es mejor que el HubSpot que copia.** Tiene
   etapas globales en vez de un pipeline por programa, el dinero en tablas y no en campos, y un
   `jsonb` en vez de 190 propiedades. Pero **hay que tocar la tabla de etapas antes de congelarla
   en el pgEnum** (D1, D2).
2. **El driver de la base (`neon-http`) no alcanza para el motor de etapas.** Sin transacciones
   interactivas, `moverEtapa()` no puede validar y escribir sin carrera. Y hoy los tests corren un
   camino distinto al de producción (R1). Cambiarlo también abre la puerta a que el rastro lo
   garantice la base y no un regex (R2).
3. **El plan construye la analítica antes que la operación.** Hay 93 tickets, con E1b (atribución)
   y E5 (reporting) antes de que un closer pueda mover un deal. Se propone un corte vertical
   operativo primero (§5).

### Las cinco decisiones de mayor impacto

| # | Decisión | Recomendación | Prioridad | Decide |
|---|---|---|---|---|
| D1 | ¿El setteo vive en el deal o antes del deal? | ✅ **Decidido (22-sep): en el deal**, se conservan las 10 etapas | P0 | — |
| D2 | Huecos en la tabla de transiciones del 043 | Corregirla antes de E2 | P0 | Mani |
| R1 | `neon-http` → driver estándar (`node-postgres`) con transacciones, que además deja la base portable a Supabase (R11) | Sí, antes de E2 | P0 | Mani |
| R3 | Vercel Hobby → Pro | Sí | P0 | Mani (es plata) |
| P1 | Reordenar el plan: operación antes que analítica | Sí | P0 | Mani |

---

## 2. Comparación con el HubSpot de 30X

Se leyó el portal de 30X: 1.119 propiedades de deal (341 custom), 470 KB de propiedades de
contacto (117 custom), propiedades de llamadas y la lista de owners.

| 30X en HubSpot | Retia hoy | Veredicto |
|---|---|---|
| **15 pipelines, uno por programa** (AI Sales, Sales Machine, Next Fellowship, Multipliers, etc.), cada uno con su copia de ~11 etapas: hay **151** propiedades "Date entered …" | 10 etapas **globales** (ADR 0037) | ✅ **Retia acierta.** Un pipeline por programa es justo la dispersión que hay que evitar |
| Etapas: Potencial → Registrado → Calificado → En gestión → Contactado → Agendado → Atendido → Compromiso Verbal → Ganado Pago Parcial → Ganado Pagado Completo · Cierre perdido | Pendiente Setteo → En Contacto → Re-agenda → Agendado → Atendido → Compromiso Verbal → Abonado → Completo · Próxima Cohorte · Cierre Perdido | Casi 1:1: de ahí salieron. 30X mete la **precalificación dentro del deal** (Potencial, Registrado, Calificado). Ver **D1** |
| El dinero son **campos del deal**: Valor pagado, Valor segunda cuota, Saldo pendiente (auto), Fecha de pago pactada, Días de mora (auto). Más un **pipeline aparte de Cobranza** que crea un workflow (grupo `multipliers_cobranza`) | Tablas `abonos` y `cuotas_pactadas`; la cartera es una vista | ✅ **Retia es mejor.** Con campos no hay una tercera cuota ni un historial de pagos |
| ~190 propiedades custom en "dealinformation", con duplicados: `investment_willingness` y "Investment Willingness (CRM)"; "Fecha de reunión", "Fecha reunión Calendly" y "Reunión Agendada — Fecha" | ~10 promovidas + `respuestas jsonb` (ADR 0036) | ✅ **Retia acierta.** La lección de 30X es no promover una columna por comodidad |
| Atribución en **cuatro juegos de UTM** (First, Last, Form y Checkout; grupo `giwon_attribution`), más `fbclid`, `gclid`, cookies FBC/FBP, Ad ID, Campaign ID, AdSet ID de Meta y "Media · Creativo / Tipo de creativo / Autor" | Tres UTM; `utm_content` y `utm_term` quedan **deliberadamente sin leer** (ADR 0045) | ⚠️ Leer tres está bien. **Dejar de capturar el resto es irreversible.** Ver **R6** |
| Calendly integrado en el deal: Event URI, Invitee UUID, Join URL, closer por email, estado, hora de fin | Calendly queda para "después, con PAT por programa" | ⚠️ Es el mayor ahorro de trabajo manual del closer. Ver **R7** |
| **Setter** y closer separados ("Setter asignado", "Setter que agendó", "Fecha del último toque del setter") | El closer hace su propio setteo | ❓ Preguntar a los closers. Si aparece un setter, es una columna más `trabajaLeads`, no un rol nuevo |
| Onboarding como ~25 checkboxes del deal | Solo `onboarded_at` | ✅ Retia, dentro de su alcance declarado |
| Motivo de pérdida y de descalificación como selects del deal | Catálogo `motivos` (ADR 0012) | Equivalente |
| Llamadas como actividad nativa, con disposición y cola de un marcador (Nua Talker) | `calls` colgando del deal, con `resultado` (ADR 0015) | Equivalente para el uso de Retia |

**Lo que HubSpot moderno tiene y Retia no:** desde 2024, un **objeto Lead separado del Deal**, con
su propio pipeline de prospección (New → Attempting → Connected → Qualified / Disqualified). El
deal nace cuando el lead califica. Eso es D1.

**Lo que Retia tiene y HubSpot no expresa bien:** el programa como frontera (ADR 0043), el dedup
por persona respaldado por un índice (ADR 0005) y la anulación separada de la pérdida (ADR 0038).

---

## 3. Registro de decisiones: modelo

### D1 · ¿El setteo vive en el deal o antes del deal? — P0

**Contexto.**
- Con el ADR 0037 y el ticket 052, el sync crea un deal en *Pendiente Setteo* por **cada** lead
  con `estado` Setteo. Medido: 1.532 en Tactical y 901 en ComunicArte (20-sep), y la mayoría nunca
  se contacta.
- Consecuencias: el Kanban arranca con miles de tarjetas, "deals abiertos" pierde significado, y
  queda viva la discusión de si la conversión es 0,9% o 2,6% según cómo se cuente el Setteo
  (ADR 0037, ticket 065).
- Es lo mismo que le pasa a 30X con Potencial, Registrado y Calificado dentro del deal.

**Opciones.**
- **A (vigente):** 10 etapas; el deal nace en Pendiente Setteo.
- **B (recomendada):** el setteo es una **cola de trabajo sobre el Lead**: actividades de
  contacto, reclamo y un estado de contacto del lead. El **deal nace** cuando hay intención real:
  llega Calendly (Agendado), el closer lo reclama desde la cola, o lo crea a mano (alta manual,
  ADR 0021). El deal se queda con 8 etapas: Agendado, Re-agenda, Atendido, Compromiso Verbal,
  Abonado, Completo, Próxima Cohorte y Perdido. *En Contacto* pasa al lead.
- **C:** mantener A, pero excluir la etapa 1 del Kanban y del embudo por convención. No se
  recomienda: es la misma disputa escondida en una vista.

**Recomendación: B.** El embudo queda lead → deal → venta, sin ambigüedad. El Kanban muestra
solo trabajo real. Hoy no cuesta migración (0 deals).
**Toca:** ADR 0037 (enmienda), ADR 0021, tickets 043, 044, 052, 065, 069, 070, 071, y
`deal_actividades`, que necesitaría colgar también del lead (o una `lead_actividades`).
**Esfuerzo:** 1 sesión de documentos + una migración pequeña (enum y actividades).
**Estado:** ✅ **decidido el 22-sep: opción A, el setteo vive en el deal.** Se conservan las 10 etapas del ADR 0037; no hace falta enmienda. Queda viva la D2: la tabla de transiciones hay que corregirla igual (1→4, →9, 3→5, 8→10). Las consecuencias de A se manejan en las vistas: el Kanban y el embudo tienen que separar la etapa 1 (ver ticket 065).
**Respuesta:** "Viven en el deal." (22-sep)

### D2 · La tabla de transiciones del ticket 043 tiene huecos — P0

Verificado en `docs/tasks/043-enum-de-etapas-y-tabla-de-transiciones.md:18-29`:

| Hueco | Por qué importa |
|---|---|
| 1 → 4 no está permitida (la 1 solo va a "2, 10") | El 052 exige mover Setteo → Agendado cuando llega Calendly. **Hay 9 casos medidos** en Tactical |
| Ninguna etapa lleva a **Próxima Cohorte (9)** | Solo se llega recuperando desde Perdido. El scaffold §6 dice que el closer la marca después de la llamada |
| 8 (Completo) es "terminal", pero el 043 pide Perdido "desde las nueve" | Contradicción dentro del mismo ticket |
| 3 → 5 no existe | Pegar el Grain (058) sobre un deal en Re-agenda falla |
| El 047 permite "retroceso con motivo" y el 043 exige que "las prohibidas se rechacen" (test de 100 combinaciones) | No se dice cómo conviven la lista blanca y el retroceso |
| Compromiso Verbal exige "fecha prometida" | Esa columna no existe: `fecha_pago_restante` salió con la decisión D5 del plan |

**Recomendación.** Si se elige D1-B, la tabla se reescribe entera sobre 8 etapas. Si se queda A,
hay que agregar 1→4, 5→9, 6→9 y 3→5, y decidir 8→10. En los dos casos:
- El retroceso es una **segunda lista explícita** (etapa → etapas a las que puede volver, con
  motivo obligatorio), no una excepción a la lista blanca.
- La "fecha prometida" es la primera `cuota_pactada` o una columna, pero tiene un lugar.

**Toca:** 043, 044, 047, 052, 058.
**Estado:** 🟡 **propuesta completa el 24-sep** (tabla T1 a T23, P, R, A1, A2 en el documento del 24-sep
§2.5 y en el ticket 043). Se valida con los closers antes de congelarla en código. **Decide:** closers,
luego Mani.
**Respuesta:**

### D3 · ¿Abonado cuenta como deal "abierto"? — P1

**Contexto.**
- `deals_uno_abierto_por_lead_y_programa_idx` (`lib/db/schema.ts:607`) excluye solo Completo y
  Cierre Perdido. Un Student en Abonado con saldo pendiente **bloquea cualquier otro deal** del
  mismo lead: una mentoría, un upsell o la próxima cohorte.
- El ADR 0037 §5 dice que "una segunda venta es otro deal".
- Además, la cláusula `AND anulado_en IS NULL` que se implementó (correcta, CIERRE 19) no figura en
  el ADR 0037 ni en el ticket 037.

**Opciones.**
- A: se mantiene. Un upsell espera a que se complete el pago.
- B: se excluye Abonado del índice. Un lead puede tener un deal en cobro y otro en venta.

**Recomendación:** B solo si el negocio vende una segunda cosa a la misma persona en el mismo
programa. Si no, A, y se deja escrito. En cualquier caso, **anotar la cláusula de anulación en el
ADR 0037**.
**Estado:** por decidir. **Decide:** Mani.
**Respuesta:**

### D4 · `estado` es "texto con el que nadie decide", pero el sync decide con él — P0

**Contexto.**
- ADR 0037 §2: *"`lead.estado` es texto porque nadie decide con él"*. El ticket 052 crea y mueve
  deals comparando `estado` con valores concretos.
- ComunicArte escribe `📅 Con Calendly` y Tactical `📅 Con Calendly (Juanito)`. El "combinar
  redacciones" del ticket 051 es un acto humano que llega **después** del sync.

**Recomendación.** Una tabla pequeña por programa, `estado_hoja → acción`, con las acciones
{sin deal, abrir en Agendado, (si D1-A) abrir en Setteo}. Se configura desde la pantalla de la
fuente (ticket 054), como instancia (ADR 0012). Un `estado` sin fila **se reporta** como alerta
(055) en vez de ignorarse en silencio.
**Toca:** ADR 0032 y 0037 (aclaración), tickets 051, 052, 054, 055.
**Estado:** por decidir. **Decide:** Mani.
**Respuesta:**

### D5 · UTM guardado en dos tablas sin declararlo — P1

**Contexto.**
- `leads` todavía tiene `utm_source`, `utm_medium` y `utm_campaign` (`lib/db/schema.ts:340-342`), y
  `submissions` tiene las mismas columnas (`:480-495`).
- El scaffold §2.9 dice que solo hay dos redundancias declaradas, y esta no es ninguna.
- El ticket 093 filtra sobre `leads.utm_*`; los tickets 088 y 090, sobre `submissions`: dos cifras
  para la misma pregunta, la herida del ADR 0024.

**Recomendación.** El origen del lead es **el de su primer envío**, derivado (scaffold §2.2).
`leads.utm_*` se elimina en la misma migración que llena `submissions` (E3). Hasta entonces, el 093
lee `leads.utm_*` con un comentario que lo marca como temporal.
**Estado:** por decidir. **Decide:** Mani.
**Respuesta:**

---

## 4. Registro de decisiones: arquitectura y herramientas

### R1 · Transacciones reales con un driver estándar (`neon-http` → `node-postgres`) — P0, antes de E2

**Contexto.**
- `lib/db/ejecutar-juntas.ts` usa `db.batch` si el driver lo tiene (producción) y `db.transaction`
  si no (PGlite, tests). **La rama que corre en producción no la ejercita ningún test.**
- `batch` no deja leer y escribir en la misma transacción. Por eso:
  - `editarConRastro` (`lib/crm/rastro.ts:140-185`) calcula el diff **fuera** del lote: dos
    escrituras simultáneas producen un `change_log` que no corresponde a lo que pasó.
  - Los ids se generan antes en código.
  - El sync inserta leads y `change_log` en lotes **separados y no atómicos**
    (`lib/sheets/sync.ts:246-252`): un corte deja leads sin bitácora.
  - La auditoría del 19-sep ya encontró una carrera del mismo tipo en el sobrepago.
- `moverEtapa()` (045) tiene que leer la etapa y los requisitos (saldo, calls), validar y escribir
  etapa + historial + `change_log`. **Eso es un read-modify-write que necesita `SELECT … FOR UPDATE`.**

**Recomendación.**
- Se usa `drizzle-orm/node-postgres` (el `pg` estándar) con un `Pool` contra el endpoint con
  pooling de Neon. Da transacciones interactivas completas y **no es un driver de Neon**:
  funciona igual contra cualquier PostgreSQL. Así también queda resuelta la portabilidad (R11).
  - Ajustado el 22-sep: la primera versión proponía `neon-serverless`, que resuelve lo mismo pero
    ata el código a Neon.
- En Vercel, el Pool se registra con `attachDatabasePool` de `@vercel/functions` (Fluid compute),
  para que las conexiones ociosas se cierren antes de que la función se suspenda.
- Se agrega un módulo nuevo, `lib/db/transaccion.ts`. Con él:
  - `ejecutarJuntas` pasa a ser una transacción de verdad en los dos entornos, y los tests corren
    el mismo camino que producción.
  - Desaparece la rama `batch`.
- Enmendar la convención de AGENTS.md ("sin sesión ni transacciones interactivas").
- El candado del sync (ADR 0031) **se conserva**: un índice único sigue siendo el mejor candado.

**Toca:** `lib/db/index.ts`, `lib/db/ejecutar-juntas.ts`, `lib/db/tipos.ts`, `lib/crm/rastro.ts`,
`lib/sheets/sync.ts`. Hace falta un test de integración contra la rama `dev`.
**Esfuerzo:** 1 sesión.
**Estado:** por decidir. **Decide:** Mani.
**Respuesta:**

### R2 · El rastro lo garantiza la base (triggers), no un guardián por regex — P0, depende de R1

**Contexto.**
- El ADR 0042 descartó los triggers porque con `neon-http` el trigger no sabe quién escribe
  (`docs/adr/0042-…md:96`).
- Con una transacción real, `SET LOCAL app.user_id = …` resuelve eso.
- Hoy la garantía es `tests/rastro-operativo.test.ts`, un regex sobre el código que **no ve**:
  - alias (`const t = deals`)
  - `.delete(`
  - `deal_etapa_historial`, `cuotas_pactadas`, `submissions` y `lead_contactos`
- Además, `lib/closers/identidad.ts` contiene un **byte NUL literal** (línea 80, `"\0sin-closer"`)
  que hace que `file` lo reporte como *data* y que `grep` lo trate como binario. Así se puede
  esconder de cualquier guardián basado en texto.

**Recomendación.**
- Triggers `AFTER INSERT/UPDATE` en `deals`, `calls`, `abonos`, `cuotas_pactadas` y
  `deal_actividades` que escriben `change_log`. Un trigger en `deals.etapa` escribe
  `deal_etapa_historial`.
- La regla "no hay forma de escribir sin rastro" pasa a vivir en la base, igual que el dedup
  (ADR 0005).
- Los guardianes que **sí** siguen haciendo falta (`vigente()`, el rol de vista, la identidad del
  closer) se conservan.
- Cambiar el `\0` por `"\u0000"` escrito como escape.

**Toca:** ADR 0042 (enmienda), migración nueva, `lib/crm/rastro.ts`, el ticket 046 (encoge).
**Estado:** por decidir. **Decide:** Mani.
**Respuesta:**

### R3 · Vercel Hobby → Pro — P0

**Contexto.**
- `vercel.json` programa el cron una vez al día (`0 12 * * *`) porque Hobby no permite más.
- Además, el plan **Hobby es para uso personal y no comercial** según los términos de Vercel, y
  este es el CRM de una empresa.
- Es la pregunta 🔴 1 de Mani en el scaffold §12.

**Recomendación.** Pro (20 USD/mes por miembro). Habilita el cron cada 15 minutos (el sync tarda
~3 s), da más margen de `maxDuration` y deja de depender del Apps Script para tener datos frescos.
**Estado:** por decidir. **Decide:** Mani.
**Respuesta:**

### R4 · Integración continua — P1

**Contexto.** No hay `.github/`. La regla "una etapa no se cierra sin `test`, `typecheck` y `lint`
limpios" depende de que el agente se acuerde. Hay varias sesiones trabajando en paralelo.
**Recomendación.** Un workflow de GitHub Actions que corra los tres en cada push y PR.
**Esfuerzo:** menos de una hora.
**Estado:** por decidir. **Decide:** Mani.
**Respuesta:**

### R5 · Tests de punta a punta con Playwright en vez del "recorrido manual" — P1, antes de E6

**Contexto.**
- El ticket 075 deja abierta la garantía de la UI.
- AGENTS.md documenta **dos veces** bugs de UI con más de 600 tests en verde: el menú de Base UI
  que tiraba la página y el botón muerto del 20-sep.
- E6 (el Kanban) es la superficie más grande del proyecto.

**Recomendación.** Playwright con 5 o 6 flujos contra la rama `dev`: reclamar un deal, moverlo en
el Kanban, pegar el Grain, registrar un abono, anular, y **forjar una server action desde el rol
sin permiso** (hoy se hace a mano, AGENTS.md "Cómo se muerde una server action"). Se corren en CI
de noche o antes de cerrar una etapa.
**Estado:** por decidir. **Decide:** Mani.
**Respuesta:**

### R6 · Capturar todo aunque solo se lean tres UTM — P1, es tiempo que no vuelve

**Contexto.**
- El estándar de tres campos (ADR 0045) está bien **para leer**. Pero lo que el formulario no
  captura hoy no se recupera nunca.
- 30X usa justo `utm_content`, `utm_id`, `fbclid` y el Ad ID de Meta para medir ROAS por anuncio y
  por creativo.
- En Retia, `utm_term` y `utm_content` están en 0 en las 4.823 filas: **ni siquiera se capturan**.

**Recomendación.** Pedirle a Pauta que los links de Meta lleven `utm_content={{ad.name}}`,
`utm_id={{campaign.id}}` y el `fbclid`, y que el formulario (Typeform o Dapta) los guarde como
hidden fields. Entran solos en `submissions.respuestas` (ADR 0036) sin tocar el estándar ni el
código. Es una acción de Ops, no un ticket.
**Estado:** ✅ **decidido en parte el 24-sep (ADR 0051):** `utm_content` y `utm_term` se capturan
siempre; `utm_content` lleva el `{{ad.id}}` de Meta en los links de Pauta. `utm_id` y `fbclid` siguen
sin decidir. **Decide:** Mani + Alejo (Pauta).
**Respuesta:**

### R7 · Adelantar Calendly (webhook) a E4 — P1

**Contexto.**
- Hoy el sync crea una Call `agendada` **sin fecha** cuando la hoja dice "Con Calendly", y el
  closer completa la fecha y el link a mano (scaffold §2.5, tickets 052 y 059).
- Depende de que el Apps Script escriba el `Estado`.
- 30X tiene Calendly integrado en el deal.

**Recomendación.** Un webhook de Calendly (`invitee.created`, `invitee.canceled`) por programa,
con el PAT por programa ya decidido. Crea la Call con la **fecha real y el closer real** (Round
Robin), mueve a Agendado o a Re-agenda sin que nadie toque nada, y registra las cancelaciones.
Requiere Calendly Standard o superior.
**Toca:** tickets 052, 057 y 059; spec §2 ("No conecta Calendly").
**Estado:** ✅ **decidido el 24-sep (ADR 0049, ticket 096)**, con un matiz: Calendly **no crea deals**
(los abre el envío, que ya trae la agenda); solo cuelga cada llamada de su deal, y si hay duda la deja
suelta para que un closer la asigne. El host es dueño si el deal no tiene. Queda abierto webhook o
consulta periódica. **Decide:** Mani.
**Respuesta:**

### R8 · La ingesta se diseña para el webhook; Sheets es un adaptador — P1

**Contexto.**
- El ticket 048 (una sola función de ingesta) es la pieza que más vive.
- El destino declarado es Dapta escribiendo directo al CRM (scaffold §5.5 y §5.7).
- Hoy todo el sync asume "leer la pestaña completa".

**Recomendación.** La firma de la ingesta recibe `Envio[]` normalizados, venga de donde venga.
Sheets es un adaptador que produce `Envio[]`; el webhook es otro. Así el día de Dapta no hay que
reescribir nada. Se mantienen el aviso `onChange` del Apps Script y el sync perezoso (056) como
capas.
**Estado:** por decidir. **Decide:** Mani.
**Respuesta:**

### R11 · Base portable: la migración a Supabase queda a un cambio de `DATABASE_URL` — P1, va con R1

**Contexto.**
- Se evaluó migrar a Supabase (22-sep). Hoy **no compensa**:
  - El problema real, las transacciones, se resuelve sin cambiar de proveedor (R1).
  - El login ya está hecho y probado con Auth.js.
  - Las ramas de Neon con copia de datos sostienen el flujo del ADR 0018. Las de Supabase exigen
    plan Pro y arrancan sin datos.
  - El plan gratis de Supabase pausa el proyecto tras 7 días sin uso.
- Supabase podría convenir más adelante si se necesitan juntas sus piezas incluidas: storage para
  los comprobantes (035), realtime para el Kanban y una API pública.
- Por eso la decisión no es migrar: es **no cerrarse la puerta**.

**Qué ya es portable.**
- El esquema y las migraciones: SQL estándar de drizzle en `drizzle/`.
- Los datos: `pg_dump` de Neon a `pg_restore` en Supabase.
- El login: Auth.js no depende de la base.
- Los tests: PGlite.

**Qué ata a Neon hoy.**
- `lib/db/index.ts`, que usa `neon-http`.
- `lib/db/ejecutar-juntas.ts`, que depende de `db.batch`.
- El flujo de ramas: es operación, no código.

**Recomendación: reglas de portabilidad**, para anotar en AGENTS.md como contrato.
1. **Driver estándar** (`node-postgres`, R1). Ningún import de `@neondatabase/*` fuera de
   `lib/db/`, y ojalá ninguno en absoluto.
2. **La conexión vive en un solo archivo** (`lib/db/index.ts`) y solo lee `DATABASE_URL`.
3. **Solo SQL de PostgreSQL estándar.** Una extensión nueva (`pg_trgm`, `pgcrypto`, etc.) se
   agrega solo si Supabase también la ofrece, y se anota en el ADR que la introduce.
4. **Los archivos van detrás de una interfaz propia** cuando entre el 035: `lib/archivos/` con
   `guardarArchivo()` y `urlDeArchivo()`. Hoy detrás iría Vercel Blob; mañana Supabase Storage,
   sin tocar las pantallas.
5. **Los triggers de rastro (R2) son PL/pgSQL estándar** y funcionan igual en los dos.

⚠️ **Trampa para el día de la migración:** el pooler de Supabase en modo *transaction* (puerto
6543) no admite *prepared statements*. Hay dos salidas:
- Desactivarlas en el driver.
- Usar la conexión directa o el modo *session* (puerto 5432) para las transacciones.

Es configuración, no código, pero si no está escrita cuesta una tarde.

**Cómo se prueba que es portable y no solo una promesa.**
- Un guardián: ningún import de `@neondatabase/*` fuera de `lib/db/`.
- La suite de integración (la de R1) parametrizada por `DATABASE_URL`, corrida una vez contra la
  rama `dev` de Neon y otra contra un proyecto gratis de Supabase.
- Si pasa en los dos, la migración es: dump → restore → cambiar la variable → correr migraciones.

**Toca:** `lib/db/index.ts`, `lib/db/ejecutar-juntas.ts`, `lib/db/tipos.ts`, `package.json` (sale
`@neondatabase/serverless`, entran `pg` y `@vercel/functions`), AGENTS.md (contrato nuevo) y un
ADR nuevo, "La base es PostgreSQL, no Neon".
**Esfuerzo:** casi nulo si se hace junto con R1. El test contra Supabase es media sesión.
**Estado:** por decidir. **Decide:** Mani.
**Respuesta:**

### R9 · Lo que se mantiene — P2

Next 16, Drizzle, Neon con ramas `dev` y `production` (ADR 0018), PGlite para tests (ADR 0020),
Zod en el borde, el molde de catálogo (ADR 0012/0029), `vigente()`, `saldo.ts`, los roles
centralizados y el candado del sync por índice. **Auth.js v5 sigue en beta**: funciona, y
cambiarlo no es prioridad. Si da problemas, la alternativa es Better Auth.
**Estado:** por decidir (ratificar). **Decide:** Mani.

### R10 · Construir o comprar: se ratifica construir — P2

**Contexto.** Se decidió "CRM propio, no HubSpot" el 19-sep. Se revisó de nuevo con el portal de
30X a la vista.
**Análisis.**
- HubSpot Sales **Pro** es el plan con propiedades requeridas por etapa y workflows. Para 5
  usuarios cuesta del orden de 90-100 USD por asiento al mes.
- Reproduciría la dispersión de 30X (un pipeline por programa y campos de dinero duplicados).
- No expresa la frontera de programa ni los abonos y cuotas como filas.
- El valor diferencial de Retia (el programa como frontera, el dedup, la anulación, el dinero)
  ya está construido.

**Recomendación.** Seguir con el CRM propio, **con la condición de recortar el alcance (§5)**. El
riesgo del CRM propio no es la tecnología sino que tarde en ser operativo.
**Estado:** por decidir (ratificar). **Decide:** Mani.
**Respuesta:**

---

## 5. Registro de decisiones: plan y alcance

### P1 · Operación antes que analítica — P0

**Contexto.** El tracker pone E1b (atribución: áreas, campañas, emparejador) como lo siguiente.
E5 (dashboard, embudo, ROAS) va antes que E6 (Kanban, mi día). Mientras tanto hay 0 deals y los
closers siguen en Sheets. Mani también dijo (22-sep, CIERRE 19) que las filas de hoy "no importan":
la migración one-time (E7) se hace al final y el sync arranca como paso final. Eso le quita
urgencia a lo "irrecuperable" del ticket 086.

**Propuesta de orden (corte vertical operativo):**

1. **E0′ · Documentos (1 sesión):** decidir D1-D5, corregir el 043, cerrar la checklist de la §6.
2. **R1 + R2 + R4:** transacciones, rastro por triggers, CI.
3. **E2:** el motor de etapas (043-047) con la tabla corregida.
4. **E3 mínimo:** 048, 049, 050, 051, 052, 053, más el 056 si hay Pro. Quedan para después el 054
   (configurar fuente) y el 055 (alertas).
5. **E4:** 057, 058, 059, 060, más Calendly (R7). Después: 061, 062, 063 y 035.
6. **E6 mínimo:** 069 (Kanban), 070 (reclamo y Unclaimed), 071 (mi día), 074 (ficha del deal),
   con R5.
7. **E7:** la migración one-time y el apagado de las pestañas.
8. **Después, ya con datos reales:** E1b (083-087, 092) y E5 (064-068, 088-090, 021).

**Excepción que puede ir ya:** el **093** (filtros por UTM), que no tiene dependencias.

**Dependencias del tracker que hay que corregir:**
- 069 depende de 045, 052 y 057, **no** de 065 (un Kanban no necesita el embudo).
- 077 no depende de 075 (la migración no espera una revisión de UI).
- 086, 070 y 067 declaran dependencias distintas en el ticket y en el tracker.

**Estado:** por decidir. **Decide:** Mani.
**Respuesta:**

### P2 · Correcciones a E1b para cuando se abra — P1

- **El índice único de `utm_patron` no impide empates** (tickets 084 y 085). En Postgres, un NULL
  es distinto de otro NULL salvo con `NULLS NOT DISTINCT`, y todos los campos del patrón son
  opcionales. Además, dos patrones con campos distintos (source+medium frente a source+campaign)
  pueden casar con el mismo envío sin violar ningún índice. Hacen falta `NULLS NOT DISTINCT` **y**
  detección del empate en tiempo de ejecución en el emparejador, como error visible.
- **El enlace del closer usa `utm_campaign=<closer>`** (ticket 086). Eso choca con el estándar, que
  dice que `utm_campaign` es la campaña, y si lleva el nombre vuelve el problema del ADR 0030
  (`Maru`/`maru`). Mejor un parámetro propio opaco (`ref=<id>`), o `utm_source=closer` con un id
  opaco.
- **Cardinalidad campaña-patrón:** el ADR 0045 dice "muchos patrones" y el ADR 0046 más el ticket
  092 dicen "un juego de UTM y un link". Hay que elegir una.

**Estado:** ✅ **el enlace del closer, decidido el 24-sep (ADR 0051):** `utm_source=closer`,
`utm_medium=referido`, `utm_campaign=<campaña de referidos>`, `utm_content=<código opaco>`. La
cardinalidad se resuelve con el Canal: una campaña tiene un canal y un `utm_campaign`, y sus links
varían solo en los dos opcionales. **Sigue abierto:** `NULLS NOT DISTINCT` y la detección del empate
en tiempo de ejecución (tickets 084 y 085). **Decide:** Mani.

### P3 · El costo del proceso — P2

**Contexto.** `AGENTS.md` pesa 49 KB y `docs/agents/handoff.md` tiene 2.686 líneas. Cada sesión
nueva consume una parte grande de su contexto en historia antes de empezar. Las "historias de
sangre" son valiosas, pero su lugar es su ADR.
**Recomendación.**
- `AGENTS.md` ≤ 15 KB: solo reglas, contratos y comandos, cada regla con un enlace a su ADR.
- El handoff ≤ 150 líneas, solo con el estado actual y lo siguiente; los CIERRE viejos van a
  `docs/agents/historial/`.

**Estado:** por decidir. **Decide:** Mani.

---

## 5b. Decisiones del 22-sep por la noche: Supabase y Typeform (chat con Mani)

Salen del chat de Alejandro con Mani (22-sep) y de las respuestas de Alejandro sobre esta revisión.
**Reemplazan la recomendación de R11** ("quedarse en Neon, portable"): el argumento que la cambia
es que **"todo CRM debe poder tener archivos; lo básico son los comprobantes de cada venta"**
(Mani). Con eso, el storage deja de ser opcional.

### S1 · La base se muda a Supabase — ✅ decidido

- **Organización nueva de Retia, todo en plan gratis por ahora:** un proyecto `dev` y uno de
  producción, en `us-east-1` (junto a las funciones de Vercel).
- ⚠️ **Riesgo aceptado:** en plan gratis, un proyecto se **pausa tras 7 días sin uso**. Con leads
  entrando todos los días, producción no debería quedar inactiva. Aun así, **pasar producción a Pro
  (25 USD/mes) es la primera compra** cuando haya operación real, y Mani ya dijo que "una DB cheta"
  sí vale la pena.
- **Driver:** `drizzle-orm/postgres-js` con `prepare: false` contra el pooler (puerto 6543) para
  la app. `drizzle-kit` usa la conexión directa (5432). Todo pasa a `db.transaction` real, igual
  en producción y en los tests: **R1 queda resuelto** y `ejecutarJuntas` pierde la rama `batch`.
- 🩸 **La Data API se apaga, o RLS se activa sin políticas en todas las tablas.** Supabase publica
  el esquema `public` por REST con la llave anónima; la app no la usa, así que dejarla abierta
  expone los leads sin ningún beneficio.
- **Auth sigue siendo Auth.js.** Supabase Auth no entra.
- **Los archivos (comprobantes, ticket 035)** van a Supabase Storage, en un bucket privado,
  detrás de una interfaz propia (`lib/archivos/`) y con URLs firmadas desde el servidor.
- **Toca:** ADR nuevo (sustituye al 0018 en lo de las ramas de Neon), `lib/db/`,
  `drizzle.config.ts`, `.env.example` y las convenciones de AGENTS.md que hablan de `neon-http`.

### S2 · Se arranca con la base vacía — ✅ decidido (Mani: "vale mierda ahorita")

- No se copian datos de Neon. La base nueva se levanta con las migraciones y se siembra con los
  scripts que ya existen para eso: `npm run seed:users`, `npm run seed:datos` (programas, cohortes,
  productos, fuentes, categorías) y `scripts/cargar-enlaces-pago.ts`. Son la excepción nombrada del
  ADR 0029 para sembrar una base vacía.
- Se pierden, a sabiendas: el `change_log` (2.334 filas), los usuarios y membresías (se recrean) y
  los 4.823 leads (vuelven con el traslado desde Sheets, T3).

### T1 · Los leads entran por webhook de Typeform — ✅ decidido

- `POST /api/ingesta/typeform`: verifica la firma `Typeform-Signature` (HMAC-SHA256 sobre el
  **cuerpo crudo**, patrón de `Retia-Agencia/dapta-forms-sheets`), nunca responde con redirección,
  y hace *upsert* por `(source_id, token)` con el índice que ya existe. Los reintentos de Typeform
  no duplican.
- **"Que no se confunda el programa" (Mani):** cada fuente guarda su `form_id` de Typeform, con un
  índice único. El programa sale de la **fuente registrada**, nunca de un campo del formulario. Un
  `form_id` desconocido es un **error visible**, no un lead que cae en cualquier programa.
- Entra como **un adaptador más** de la puerta única `lib/ingesta/` (ticket 048). Las fechas
  llegan en ISO con zona: el desfase de 5 horas (053) desaparece para todo lo que entre por aquí.
- 🩸 **`proxy.ts` exige sesión en todo:** la ruta tiene que ir en su lista pública, o Typeform
  recibe un redirect a `/login` y cada envío falla sin que nadie lo vea.
- ⚠️ **Por verificar:** si el webhook de Typeform manda respuestas **parciales** o solo las
  completas. Hoy los parciales son 1.152 filas en Tactical y 193 correos solo existen como parcial.
- La primera versión crea **lead + envío + contactos**. El deal llega con el motor de etapas (E2)
  y la regla del 052.

### T2 · El CRM calcula el `Estado` — ✅ decidido

- Hasta ahora lo escribía el Apps Script de la hoja cada 10 minutos. Con el webhook no hay hoja de
  por medio, así que el CRM aplica **las mismas reglas**, en el mismo orden, **configuradas por
  fuente** (ADR 0012: qué campo es la pregunta de pago, qué respuesta descarta, qué campo es el
  Calendly):
  1. no respondió la pregunta de pago → `🗑️ Descartado`;
  2. respondió "no cuento con los recursos" → `🗑️ Descartado`;
  3. trae link de Calendly → `📅 Con Calendly`;
  4. todo lo demás → `📞 Setteo No Calificado`.
- **Enmienda el principio "la hoja califica, el CRM opera"** (scaffold §1.2, ADR 0032): ahora
  califica el CRM, porque ya no hay hoja en el camino.
- **Cómo se valida la regla:** corriéndola sobre el histórico de Sheets en el traslado (T3) y
  comparándola contra el `Estado` que escribió el Apps Script. **Cada diferencia se revisa** antes
  de dar la regla por buena.

### T3 · Corte directo, y el traslado desde Sheets queda garantizado — ✅ decidido

- El CRM recibe los leads **solo por webhook** desde el primer día. No hay convivencia con el sync
  de la hoja.
- **Lo que hay en Sheets se traslada después**, por la **misma puerta**. El adaptador de Sheets de
  `lib/ingesta/adaptador-sheets.ts` ya existe para eso, así que el traslado no es un segundo camino.
  Como la llave es `(fuente, token)` en los dos adaptadores, **un envío que llegó por webhook y
  aparece también en la hoja no se duplica**.
- Para el histórico se guarda el `Estado` **tal como lo escribió la hoja** (ADR 0004), y la regla
  del CRM se corre al lado para validarla (T2).
- 🩸 **Riesgo operativo a manejar fuera del código:** si Typeform deja de escribir en Sheets antes
  de que las closers operen en el CRM (etapa E6), **se quedan sin ver los leads nuevos**. Cortar la
  entrada **del CRM** no obliga a desconectar la integración Typeform → Sheets. Recomendación:
  **que Typeform siga escribiendo en la hoja para las closers hasta que trabajen en el CRM**, aunque
  el CRM ya no la lea.

---

## 5c. Decisiones del 24-sep: dirección de producto y UI (preparación de la reunión con Comercial)

Documento de referencia: `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md`. Decisiones
de Mani, ya escritas como ADR y tickets:

| # | Decisión | ADR · tickets |
|---|---|---|
| U1 | Un closer ve solo los programas de su membresía; dentro, "todos ven todo" | 0048 · 094 |
| U2 | "Todos los programas" en el Dashboard, solo con lo sumable | 0048 · 095 |
| U3 | Listas siempre de un programa, con selector | 0048, 0050 · 097 |
| U4 | Calendly cuelga llamadas de deals; si hay duda, suelta; host dueño si no hay | 0049 · 096 (cierra R7) |
| U5 | Navegación por objetos; "Mi día" → Inbox; dashboards → tab Dashboard | 0050 · 071, 095, 097-100 |
| U6 | UTM: tres leídos y dos capturados; el closer en `utm_content` | 0051 · 084-086 (cierra P2 en parte y R6 en parte) |
| U7 | Builder v1: destinos (forms y checkouts), canal, campaña, opcionales; checkouts como destino ya | 0051 · 092, 101 |
| U8 | Rol Paid Trafficker (`manejaPauta`) | 0052 · 102 |
| U9 | **Deals históricos:** solo leads nuevos desde el corte; los viejos entran con la migración según su estado de gestión | tickets 052, 077, 080 |
| U10 | La cohorte es por programa y define la lista de estudiantes | 099 |
| U11 | Seguimiento es la etapa 11; un deal, muchas llamadas; la conversión cuenta deals distintos | 043, 059, 065, 096 |

**Propuesto el 24-sep y pendiente de los closers:** la tabla de transiciones completa (D2), qué pasa
después de cada llamada (cinco salidas explícitas; la segunda llamada no hace retroceder; show en
llamadas, cierre en deals) y el contenido del Inbox.

**Sigue abierto de este documento:** D3, D4, D5, R2, R3, R4, R5, R8, P1, P3, y R9-R10 por ratificar.
R1 y R11 quedaron resueltos el 22-sep con Supabase (§5b, ADR 0047).

---

## 6. Checklist de E0′: contradicciones en los documentos y código muerto

**Documentos**
- [x] El "nivel" UTM sigue vivo aunque se eliminó el 21-sep: `docs/spec.md:110`,
  `docs/agents/context.md:414`, los tickets 084, 090 y 092, y el encabezado del scaffold. *(24-sep: arreglado en spec, glosario y tickets; el scaffold es insumo crudo y no se edita)*
- [x] `ad_spend` cuelga de un lugar distinto según el documento (ADR 0039, 0045, 0046, enmienda
  del 0045). El ADR 0039 sigue diciendo "lo decide E5-4" sin enmienda. *(24-sep: nota en el ADR 0039; cuelga de la campaña)*
- [x] El ADR 0044 dice que enmienda el 0021 y el 0037, pero ninguno de los dos lo tiene. El 0021
  sigue diciendo "no cuentan en el CPL". *(24-sep: enmiendas anotadas en los dos)*
- [x] Huérfanos: el ticket 066 usa un solo cubo `(sin atribución)`; el 085 y el plan §12.15 usan
  dos que no se funden. *(24-sep: corregido en el 066)*
- [ ] Precio de ComunicArte: `context.md:23` dice USD 797; el scaffold §2.4 y el ticket 062 dicen
  697 como estándar (comisión 80/697). Confirmar cuál es el de lista. *(24-sep: sigue abierto; marcado en el glosario y en las preguntas para Gerencia)*
- [x] `context.md` todavía define "Fuente" como una pestaña, "Responsable" y "raw"; el ticket 064
  habla del "responsable" de un lead, que ya no existe. *(24-sep: Fuente y Responsable redefinidos; `raw` sigue existiendo en `leads`; enmienda en el 064)*
- [x] `crm-explicado-simple.md` §3 dice "misma persona en dos programas = dos Deals"; el ADR 0035
  y el 0043 dicen dos Leads. *(24-sep: no se edita, es insumo crudo; la verdad está en el glosario y en los ADR)*
- [x] El ticket 049 exige cifras de `production` (6.233 envíos, 4.791 leads) sobre `dev` (2.059). *(24-sep: nota en el 049; `dev` es Supabase vacía y las cifras se miden en el traslado)*
- [x] `spec.md` §2 dice "no permite crear un comprador que no sea lead" y "no sube archivos",
  contra la alta manual (ADR 0021) y el comprobante con foto (035). La spec no cita los ADR
  0043-0046. *(24-sep: corregido, junto con Sheets → webhook de Typeform y Calendly)*
- [x] El tracker todavía lista como pendientes decisiones ya tomadas ("mapeo de `Estado` al enum",
  "cambiar la fuente", "vista kanban" en Futuro). *(24-sep: corregido)*
- [x] El plan v2 §10 dice "ya no queda nada abierto de Mani", pero §12.8.6, §12.16 y spec §7
  abren preguntas nuevas. *(24-sep: nota en §10 y §13 nueva)*
- [x] `docs/estructura-bbdd.md` tiene el correo de la cuenta de servicio desactualizado
  (scaffold §5.2). *(24-sep: agregada la vigente)*

**Código**
- [ ] `lib/abonos/esquema.ts` todavía valida `saleId`; `lib/abonos/plataforma.ts` no lo importa
  nadie.
- [ ] Comentarios que citan archivos borrados: `lib/queries/saldo.ts` (schema.ts:687) y
  `lib/mutations/abonos.ts` (`lib/format.ts:65`). Siguen hablando del "responsable":
  `lib/mutations/personas.ts:14-25` y `lib/closers/identidad.ts:8`. El docstring de
  `lib/queries/personas.ts:24-26` cita `ventasDePersona`.
- [ ] El byte NUL en `lib/closers/identidad.ts:80` (ver R2).
- [ ] **Zona horaria:** `parsearFecha` fija `-05:00` (`lib/sheets/mapeo.ts:147`) y
  `sources.tz_fechas` no lo lee nadie. Según el scaffold §5.2, las dos hojas vienen en **UTC**
  (Typeform). Si es así, **las fechas de hoy tienen 5 h de desfase** y un envío de las 7 pm cae el
  día siguiente. El ticket 053 lo arregla, pero **conviene medirlo ya** contra una fila conocida.
- [ ] Escrituras sin `change_log`: `scripts/usuarios.ts` y `seed-users.ts` (excepción nombrada del
  ADR 0029), y `scripts/backfill-fechas-centinela.ts:102-110`, donde el update y la bitácora no
  son atómicos.

---

## 7. Preguntas abiertas a terceros (consolidadas)

**Closers (Andrea y Maru)**, con prioridad porque de ellas depende D1:
- ¿Las etapas sirven? ¿Sobra, falta o se salta alguna? ¿Quién settea: el closer o un setter?
- ¿Qué campo les da más pereza llenar? Eso define qué se exige en cada etapa (044).
- ¿Qué hacen hoy con un no-show, un compromiso vencido o "próxima cohorte"?
- ¿Qué es una venta sin llamada (los 27 estudiantes sin fila)?
- ¿Cómo se enteran hoy de un Calendly nuevo? ¿Les sirve reclamar libre?

**Michael**
- ¿Por qué se dejó de calcular el ROAS? ¿Cómo marca Juanito su rastro en el UTM?
- ¿Alguien edita el `Estado` de la hoja a mano?
- Cuando sus consolidados C2 y la hoja no coincidan, ¿cuál manda?

**Alejo y Gerencia**
- El mapeo UTM → área.
- Los umbrales de éxito (success floors) de la vista 090.
- ¿Un lead que trae un closer cuenta distinto para su comisión?
- Reconfigurar los UTM de Meta al estándar, y R6.
- ¿Por qué Tactical tiene 26% de leads sin UTM?

**Mani**
- D1-D5, R1-R11, P1-P3 de este documento.
- Si una sola fecha de pago alcanza o se usan cuotas desde el inicio (ya resuelto con
  `cuotas_pactadas`, confirmar).
