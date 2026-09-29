---
id: 096
etapa: E4
serves: "ADR 0049 · propuesta 24-sep §2.3 y §3.7"
depends: [057, 045]
status: en curso
---

# 096 — Calendly por programa: cada llamada a su deal, y si hay duda, suelta

## Objetivo

Que las llamadas de Calendly se cuelguen solas de su deal, con fecha real y host, **sin forzar**: lo
que tenga duda queda suelto en el Inbox para que un closer lo asigne.

## Las reglas (ADR 0049)

- Se cuelga sola **solo** si el correo del invitado es de **un solo lead del programa con un solo deal
  abierto**. Todo lo demás queda **suelto**. El teléfono no empareja.
- Efecto por `moverEtapa()`: deal en 1, 2, 3 o 9 → Agendado; en 4 → se queda con la fecha real; en 5,
  6 o 7 → segunda llamada, la etapa no cambia. Cancelada o no-show → Re-agenda solo desde Agendado.
- Dueño: si el deal no tiene y el host es closer registrado en el programa, el host. Si ya tiene, se
  respeta y se avisa.
- Una llamada que llega antes que el envío queda suelta y se reintenta cuando llega el envío. 🟡

## Alcance

- **Dentro:** la cuenta de Calendly del closer **por membresía** (hoy `users.calendly_email` es global).
- **Dentro:** la credencial de Calendly por programa, guardada como secreto.
- **Dentro:** el emparejador de llamadas como **módulo puro** con su guardián: nadie cuelga una Call de
  un deal por fuera de él.
- **Dentro:** asignar una llamada suelta a un deal, a mano, con rastro.
- ✅ **Decidido (Mani, 28-sep, A5): webhook.** Recibe cualquier evento de Calendly y lo refleja. Exige plan
  Standard o superior en cada cuenta. No hace falta cron ni Vercel Pro por esto.
- **Fuera:** crear deals desde Calendly. El deal lo abre el envío.

## Done cuando

- [ ] Cada regla de emparejamiento tiene su test en los dos sentidos; ante la duda, **suelta**, nunca
      la opción "más parecida".
- [ ] Una llamada suelta aparece en el Inbox y se asigna a mano, con su fila de `change_log`.
- [ ] Una segunda llamada sobre un deal Atendido no lo hace retroceder.
- [ ] ~~El dueño nunca se pisa si ya existía.~~ Reemplazado por la decisión de Mani del 28-sep: el deal
      es de la closer host si está registrada en el programa; si tenía otro dueño, pasa a la host y se avisa.

## Kiro

Sí, con revisión. El emparejador es donde un bug es silencioso.

---

## ✅ Decisión 2026-09-24 (Mani, se valida con los closers): Seguimiento y "un deal, muchas llamadas"

- **Seguimiento es una etapa propia (la 11)**, después de Atendido: la llamada ocurrió y hay que volver a
  contactarlo. Separa lo que salió bien (Compromiso, pago) de lo que hay que re-contactar. Reemplaza la
  propuesta anterior de "quedarse en Atendido con fecha". El `pgEnum` gana un valor (migración de la
  sesión principal). El número no es el orden: va después de Atendido.
- **Un deal tiene muchas llamadas y nunca se duplica.** Si una llamada falla (no-show, cancelada, u
  otra llamada necesaria), el deal pasa a Re-agenda **con motivo** (5 → 3 incluido). Una llamada nueva
  de un lead con deal abierto **se agrega y se avisa al dueño**; en 1, 2, 3, 9 u 11 el deal pasa a
  Agendado, en 5, 6 o 7 la etapa no cambia.
- **La conversión cuenta deals distintos** que llegaron a una etapa, no entradas: el ir y volver no infla.
- Transiciones nuevas: T24 (5 → 11), T25 (11 → 6), T26 (11 → 7 u 8), T27 (11 → 4), T28 (11 → 9), T29
  (5 → 3 con motivo); T11 queda reemplazada y T15 pasa a 6 → 11. Perdido llega también desde 11. Tabla
  completa en `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md` §2.5 y §2.6.
- **Reemplaza** lo dicho antes en este documento sobre "la segunda llamada no hace retroceder".

