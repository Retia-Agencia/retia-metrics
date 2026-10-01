# Reparto en paralelo: Mani y Alejo

> **Complemento de [`plan.md`](./plan.md), no reemplazo.** Qué se construye y cómo lo dicen el plan, los
> tickets y los ADR, y mandan ellos: si algo aquí contradice un ticket o un ADR, gana el ticket o el ADR
> y este documento se corrige. Lo único que agrega es **el orden para que dos personas trabajen en
> paralelo** sin pisarse. El estado de cada ticket sigue viviendo solo en
> [`tasks/README.md`](./tasks/README.md).
>
> Escrito el 28-sep-2026 sobre `main @ 6ad90ab`, leyendo los 53 tickets abiertos contra el plan y el
> código.
>
> 🎯 **30-sep: el norte comercial de Gerencia es la prioridad** ([`comercial.md`](./comercial.md)). Cambia
> las etapas del deal, el dinero y las metas, y pone la pauta después de la v1 comercial: las etapas de §4
> se reordenan en su paso 6. Mientras tanto, **el `--aplicar` del 078 espera** a que se cierren las etapas.
>
> **Quién es quién:** "Alejo" en este documento es **Alejandro Dávila**, dev (`alejandrod-24`). El Alejo
> gerente de [`overview.md`](./overview.md) §4 es **Alejo Carvajal**, que aquí solo aparece como quien
> decide áreas y umbrales.

---

## 1. La regla

- **Las etapas van en serie.** No se abre la etapa N+1 hasta que la N cierre, y cerrar significa que
  **todo** quedó en `main`: el código de los dos carriles, la migración, los tickets, el tracker y el
  handoff (§6). Lo que no está en `main` no existe para la etapa siguiente.
- **Dentro de una etapa hay dos carriles en paralelo**, uno por persona, sobre archivos distintos.
- **Dentro de un carril sí hay orden** (057 → 058 → 059: es la misma persona). Lo que no existe es que un
  carril espere al otro en la misma etapa.
- **Solo se construye sobre `main`.** Un carril usa únicamente lo que ya se mergeó en una etapa
  anterior, nunca el trabajo a medias del otro. Así, cuando alguien usa una pieza, ya está revisada y
  probada.

Tamaño estimado por ticket: **S** pequeño, **M** mediano, **L** grande. Es relativo, para equilibrar
los carriles; no son días. Se re-mide al cerrar cada etapa y se rebalancea la siguiente.

---

## 2. Los carriles: cada uno, su dominio

| Carril | Dominio | Carpetas de las que es dueño |
|---|---|---|
| **Mani** | motor, dinero y pantallas de trabajo | `lib/deals/`, `lib/crm/`, `lib/abonos/`, `lib/queries/saldo.ts`, `lib/queries/dashboard.ts`, pantallas de Deals, Inbox y Dashboard |
| **Alejo** | entradas, historia de Sheets e integraciones | `lib/ingesta/`, `lib/sheets/`, `lib/calendly/`, `app/api/webhooks/`, `lib/nav.ts`, `lib/auth/`, scripts de traslado y migración |

**Por qué por dominio:** cada uno lleva su dominio del backend a la pantalla, así una sola cabeza decide
el contrato de cada pieza y la pantalla que la usa. Mani toma el motor, el dinero y las pantallas porque
ahí están las decisiones de producto que quiere tomar él (consultando a Alejo cuando haga falta). Alejo
toma las entradas y las integraciones, que son las que menos decisiones de producto piden.

- **Descartado, uno backend y otro pantallas:** el de pantallas espera en cada etapa, y el contrato de
  cada función lo interpretan dos personas distintas.
- **Descartado, el ticket suelto a quien esté libre:** trae choques de archivos y de migraciones. Pasó
  el 27-sep con E2 (handoff, CIERRE 33).

Mani además coordina, decide (§7) y aplica las migraciones, así que su carril es el más cargado. Si una
etapa se le aprieta, lo primero que pasa a Alejo es lo que no decide producto (consultas de reportes,
tickets de lectura), nunca el motor.

Tocar una carpeta del otro se pide antes. Los archivos compartidos tienen reglas propias (§5).

---

## 3. Correcciones al grafo que este orden asume