## ✅ Reunión con los closers 2026-09-24 ([reunión con los closers del 24-sep](../overview.md), resumen en la propuesta §0)

- **Cada closer tiene su propia cuenta de Calendly y es dueño de sus llamadas.** Andrea y Maru tienen
  **un correo distinto por programa**: la cuenta vive en la **membresía** (closer × programa), como dice
  el ADR 0049. El closer la configura en su perfil, por programa.
- **Todas las llamadas se graban con Grain.**
- Evidencia a favor de emparejar **solo por correo**: hay leads que ponen **un teléfono en el formulario
  y otro en la agenda**. Emparejar por teléfono habría colgado llamadas de la persona equivocada.
- ✅ **Decidido por Mani el 28-sep:** si el lead agenda con otra closer, el deal es de esa closer (la que
  es host de la cita).

---

## Pedido de Mani (28-sep, al decidir el 052)

*"No debería ser que no encuentra y luego nunca le llega llamada."* Cuando el form dice `con_calendly`
pero la cita no aparece (o está cancelada), el 052 deja el deal en Pendiente Setteo con una nota. Este
ticket cierra el ciclo:

- La llamada que llegue después desde Calendly se cuelga sola de ese deal por las reglas de arriba
  (un solo lead, un solo deal abierto) y lo mueve a Agendado.
- **Dropdown de llamadas de Calendly** para que un closer asocie una a mano (es la llamada suelta del
  Inbox, con rastro).
- **Botón "buscar llamada"** en el deal, que vuelve a consultar Calendly por si la cita apareció. Usa
  `citaDeCalendly` de `lib/calendly/cita.ts` (ticket 109, renombrada de `fechaDeCita` por el ticket 052,
  que ahora devuelve `{ inicio, cancelada }`) con el uuid del envío.

## Nota 2026-09-28 (ADR 0058)

Desde el 28-sep una re-agenda con cita vigente sobre un deal en 4-7 crea **otra** llamada en el mismo
deal (`agregar_llamada`), sin tocar la vieja. Cuando este ticket escuche las cancelaciones y
reprogramaciones de Calendly, la llamada vieja se marca ahí; mientras tanto el deal puede mostrar dos
llamadas `agendada`. Y cancelar una cita en Calendly hoy no cambia su llamada en el CRM.

## Avance 28-sep (Alejo)

**Hecho, sin migración ni A5:** el emparejador, `lib/calendly/emparejar-llamada.ts`, puro.
`emparejarLlamada(llamada, candidatos, closers)` devuelve `colgada` (lead, deal y el dueño antes y
después, con `cambio` para avisar) o `suelta` con su motivo: `sin_correo`, `sin_lead`, `varios_leads`,
`sin_deal_abierto` o `varios_deals_abiertos`.
- Empareja **solo por correo confirmado** (`lead_contactos.confirmado`): un correo que entró unido por
  teléfono no decide, o el teléfono estaría emparejando por la puerta de atrás (ADR 0035).
- Normaliza con `normalizarEmail`, la misma función de la llave del lead.
- El dueño sigue la decisión de Mani del 28-sep (la host registrada se queda el deal). Un correo de
  Calendly que reclaman dos closers se trata como host no registrada: no se inventa dueño.
- `tests/calendly-emparejador.test.ts` (20): cada regla en los dos sentidos y el orden de los
  candidatos; mordido rompiendo a propósito la regla del correo confirmado y la de varios leads.

**Falta el guardián** ("nadie cuelga una Call de Calendly por fuera del emparejador"): se escribe con
el escritor, que necesita la migración.

**Propuesta de migración de arranque de E2 (la revisa y la aplica Mani):**
- `miembros_programa.calendly_email text` nulo, con índice único parcial
  `(program_id, lower(calendly_email)) WHERE calendly_email IS NOT NULL`: dos closers no pueden reclamar
  la misma cuenta en un programa (el emparejador ya lo trata como duda, pero la garantía va en la base,
  ADR 0005).
- `calls.calendly_host_email text` nulo: quién hospeda la cita, para decidir el dueño y para mostrar la
  llamada suelta.
- La llamada suelta ya cabe: `calls.deal_id` acepta nulo y la huella `calendly:<uuid>` existe (052).
  Falta un `CHECK` que solo permita `deal_id` nulo con `origen = 'calendly'` (ADR 0049 punto 6: la
  suelta es la única Call sin deal).
- `users.calendly_email` (global) queda sin lector y se retira después.

**A5 decidida por Mani el 28-sep: WEBHOOK.** Ver "Diseño del webhook" al final; de eso depende quién llama al emparejador.

## Avance 28-sep, noche (Alejo): lo que no espera a A5

**La primera cita ya llega por el Typeform** (Calendly embebido). El 052 la lee en la API al entrar el
envío, así que A5 (webhook o consulta periódica) solo hace falta para lo que pasa **después**:
cancelaciones, reprogramaciones, no-shows y citas agendadas fuera del formulario.

- **"Buscar llamada"**, el backend: `buscarLlamadaDelDeal` en `lib/calendly/buscar-llamada.ts`. Toma el
  link de agenda del envío más reciente del lead (la pregunta que dice el mapeo de la fuente, con el
  mismo `resolverContra` del adaptador), le pregunta a Calendly y, si la cita está vigente, aplica
  **`aplicarReglaDeDeal`**, el mismo camino del 052: la misma llamada, la misma huella (dos clics no la
  duplican) y el mismo motor. Si no está vigente, **no escribe nada** y devuelve el motivo. Lo puede
  usar cualquier sesión que vea el programa (lo que decide es un hecho de Calendly, y el movimiento lo
  hace el sistema); si el programa queda fuera de su alcance, 404. **No lo llama nadie todavía**: el
  botón va en la ficha del deal (074, carril de Mani). Tests: `tests/calendly-buscar-llamada.test.ts`
  (7), mordido quitando la reja de alcance.
- **El host de la cita:** `citaDeCalendly` devuelve `correoHost` (de `event_memberships`; `null` si no
  viene o si hay varios hosts) y `resolverCitaDeEnvio` lo pasa en la cita vigente. **Todavía no se
  guarda ni decide el dueño:** para eso hacen falta `miembros_programa.calendly_email` y
  `calls.calendly_host_email` (la migración propuesta arriba). Con la migración, el deal que abre el
  envío nace con la closer host como dueña (`closerHost` del emparejador).


---

## ✅ A5: webhook (Mani, 28-sep) — diseño para quien lo construya

> *"Por webhook, más fácil; nos permite recibir cualquier evento de Calendly (agendas, reagendas,
> cancelaciones, etc.) y reflejar acordemente."*

**Verificado en la documentación de Calendly (28-sep):** la cuenta que crea la suscripción necesita plan
**Standard, Teams o Enterprise**; los webhooks se **crean por la API** (no desde el panel) y devuelven un
`signing_key` **propio de cada suscripción**; alcance `user` u `organization`; eventos disponibles
`invitee.created`, `invitee.canceled`, `invitee_no_show.created`, `invitee_no_show.deleted` y
`routing_form_submission.created`.

**Sin verificar todavía (confirmar con una entrega real antes de fiarse, 🩸):** el nombre y formato exacto de
la cabecera de firma y cómo se arma lo firmado (lo que se recuerda: `Calendly-Webhook-Signature: t=<ts>,v1=<hex>`,
HMAC-SHA256 sobre `<ts>.<cuerpo>`, con tolerancia de unos minutos contra repeticiones), y cómo llega una
**reagenda** (lo esperable: un `invitee.canceled` marcado como reagendado y un `invitee.created` nuevo; si se
tratan como dos hechos independientes, la reagenda se ve como cancelación y no como movimiento de la cita).

**Piezas, con el molde del webhook de formularios (ADR 0055, 0058):**
- **Ruta** `POST /api/webhooks/calendly/<id opaco del programa>`, con su excepción en `proxy.ts` (la del
  webhook de formularios). El programa sale de la URL, nunca del cuerpo (ADR 0043).
- **Firma:** el `signing_key` de la suscripción se guarda por programa como **tercera excepción nombrada de
  secretos** (mismas reglas que el token, ADR 0057: lo escribe una sola función, no pasa por el molde ni por
  `change_log`, ninguna lectura lo devuelve). Sin firma válida, 401 sin tocar nada.