Sin estas correcciones el paralelo no es posible o algo se rompe en silencio. **Se aplican en los
tickets en la etapa 0, con el ok de Mani**; hasta entonces mandan los tickets como están.

✅ **Aplicadas el 28-sep con el ok de Mani**, y creados 111, 112 y 113.

| Ticket | Hoy dice | Propuesta | Por qué |
|---|---|---|---|
| [069] | depende de 065 | depende de 057 y 097 | con 065 los closers no operan hasta tener la analítica, y eso contradice el orden P1 (`plan.md` §5); la revisión del 22-sep (P1) ya lo recomendaba |
| [074] | depende de 073 (→ 072 → 069) | depende de 069 y 060 | la ficha del deal es del paso 4 y colgaba de dos pantallas del paso 6 |
| [070] | depende de 069 y 085 | depende de 069 | 085 es del paso 5. El closer ya ve el origen con los UTM tal como llegaron (ADR 0044); la etiqueta de área se enciende sola cuando exista el 085 |
| [077] a [081] | 077 depende de 075 | 077 depende del traslado (111) y de las mutaciones de E4; se corren en el corte del hito B | sin lo abierto de hoy (Setteo, agendados, estudiantes con saldo) los closers llegan al CRM sin su pipeline y trabajan en dos herramientas |
| [064] | después del hito B | antes del hito B | `lib/queries/dashboard.ts` cuenta cierres con `calls.resultado = 'cerrada'` y filtra por `calls.closer_id` de texto; cuando los closers registren en el CRM saldría una cifra creíble y equivocada |
| [048], [049] | "Done cuando" habla del sync | cierran con el traslado (111) | el sync se retiró el 28-sep (108) |
| [086] | tracker: 048, 084 · archivo: 048, 084, 092 | 085 y 092 | alinear las dos fuentes |
| Typeform deja de escribir en Sheets | desde el hito B (`plan.md` §5) | después de 066 y 067 | la pestaña Urgencias, que el equipo mira a diario (066), vive en la hoja |

**Tickets que faltan** (los números son el siguiente libre; se confirman al crearlos):

| # | Qué | Por qué |
|---|---|---|
| 111 | **Traslado de leads y envíos desde Sheets**, una vez, por `ingerirEntradas`, con el Estado como lo escribió la hoja. Incluye las 55 de Forms viejo ([079]) | `plan.md` §4.3d lo nombra sin número. Producción solo tiene los leads del webhook desde el 28-sep |
| 112 | **CI**: `npm ci`, test, typecheck, lint y build en cada push y PR; **sin** proteger `main` (Mani, 28-sep) | no existe `.github/`, y `main` despliega a producción en cada push (ficha R4 de `plan.md` §7.1) |
| 113 | **Base local para desarrollar pantallas** (si Mani la aprueba): Postgres con todas las migraciones y datos de ejemplo; la misma receta corre en el CI | la única base es producción (ADR 0047, enmienda): cada clic de prueba al construir el Kanban o el Inbox escribiría ahí. R5 pedía Playwright "contra `dev`", que ya no existe. No es otro proyecto de Supabase |

---

## 4. Las etapas

| Etapa | Nombre | Hito al cerrar |
|---|---|---|
| E0 | Terreno para dos | · |
| E1 | El deal registra llamadas y la historia entra | · |
| E2 | El dinero mueve el deal; Calendly y la navegación | · |
| E3 | El Kanban y la migración ensayada | · |
| E4 | Inbox y Students | · |
| E5 | Dashboard sobre deals, vista interina de Pauta y corte | **Hito B**: los closers operan en el CRM |
| E6 | De dónde viene cada lead (ola 1 de Pauta) | **Hito C** ([082]) durante la etapa |
| E7 | Lo que cuesta y lo que vende la pauta (ola 2) | Sheets fuera: Typeform deja de escribir ahí y se borra el Apps Script |
| E8 | El dashboard completo | · |
| E9 | Revisión cruzada | v1 completo |

El hito A (los leads entran solos) se cumplió el 28-sep. El 082, que `plan.md` §1 pone como línea de
llegada, pasa a caer en E6: con la migración antes del hito B ya no espera a la analítica.

**29-sep: E6 a E8 se rehicieron con la reunión con Pauta** ([`analytics.md`](./analytics.md) §7; tickets
116 a 126). Mani: *"lo antes posible, sin fechas, estructurado"*. Dos consecuencias para el orden:

- **El corte (hito B) deja de frenar las etapas de código.** Espera decisiones de afuera (la fecha con los
  closers, S1), no código. Cuando el código de E5 está en `main`, E6 abre aunque el corte siga pendiente; el
  corte se hace en cuanto esas dos cosas estén. La ola 1 de Pauta (envíos, agendas, gasto) no depende de él.
- **Lo que no se puede reconstruir va antes que todo** (ola 0 de `analytics.md`: campo oculto `utm_id`,
  plantilla de UTM en Meta, token de Meta, columna de origen en las hojas, crear la C3). Es configuración:
  corre desde ya, fuera de los carriles.

### E0 · Terreno para dos

Que trabajar de a dos no dependa de la memoria de nadie.

| Mani | Alejo |
|---|---|
| Aplicar §3 en los tickets y el tracker; crear 111, 112 y 113 · M | ✅ 112 · CI en cada push (sin proteger `main`) · M |
| Refrescar `plan.md` §2 y `AGENTS.md` (lista abajo) · S | 113 · base local, si se aprueba · M |
| Ops: quitar `CRON_SECRET` y `SHEET_ID_*` de Vercel (108); cargar a Andrea ([007]) · S | Plantilla de PR con el checklist de contratos de `AGENTS.md` · S |
| Agendar a Michael ya; después closers, Gerencia y Pauta (§7) · S | Cerrar [105]: forjar la acción desde una sesión de closer · S |

- **Docs que hoy se contradicen:**
  - `AGENTS.md` dice que `npm ci` falla por el lock y `plan.md` §2 dice que se reparó el 27-sep. El CI
    lo resuelve midiendo.
  - `plan.md` §2 dice 867 tests y 33 migraciones (hoy son 1.068 y 36).
  - `plan.md` §5 y §6 hablan de `dev` y de una producción que "todavía no existe".
  - [068] describe corridas de sync.
  - [082] dice que el Apps Script sigue haciendo falta, y el ADR 0054 dice lo contrario.
- **Migración:** ninguna.
- **Decidir antes de E1:** §3, y si va la base local.
- **Sale cuando:** el CI corre en verde sobre `main`; este orden y §3 están en `main`. ~~Un PR real pasa
  el CI y lo aprueba el otro~~: fuera por decisión de Mani (28-sep, velocidad; ver §5).

### E1 · El deal registra llamadas y la historia entra

Backend puro.

| Mani | Alejo |
|---|---|
| [057] · M | [110] · M |
| → [058] · S | → 111 traslado (incluye [079]; cierra [048], [049] y la parte de datos del [050]) · L |
| → [059] · S | |

- **Migración de arranque:** `calls` gana dueño como usuario y link de Grain (057, 058); tabla de
  entregas del webhook (110).
  ✅ 28-sep: la parte de `calls` salió sola como **0036** (aplicada, ok de Mani) para que el carril de
  Alejo construya sobre `main`; la tabla del 110 va en la 0037.
- **Decidir antes:** nada bloquea. "Grain o sucedió" ([058]) se valida con closers sin frenar el código.
- **Prueba de costura:** un envío firmado abre el deal, se agenda, se pega el Grain y el deal queda en
  Atendido. Un lead del traslado que vuelve a llenar el formulario no se duplica.
  ✅ 28-sep: `tests/costura-e1.test.ts` (los dos casos, y el inverso: webhook primero, hoja después).
- **Sale cuando:** el traslado corrió en producción con el ok de Mani y la conciliación del 110 marca
  cero faltantes.
  ✅ **E1 cerrada el 28-sep (sesión 43).**

### E2 · El dinero mueve el deal; Calendly y la navegación

| Mani | Alejo |
|---|---|
| [060] (recrea el test de saldo centralizado) · L | [097] · M |
| → [061] · S | → [096] · L |
| → [063] · M | |

- **Migración de arranque:** cuenta de Calendly por membresía y datos de la llamada suelta (096).
- **Decidir antes:** D3 de `plan.md` §7.1 (¿un deal en Abonado ocupa el cupo del lead?) · ~~A5 (webhook o
  consulta de Calendly, Vercel Pro)~~ ✅ webhook, Mani 28-sep; falta confirmar el plan de Calendly (Standard o más) · de quién es el deal si el lead agenda con otra
  closer.