- **Cuerpo crudo y respuesta:** apenas la firma cuadra, el cuerpo va a `sobres_crudos` y, si algo falla después,
  se guarda el error y se responde 200, nunca 500 (ADR 0058: una entrega con firma buena nunca se pierde). Cada
  entrega, con su código y motivo, en `/ajustes/salud` (110).
- **Idempotente:** Calendly reintenta; la llave es la huella `calendly:<uuid del invitado>` que ya existe (052).
  Un evento repetido no duplica llamada ni mueve el deal dos veces.
- **Fuera de orden:** una cita que llega antes que el envío queda **suelta** y se reasigna cuando llega el envío
  (ya en el ticket); una cancelación de una cita que no conocemos se guarda y no inventa nada.
- **Efecto sobre el deal:** siempre por el emparejador (`lib/calendly/emparejar-llamada.ts`) y `moverEtapa()` con
  actor sistema: `invitee.created` → llamada (deal en 1, 2, 3, 9, 11 → Agendado); `invitee.canceled` → llamada
  `cancelada` (Re-agenda solo desde Agendado); `invitee_no_show.created` → `no_show`; `..deleted` → se desmarca.
  Una segunda llamada sobre un deal Atendido no lo hace retroceder. Un `rescheduled` mueve la fecha de la MISMA
  llamada, no crea otra.
- **Cómo se conecta:** un botón "Conectar Calendly" en la configuración del programa (gerente y developer) que,
  con el token del programa (ADR 0057), crea la suscripción por la API con la URL de producción y guarda el
  `signing_key`; y otro para ver/rehacer la suscripción. Necesita el dominio público de producción.
- **Pendiente de Michael:** confirmar que las cuentas de Calendly de **los dos programas** son plan Standard o
  superior; sin eso la API rechaza la suscripción.
- **Migración de arranque:** la propuesta de arriba (`miembros_programa.calendly_email`,
  `calls.calendly_host_email`, el CHECK de la suelta) más la columna del `signing_key` del programa. La genera y
  aplica la sesión principal con el ok de Mani.

---

## ✅ Migración 0038 aplicada (28-sep, sesión 43, ok de Mani): Alejo puede empujar el 096

`drizzle/0038_calendly-por-membresia-y-webhook.sql`, aplicada en producción (ref `hfqmiyiuyqapdsbywrag`) y en `main`.
Es aditiva y se validó contra los datos reales antes (las 15 llamadas de producción tienen deal).

- `miembros_programa.calendly_email` (texto, nulo) e índice único parcial `miembros_programa_calendly_idx` sobre
  `(program_id, lower(calendly_email)) WHERE calendly_email IS NOT NULL`. Guardar **en minúsculas y sin espacios**.
  La misma cuenta puede estar en dos programas; dos closers no pueden reclamarla en el mismo.
- `calls.calendly_host_email` (texto, nulo): quién hospeda la cita.
- `programs.calendly_signing_key` (texto, nulo): la clave con la que Calendly firma el webhook del programa (tercera
  excepción nombrada de secretos: solo la escribe una función, sin molde ni `change_log`, ninguna lectura la devuelve).
- **CHECK `calls_crm_con_deal`** (`deal_id IS NOT NULL OR origen <> 'crm'`): una llamada NATIVA del CRM nunca existe
  sin deal. 🩸 **Se aflojó respecto a la propuesta** ("la suelta es la única Call sin deal"): ese CHECK estricto
  rompía fixtures y, sobre todo, chocaba con la migración E7 (las llamadas históricas de leads que Mani decidió
  dejar sin deal —No interesado y Cerrado— no tendrían a qué colgarse). Se aprieta a `origen = 'calendly'` cuando
  termine E7 (082), con una migración; los datos ya lo cumplirían. La suelta de Calendly y `sheets` siguen pudiendo
  no tener deal.
- `users.calendly_email` (global) queda sin lector; se retira después.