- **Prueba de costura:** una cita de Calendly cae en su deal, el Grain lo pasa a Atendido, un abono a
  Abonado, el que salda a Completo, y anular ese abono lo devuelve.
  ✅ 28-sep: `tests/costura-e2.test.ts` (webhook con cita vigente → Grain → dos abonos → cartera y estudiantes →
  onboarding → anular ambos, con el historial completo). **Estado al 29-sep:** 097 cerrado; del 096 el
  código está completo y live (webhook verificado en producción, migraciones 0038 y 0039 aplicadas). **E2
  cierra** cuando Mani vincule las cuentas de Calendly de las closers y cree a Maru en `/ajustes/usuarios`;
  K2 ya está decidida y resuelta por 071 (`plan.md` §7). El cierre de 096 pasa al carril de Mani.

### E3 · El Kanban y la migración ensayada

| Mani | Alejo |
|---|---|
| [069] · L | [077] · M |
| → [074] · L | → [078] · M |
| | ~~→ [081]~~ descartado (28-sep, Mani: solo USD) |

- **Migración de arranque:** lista de lo no clasificable (080). ~~Marca de abono convertido (081)~~: descartada, solo USD.
- **Decidir antes:** ~~A4 (cómo se prueba la UI)~~ ✅ 28-sep: usándola, Mani · ~~hasta cuántos días atrás vale migrar Setteo~~ (✅ 28-sep, Mani: lo trabajado + los últimos 30 días; parámetro para TOTAL) ·
  ~~la tasa COP→USD~~ (✅ descartada: solo USD) · ~~qué gana cuando los consolidados de C2 y la hoja difieren~~ (✅ la hoja, Mani 28-sep).
- **Prueba de costura:** los deals del ensayo aparecen en el Kanban y se mueven por el motor, con el
  requisito que falta a la vista.

### E4 · Inbox y Students

| Mani | Alejo |
|---|---|
| [070] · M | [080] · L |
| → [071] · L | → [099] · M |

- **Migración de arranque:** la pregunta de ingreso por fuente y sus bandas (070).
- **Decisiones cerradas:** el score lo calcula el formulario por programa y el CRM solo lo recibe;
  no hay lógica de ingreso ni bandas en el CRM. La alerta de deal sin actividad usa 3 días hábiles por
  defecto y es configurable. Students muestra deals en `abonado` o `completo`, con su lead, por cohorte
  y programa; el onboarding lo marca el closer dueño, gerente o developer.
- **Prueba de costura:** recorrido en celular sobre la base local: reclamar un Setteo, agendar, pegar el
  Grain, registrar el abono. Consola abierta, clic en todo lo que se abre.

### E5 · Dashboard sobre deals y corte

| Mani | Alejo |
|---|---|
| [064] · L | [062] · S |
| → [098] · M | → [072] (cierra el [050]: separar y confirmar duplicados; **también lo usa el closer**, ADR 0060) · M |
| → [115] (el origen es del envío, ADR 0060) · M | → guion del corte, capacitación y plan de reversa · M |
| → [093] vista interina de Pauta (29-sep: lo primero que se entrega a Pauta, sin migración) · S | |

- **Ola 0 de Pauta, fuera de los carriles y desde ya** ([`analytics.md`](./analytics.md) §7): O-1 campo
  oculto `utm_id` en los dos Typeform (ok de Mani), O-2 plantilla de UTM en Meta (Pauta, después de O-1),
  O-3 token de Meta (Anderson), O-4 columna "origen del deal" en las hojas (Mani o Dani con los closers),
  O-5 crear la C3 de cada programa (gerente), ~~O-6 confirmar el parche de Tactical con un envío real~~ ✅ 29-sep.

- **Migración de arranque:** la tasa de comisión del programa (062).
- **Decidir antes:** ~~precio de lista de ComunicArte~~ ✅ 797 · la fecha del corte (closers) · 🚨 **Supabase Pro
  (S1, `plan.md` §7): sin él no hay respaldos, y desde el corte la historia vive solo en esa base** (equipo).
- **Costura del 115 con el carril de Alejo (29-sep):** el 115 toca `lib/ingesta/regla-de-deals.ts`, que es
  del carril de Alejo, así que ese cambio va con su ok. Y el importador del 078 tiene que pasar
  `submissionOrigenId` al abrir cada deal histórico (el envío más reciente del lead): **antes de aplicar la
  migración en el corte**, o los deals migrados nacen sin origen.
- **El corte, que es la salida de la etapa y el hito B** (el guion completo, la capacitación y la reversa
  viven en [`operations.md`](./operations.md) §12):
  0. S1 decidido (Supabase Pro o no, con un respaldo manual si es no).
  1. Ensayo final de la migración en la base local con las hojas del día.
  2. Los closers dejan de escribir en las pestañas de gestión por unas horas; la migración corre en
     producción con el ok de Mani.
  3. Conciliación y lista de rarezas revisadas contra la hoja.
  4. Closers con cuenta, membresía y Calendly por programa; recorrido de su día en el celular.
  5. Desde ese día se registra solo en el CRM. Las pestañas quedan de respaldo hasta el 082.

### E6 · De dónde viene cada lead (ola 1 de Pauta)

| Mani | Alejo |
|---|---|
| [083] · S | [116] · S |
| → [101] (con los pares medidos el 29-sep y `paid_social`) · M | → [117] (va después del [115]: los dos tocan `regla-de-deals.ts`) · M |
| → [085] (lee `utm_id`; macro sin expandir; nivel de la traza) · M | → [119] · M |
| → [087] (va con el 085, nunca después) · S | → [120] · L |
| → [121] · M | → [102] · M |
| → [118] · S | [082] cuando el equipo lleve días operando solo en el CRM (propuesta: una semana hábil) = **hito C** · S |
| → [089] · M | |

- **Migración de arranque:** una sola, aditiva: áreas, canales, `submissions.utm_id`, `estados_llegada`,
  `deals.area_declarada_id`, `meta_conexiones`, `cuentas_publicitarias`, `pauta_objetos`, `gasto_pauta` (y
  se retira `ad_spend`, vacía) y el valor `paid_trafficker`. Con DP-25 aprobado, `utm_patron` no se crea.
- **Decidir antes:** PQ1 (Pauta: cuentas, moneda y zona
  horaria) · PQ7 (Gerencia: nombre visible de cada área) · el token de Meta (Anderson) · dónde vive el token
  de Typeform ([126]).
- **Prueba de costura:** un envío `ig / paid_social` con `utm_id` resuelve a su área (Pauta), su anuncio, su
  conjunto y su campaña, con el gasto de ese anuncio; un parcial `con_calendly_sin_agenda` abre el deal en
  Setteo con prioridad alta y su completa con cita lo pasa a Agendado; "sin UTM" y "sin clasificar" salen
  separados, con conteo.
- **Después, en producción (ola 0, O-7):** punto parcial antes del Calendly, valor `con_calendly_sin_agenda`
  y evento `form_response_partial` en el webhook. **Solo cuando el 117 esté en producción.**

### E7 · Lo que cuesta y lo que vende la pauta (ola 2)

| Mani | Alejo |
|---|---|
| [122] · M | [126] · M |
| → [123] · L | → [088] · M |
| | → [066] · M |
| | → [067] (captura manual del gasto de otras plataformas y ROAS por cohorte) · M |
| | → [065] · M |

- **Migración de arranque:** `objetivos` y `programs.valores_calificados`.
- **Decidir antes:** DP-23 y DP-24 (Mani) · PQ3 y PQ4 (Pauta: conversión, ritmo, desfase y objetivos) ·
  PQ5 (Gerencia: cortesías). ROAS y Juanito ya respondidos (Mani, 28-sep).
- **Prueba de costura:** una venta de un anuncio con gasto cargado sale en su área, su campaña y su anuncio,
  con su costo por venta y su ROAS a la TRM de la cohorte, igual en la consulta del 123 y en el 088.
- **Al cerrar:** Typeform deja de escribir en Sheets y se borra el Apps Script.

### E8 · El dashboard completo

| Mani | Alejo |
|---|---|
| [124] · L | [092] (el builder solo para orgánico y closer) · M |
| → [125] · M | → [086] · M |
| → [095] · M | → [068] (reescribir su alcance: el sync ya no existe) · S |
| → [090] · L | → [076] · S |
| | → [100] · M |
| | → [021] · M |