**Lo que le falta al 096 (Alejo):** el escritor del emparejador (que llama al emparejador con `calendly_email` de la
membresía y guarda `calendly_host_email`), la ruta del webhook con la firma, el guardián "nadie cuelga una Call de
Calendly por fuera del emparejador", el botón "Conectar Calendly" que crea la suscripción por API y guarda la
`calendly_signing_key`, la pantalla de la llamada suelta (asignar a mano, con rastro) y la lectura de `calendly_email`
en el perfil de la closer, por programa. Y confirmar con Michael que las dos cuentas son plan Standard o superior.

## Avance 28-sep, noche (Alejo): el escritor, la migración y la cuenta por membresía

**Migración:** la mía se descartó al rebasar; manda la **0038 de Mani** (`0038_calendly-por-membresia-y-webhook.sql`,
arriba), con los mismos nombres de columna y además `programs.calendly_signing_key`. El código de abajo calza
con ella sin cambios.

**El escritor**, `lib/calendly/colgar-llamada.ts`:
- `registrarLlamadaDeCalendly(db, programId, cita)`: arma los candidatos (contactos de correo + la llave
  del lead, deals abiertos y vigentes), pregunta al emparejador y escribe. Colgada: la llamada, el dueño
  pasa a la host registrada (con nota del sistema si tenía otro) y, desde 1, 2, 3, 9 u 11, el motor la
  lleva a Agendado; en 4-7 es otra llamada. Suelta: la llamada sin deal. Idempotente por la huella
  (`huellaDeCita`, compartida con el 052). **Es lo que A5 va a llamar.**
- `asignarLlamadaSuelta(db, actor, { callId, dealId })`: quien `trabajaLeads` y ve el programa; el deal,
  abierto y del mismo programa; rastro con el actor; mismo efecto que la colgada automática.
- La llamada nace sin `closer_user_id`, como la del 052.

**El 052** guarda `calendly_host_email` y el deal es de la closer host registrada (al abrir, mover o
agregar la llamada).

**La cuenta de Calendly por membresía** (decisión de Alejo, 28-sep: solo administrador, elegida de la
lista que da el PAT):
- `lib/calendly/cuentas.ts`: `cuentasDeCalendly` (`GET /organization_memberships` con el token del
  programa) y `cuentasPorPrograma` para la pantalla (el token no sale del servidor; sin token o token
  rechazado, el error del programa se muestra).
- `asignarCalendlyDeMembresia` en `lib/catalogo/usuarios.ts`: el servidor vuelve a comprobar contra
  Calendly que la cuenta sea de la organización (422 si no), 409 si otra closer ya la tiene, `change_log`.
- `/ajustes/usuarios`: sección "Cuentas de Calendly por programa", una fila por membresía activa de
  quien trabaja leads, con selector; la cuenta con el mismo correo del login viene **sugerida** (no se
  guarda sola). El campo global "Correo de Calendly" salió del formulario; `users.calendly_email` queda
  sin lector y se retira después.

**Tests:** `calendly-colgar-llamada` (20), `calendly-colgar-guardian` (4, con helper nuevo
`tests/helpers/codigo-fuente.ts`), `calendly-cuentas` (8). Mordidos quitando la frontera de programa y el
cambio de dueño. Excepción nombrada en `tests/alcance-de-sesion.test.ts` para `colgar-llamada.ts` (lee
membresías para saber quién es la host, no para acotar una sesión). Suite 1.285, typecheck, lint y build
limpios.

**No se vio en navegador:** recorrido pendiente de `/ajustes/usuarios` contra producción.

**Falta del 096:** el webhook (A5) para cancelaciones, reprogramaciones y citas fuera del
formulario; el dropdown y el botón "buscar llamada" en pantalla (Inbox 071 y ficha 074, carril de Mani);
la suelta que se reintenta cuando llega el envío.

## Cierre de la sesión del 28-sep, noche (Alejo): qué falta para cerrar el 096

**Placeholders de los PAT (uno por programa):** en producción los dos viven en `programs.calendly_token`
y ya están cargados (verificado sin leer el valor); se cambian en `/ajustes/programas`. Para la base
local quedaron `CALENDLY_PAT_LOCAL_COMUNICARTE` y `CALENDLY_PAT_LOCAL_TACTICAL`, vacíos en `.env.local`
y documentados en `.env.example` y `docs/operations.md` §3 y §4.1; `scripts/seed-local.ts` lee de
`.env.local` solo esas dos llaves.