- **Migración de arranque:** ninguna prevista.
- **Decidir antes:** PQ6 (Pauta y Media: convención del orgánico) y los umbrales que falten (Gerencia). No
  bloquea: el 090 y el 124 muestran el supuesto que usan.
- **Prueba de costura:** "todos los programas" solo suma lo sumable (test de tipo) y cuadra con la suma de
  cada programa; el ROAS de una campaña cuadra entre la tab Campañas y el Dashboard.

### E9 · Revisión cruzada y cierre de v1

El [075] se parte en dos y cada uno revisa lo que construyó el otro.

| Mani | Alejo |
|---|---|
| [073] · M | [035] · M |
| → [091] · S | → 075: revisa las pantallas que hizo Mani · M |
| → 075: revisa las pantallas que hizo Alejo · M | |

- **Decidir antes:** cómo mandan el comprobante los closers (foto, link o PDF).
- **Sale cuando:** criterio de UI escrito y recorrido completo en celular y escritorio.

---

## 5. Cómo se trabaja en paralelo

Las reglas de `AGENTS.md` siguen todas. Estas se suman porque ahora son dos personas:

- **Una migración por etapa, al arrancar.** La escribe quien más la necesita, la revisa el otro y la
  aplica Mani (dueño de la base) antes de que arranquen los carriles: aditiva, compatible con el código
  anterior y con el SQL leído línea por línea.
  - Si a mitad de etapa hace falta otra, se avisa, y el otro no genera ninguna hasta que esté en `main`.
    Así no se repite la 0024, que existía en la base y no en el repo (handoff, CIERRE 32).
- **Sin protección de `main` ni PR obligatorio (Mani, 28-sep: *"no quiero nada complejo, necesitamos
  velocidad de implementación"*).** Se empuja directo a `main` con test, typecheck, lint y build
  corridos en local; el CI corre en cada push como **alarma, no como reja**, y un CI en rojo se arregla
  antes de seguir. El cadenero de `AGENTS.md` sigue: quien no escribió el código lo revisa contra el
  "Done cuando" y los contratos, en un PR si ayuda o sobre el commit.
  - Si implementó un agente (Kiro, Codex), quien revisa corre `npm test` completo: Kiro ya reportó
    "todo limpio" con un guardián en rojo.
- **Una prueba de costura por etapa:** un test que cruza los dos carriles (en cada etapa de §4).
- **Reclamar antes de tocar.** El commit de arranque de cada etapa marca en el tracker "en curso · Alejo"
  o "en curso · Mani". Antes de tomar cualquier cosa, `git fetch`.
- **Archivos compartidos:**

  | Archivo | Regla |
  |---|---|
  | `lib/db/schema.ts` y `drizzle/` | solo la migración de arranque |
  | `docs/tasks/README.md`, `docs/agents/handoff.md`, `docs/plan.md` y este documento | solo Mani, al abrir y al cerrar la etapa |
  | cada ticket | su dueño escribe su estado y su nota de cierre ahí durante la etapa |
  | `lib/crm/rastro.ts`, `lib/auth/roles.ts` | un cambio se pide y lo aprueba el otro |

- **Si un carril termina antes:** no toma nada de la etapa siguiente. En este orden: revisa los PR del
  otro, prepara la migración y los tickets de la etapa siguiente, y baja deuda del tracker.
- **Si un carril se atrasa mucho:** se parte la etapa. Lo terminado sube a `main` y lo pendiente pasa a
  la siguiente, revisando sus dependencias. Nunca se abre una etapa con la anterior a medias.
- **Pantallas y permisos:**
  - Toda pantalla se prueba en la base local haciendo clic en todo lo que se abre, con la consola
    abierta y en celular.
  - Todo permiso se prueba forjando la petición.
  - Tinta es obligatorio (`structure.md` §9).

---

## 6. Cerrar una etapa: "todo anotado en `main`"

Si falta una casilla, la etapa no cierra.

- [ ] Cada ticket de la etapa tiene su "Done cuando" marcado, `status: done` y una nota de cierre (qué se
      hizo, qué se decidió, qué quedó).
- [ ] Los dos carriles están en `main` con CI verde, y el deploy de producción es el commit correcto
      (`vercel ls` + `vercel inspect`).
- [ ] La prueba de costura existe y pasa.
- [ ] La migración está en `drizzle/` y se aplicó en producción con el ok de Mani, antes del deploy.
- [ ] El tracker está al día, con una sola entrada de handoff por etapa. La escribe Mani con las notas de
      cierre de los tickets, así el handoff no choca.
- [ ] Hay un ADR por cada decisión de arquitectura de la etapa, y la decisión salió de `plan.md` §7.
- [ ] `AGENTS.md` está al día si cambió un comando o una convención.
- [ ] Producción está sana: `/ajustes/fuentes` dice "recibiendo" y no hay sobres crudos con error.
- [ ] Las decisiones que necesita la etapa siguiente (§7) están cerradas.

---

## 7. Las decisiones, por etapa

Son las de [`plan.md`](./plan.md) §7, ordenadas por cuándo frenan. Propuesta: una sola reunión con los
closers durante E1 que cubra E2 a E5; Gerencia durante E4; Pauta durante E5.

| Antes de | Qué | Quién |
|---|---|---|
| E1 | §3 de este documento; base local sí o no (113) | Mani |
| ~~E1~~ | ~~ROAS, Juanito, consolidados de C2~~ ✅ respondidas por Mani el 28-sep (`plan.md` §7.E) | Mani |
| E2 | ~~D3 · A5~~ ✅ · K2 (dónde se asigna la llamada suelta, `plan.md` §7) | Mani |
| ~~E2~~ | ~~De quién es el deal si agenda con otra closer~~ ✅ de esa closer (Mani, 28-sep) | Mani |
| E3 | ~~A4~~ ✅ · ~~tasa COP→USD~~ ✅ descartada, solo USD | Mani |
| E3 | ~~Hasta cuántos días atrás migrar Setteo~~ ✅ decidido por Mani · K1 ("buscar llamada" en la Ficha del Deal o se retira) | Mani |
| E4 | ~~Pregunta de ingreso y bandas~~ ✅ score del formulario; ~~X días~~ ✅ 3 días hábiles por defecto configurable; ~~estudiante desde cuándo~~ ✅ abonado o completo por cohorte/programa; ~~quién hace onboarding~~ ✅ dueño, gerente o developer | Closers / Mani |
| E5 | ~~Precio de lista de ComunicArte~~ ✅ 797 (Mani, 28-sep) · fecha del corte | Closers |
| E5 | 🚨 Supabase Pro, por los respaldos (S1) | Equipo |
| E6 | Área de cada canal y su nombre visible (PQ7) · ~~caja y comparativo para el paid trafficker~~ ✅ DP-12 · ~~P2~~ sin objeto · ~~D5~~ ✅ · ~~DP-25~~ ✅ | Gerencia · Mani |
| E6 | Cuentas publicitarias, moneda y zona horaria (PQ1) · token de Meta · ~~`utm_id` y `fbclid`~~ ✅ `utm_id` por macro (ADR 0062) | Pauta |
| E7 | Conversión, ritmo, desfase y objetivos (PQ3, PQ4) · cortesías (PQ5) · checkouts · el 26% sin UTM de Tactical | Pauta · Mani · Gerencia |
| E8 | Convención del orgánico (PQ6) · umbrales que falten (no bloquea) | Pauta y Media · Gerencia |
| E9 | Formato del comprobante | Closers |

---

## 8. Mantener este documento

- Cambia solo si cambia el orden o el reparto. El avance de cada ticket no se anota aquí: va en el
  tracker.
- Al cerrar una etapa, Mani revisa si la siguiente sigue siendo válida (tamaños, decisiones que
  llegaron tarde, dependencias nuevas) y la ajusta aquí, en el mismo commit del cierre.

[007]: ./tasks/007-onboarding-closer-id.md
[021]: ./tasks/021-snapshot-del-dashboard.md
[035]: ./tasks/035-comprobante-link-o-foto.md
[048]: ./tasks/048-una-sola-funcion-de-ingesta.md
[049]: ./tasks/049-el-envio-con-todas-las-columnas.md
[050]: ./tasks/050-identidad-del-lead.md
[057]: ./tasks/057-calls-colgadas-del-deal.md
[058]: ./tasks/058-grain-significa-que-la-llamada-sucedio.md
[059]: ./tasks/059-no-show-y-cancelada-van-a-reagenda.md
[060]: ./tasks/060-abonos-sobre-el-deal.md
[061]: ./tasks/061-cuotas-pactadas-y-cartera-vencida.md
[062]: ./tasks/062-comision-calculada.md
[063]: ./tasks/063-onboarded-at-y-cambio-de-cohorte.md
[064]: ./tasks/064-dashboard-sobre-deals.md
[065]: ./tasks/065-funnel-por-etapa.md
[066]: ./tasks/066-replica-de-urgencias.md
[067]: ./tasks/067-roas-por-cohorte-y-captura-de-pauta.md
[068]: ./tasks/068-nerd-stats-reescrito.md
[069]: ./tasks/069-kanban-por-programa.md
[070]: ./tasks/070-pendiente-setteo-y-unclaimed.md
[071]: ./tasks/071-mi-dia-del-closer.md
[072]: ./tasks/072-base-de-leads-con-filtros.md
[073]: ./tasks/073-ficha-del-lead.md
[074]: ./tasks/074-ficha-del-deal.md
[075]: ./tasks/075-revision-profunda-de-la-ui.md
[076]: ./tasks/076-bitacora-en-nerd-stats.md
[077]: ./tasks/077-barrer-las-pestanas-de-gestion.md
[078]: ./tasks/078-la-migracion-pasa-por-la-misma-ingesta.md
[079]: ./tasks/079-recuperar-las-55-de-forms-viejo.md
[080]: ./tasks/080-los-casos-raros-de-la-migracion.md
[081]: ./tasks/081-cop-a-usd-en-la-migracion.md
[082]: ./tasks/082-apagar-las-pestanas-de-gestion.md
[083]: ./tasks/083-catalogo-de-areas.md
[084]: ./tasks/084-campanas-y-el-patron-utm.md
[085]: ./tasks/085-el-emparejador-determinista.md
[086]: ./tasks/086-origen-humano-y-enlace-de-captacion.md
[087]: ./tasks/087-el-cpl-deja-de-preguntar-por-entrada.md
[088]: ./tasks/088-registros-vs-agendas-por-canal.md
[089]: ./tasks/089-series-con-dimensiones.md
[090]: ./tasks/090-rendimiento-por-area.md
[091]: ./tasks/091-otros-programas-del-correo.md
[092]: ./tasks/092-url-del-formulario-y-generador-de-links.md
[093]: ./tasks/093-filtros-utm-con-lo-que-ya-hay.md
[095]: ./tasks/095-dashboard-con-selector-y-todos-los-programas.md
[096]: ./tasks/096-calendly-cuelga-llamadas-de-deals.md
[097]: ./tasks/097-navegacion-por-objetos-y-selector-de-programa.md
[098]: ./tasks/098-tab-calls.md
[099]: ./tasks/099-tab-students-por-cohorte.md
[100]: ./tasks/100-tab-programs-ficha-del-programa.md
[101]: ./tasks/101-catalogo-de-canales.md
[102]: ./tasks/102-rol-paid-trafficker.md
[105]: ./tasks/105-la-fuente-webhook.md
[110]: ./tasks/110-la-salud-del-crm.md
[115]: ./tasks/115-el-origen-es-del-envio.md
[116]: ./tasks/116-las-utm-completas-en-el-envio.md
[117]: ./tasks/117-los-estados-de-llegada-por-tabla-y-los-parciales.md
[118]: ./tasks/118-se-perdio-en-el-calendly.md
[119]: ./tasks/119-la-conexion-con-meta.md
[120]: ./tasks/120-la-pauta-de-meta-por-anuncio-y-dia.md
[121]: ./tasks/121-el-area-declarada-por-el-closer.md
[122]: ./tasks/122-los-objetivos-de-la-cohorte.md
[123]: ./tasks/123-el-embudo-de-pauta-y-los-costos-por-etapa.md
[124]: ./tasks/124-el-cumplimiento-de-la-cohorte-por-area.md
[125]: ./tasks/125-la-tab-campanas-con-el-arbol-de-meta.md
[126]: ./tasks/126-el-embudo-del-formulario.md