**Para cerrar, en orden:**
1. ✅ Mani aplicó su **0038** y el trabajo de Alejo quedó empujado a `main`.
2. Recorrido de `/ajustes/usuarios` en navegador (consola abierta, abrir cada selector) y vincular la
   cuenta de Calendly de cada closer en cada programa. Hasta entonces nadie es host registrada.
3. **El webhook** (A5 decidida por Mani: ver "A5: webhook" arriba), lo único de código que bloquea: sin él
   nadie llama a `registrarLlamadaDeCalendly`. La columna `programs.calendly_signing_key` ya existe (0038),
   falta quien la escriba ("Conectar Calendly"); cancelaciones y no-show, la reagenda que
   **mueve la fecha de la misma llamada** (hoy el escritor crea una llamada por uuid de invitado: el
   webhook tiene que reconocer la reagenda antes de llamarlo) y la suelta que se reintenta cuando llega
   el envío. Confirmar con Michael el plan Standard de las dos cuentas.
4. Decidir con Mani si "la suelta aparece en el Inbox", el dropdown y el botón "buscar llamada" se
   cierran aquí o pasan al 071 y al 074 (los backends ya existen: `asignarLlamadaSuelta`,
   `buscarLlamadaDelDeal`).

## Avance 28-sep, noche (Alejo): el webhook (A5) construido y la 0039 aplicada

- **Ruta** `POST /api/webhooks/calendly/<id del programa>` (en la lista pública de `proxy.ts`). Firma con
  `programs.calendly_signing_key`; sin firma buena, 404/401 sin tocar nada. Con firma buena el cuerpo va a
  `sobres_crudos` (`origen = 'calendly'`, sin fuente) y se responde 200 siempre. Cada entrega va a
  `entregas_webhook` y se ve en la salud del programa como "Calendly" (no como huérfana).
- **Lo puro**, `lib/calendly/evento-webhook.ts`: la firma (`t=<ts>,v1=<hex>` sobre `<ts>.<cuerpo>`, 5 min de
  tolerancia) y la lectura del evento. 🩸 **Sin confirmar contra una entrega real**: si difiere, se corrige ahí.
- **El efecto**, `lib/calendly/eventos-de-cita.ts`: `invitee.created` → `registrarLlamadaDeCalendly`; con
  `old_invitee` es **reagenda** y mueve la MISMA llamada (huella, fecha, host), en los dos órdenes;
  `invitee.canceled` (sin reagenda) y `invitee_no_show.created` → la llamada `agendada` pasa a
  `cancelada`/`no_show` y el deal de Agendado a Re-agenda (T8); `invitee_no_show.deleted` lo deshace (T6). Una
  llamada que ya no está `agendada` no se pisa. Idempotente.
- **La suelta que se reintenta:** `adoptarSueltaDeCita` (en el escritor); el 052 la adopta al llegar el envío en
  vez de chocar con la huella.
- **"Conectar Calendly" / "Rehacer webhook"** en `/ajustes/programas`: `lib/calendly/suscripcion.ts`, único
  escritor de la clave (guardián en `tests/calendly-suscripcion.test.ts`). La clave la genera el CRM; la URL sale
  de `AUTH_URL` (solo https). Un 403 de Calendly dice "plan Standard".
- 🩸 **Fuga tapada:** `sinToken` (`lib/catalogo/programas.ts`) no quitaba `calendly_signing_key`; ahora sí, y
  expone `webhookCalendlyConectado`.
- **Migración 0039** (ok de Mani, aplicada en producción): `sobres_crudos.source_id` nulo, `program_id` (rellenado
  desde la fuente: 37 sobres) y `origen`, con CHECK. Los sobres de Calendly todavía no se reprocesan desde la
  pantalla.
- **Tests:** `calendly-evento-webhook`, `calendly-webhook-ruta` (ruta real firmada contra PGlite; mordido quitando
  la huella de la reagenda y la adopción), `calendly-suscripcion`. Suite 1.335.

**Para cerrar:** apretar "Conectar Calendly" en los dos programas en producción, agendar una cita de prueba y
confirmar firma y payload; vincular las cuentas de las closers en `/ajustes/usuarios`; decidir con Mani si la
pantalla de la suelta y "buscar llamada" pasan al 071/074.

## ✅ Verificado en producción (29-sep, madrugada, Alejo)

- "Conectar Calendly" corrió en los **dos programas** (las cuentas admiten webhooks: el plan alcanza).
- **Firma y payload confirmados con entregas reales** (lo que el diseño pedía antes de fiarse): una cita de
  prueba en Comunicarte (`prueba.webhook+1@tucorreo.com`, host `info@eventoscomunicarte.com`) entró como
  `invitee.created` → 200 procesado, sobre sin error, llamada **suelta** `agendada` con fecha y host. Cancelada por
  la API con el PAT del programa → `invitee.canceled` (`rescheduled: false`) → 200 procesado y **la misma**
  llamada pasó a `cancelada`, sin crear otra.
- **Sin probar con una cita real:** reagenda y no-show (cubiertos por `tests/calendly-webhook-ruta.test.ts`).
- Queda en producción esa llamada suelta cancelada, de prueba; no cuenta en ninguna métrica (sin deal). Borrarla
  pide el ok de Mani.

## ✅ Decisión 29-sep (Mani y Alejo): quién vincula la cuenta de Calendly

- La cuenta de Calendly de cada closer, por programa, **la asigna un administrador** en `/ajustes/usuarios` (como
  ya está construido). Puede ser una cuenta **compartida o personal**: la que la closer tiene registrada para
  recibir llamadas. Así se sabe de quién es la cita y el deal queda a esa closer (Mani).
- Consecuencia: una cuenta solo puede ser de **una** closer por programa (índice `miembros_programa_calendly_idx`).
- Maru no tiene usuario todavía; se crea desde la app (no por código) con su correo.

## Estado consolidado (29-sep, sesión de Mani)

**Código: completo y live.** El webhook trae las citas solo (agenda, reagenda, cancelación, no-show); no hay
que apretar nada para actualizar llamadas. Verificado en producción con una cita y una cancelación reales.

**Para marcarlo done (en orden):**
1. Decidir con qué cuenta de Calendly recibe llamadas cada closer en cada programa (closers, `plan.md` §7.B).
2. Crear el usuario de Maru desde `/ajustes/usuarios` y vincular las cuentas ahí (administrador). Mientras
   no estén, toda cita entra **suelta**.
3. Decidir K2: dónde se asigna la llamada suelta (aquí, 071 o 074).
4. Opcional: una reagenda y un no-show con una cita real (hoy solo en tests).

**Decisiones abiertas que lo tocan** (`plan.md` §7): K1 ("buscar llamada" en la Ficha del Deal como respaldo
o se retira), K2 y K3 (la llamada de prueba en producción).

## ⏸️ En pausa (29-sep, sesión 46 de Alejo): sin acceso a Calendly

Lo que se aclaró, para retomarlo:
- **Cuentas dueñas de cada organización** (las del token del programa, no de una closer):
  Tactical `jvieira@ttrading.co` · ComunicArte `info@eventoscomunicarte.com`. No se vinculan a ninguna
  closer, salvo que una atienda desde ahí.
- **Andrea** es la closer que ya está en el CRM. **Maru** usa `soymarumarquez@gmail.com`.
- **Pendiente de confirmar:** Alejo cree que el correo de Calendly de cada closer es **distinto** del de su
  usuario en el CRM. El selector de `/ajustes/usuarios` ofrece los miembros de la organización del programa
  (`GET /organization_memberships`); si la cuenta de una closer no aparece, primero hay que invitarla a esa
  organización desde la cuenta dueña. Falta: en qué programa(s) atiende cada una y con qué cuenta host.
- **Todas las decisiones de Calendly quedan para después** (los pasos 1 a 4 de arriba, K1, K2, K3): hoy no
  hay acceso a las cuentas. Mientras tanto toda cita entra **suelta**, que es el comportamiento diseñado.
