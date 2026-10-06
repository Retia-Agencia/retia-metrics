---
id: 086
etapa: E3
serves: "plan v2 §12.8 · ADR 0044 puntos 1 a 5"
depends: [085, 092]
status: done
---

# 086 — El origen humano del lead y el enlace de captacion del closer

## Objetivo

Que un lead traido por un closer deje rastro. Hoy **no lo deja**, y por eso "leads por area" mostraria
**Comercial en cero** sin lanzar un error.

## ⏳ Por que este ticket es de la etapa 3 y no de la 5

El dato lo escribe **la ingesta**, y la ingesta es el ticket 048. Escribirlo despues significa que los
leads que entren mientras tanto **no tienen origen y no se puede reconstruir**: *"este lead lo trajo
Maru"* no esta escrito en ninguna parte hoy. No es que este mal guardado — **no existe**.

## Alcance

- **Dentro:** `leads.traido_por_user_id`, **FK real a `users`**, nunca texto (ADR 0030).
- **Dentro:** la escribe **solo** la funcion de ingesta del 048, por los dos caminos, y **el primero
  que la escribe gana**: si Maru lo trajo y meses despues reaplica por Meta, sigue siendo de Maru.
- **Dentro:** el enlace de captacion, **por closer Y programa**, **calculado y no guardado** (ADR 0024:
  un enlace guardado y la fuente cambiada son dos verdades). Pantalla con boton Copiar.
  ⚠️ **Usa el generador del ticket 092, no reimplementa uno.** Y 092 es el que agrega
  `programs.form_url`, **sin el cual este enlace no se puede calcular**: el CRM sabe donde CAEN las
  respuestas (`sources.sheet_id`), no donde la gente LLENA.
- **Dentro:** el alta manual elige "traido por" de un **selector**, nunca escribiendo un nombre.
- **Fuera:** auto-asignar el owner del deal. **No se hace** (punto 5 del ADR 0044).
- **Fuera:** normalizar UTM (sigue fuera, ticket 066).

## Las reglas que no se rompen

- 🩸 **El closer NO teclea un UTM.** `Maru`, `maru`, `closer maru` y `Maru Marquez` serian cuatro
  closers en el reporte. El enlace lo genera el CRM, asi que nadie teclea.
- **El alta manual NO genera envio**, y no es una preferencia: `submissions.source_id` es `notNull` y
  una fuente "manual" activa la rechaza `sources_una_activa_por_programa_idx` (ADR 0039).

## Done cuando

- [ ] Un lead que entra por el enlace de un closer queda con `traido_por_user_id` poblado, con test.
- [ ] Un segundo envio del mismo correo por otra via **no pisa** el origen, con test.
- [ ] El enlace de un closer en dos programas da **dos URLs distintas**, y ninguna se guarda.
- [ ] Un alta manual queda con origen y **sin envio**, y el deal manual funciona (ADR 0037).
- [ ] `grep` confirma que ningun modulo fuera de la ingesta escribe `traido_por_user_id`.

## Kiro

Si, con revision. La regla de "el primero gana" es donde un bug es silencioso.

---

## Enmienda 2026-09-24 (ADR 0051): el closer va en `utm_content`

El enlace del closer es: `utm_source=closer`, `utm_medium=referido`, `utm_campaign=<campaña de
referidos del programa>`, `utm_content=<código opaco del closer>`. El código lo genera el CRM (nunca el
nombre) y el formulario ya captura `utm_content`: cero cambios en Typeform. Lo lee el emparejador
(ticket 085) y lo escribe la ingesta en `traido_por_user_id`. Resuelve la ficha P2 de la revisión del
22-sep.

## ⬇️ Reunión con los closers 2026-09-24 ([reunión con los closers del 24-sep](../overview.md), resumen en la propuesta §0): baja de prioridad

A la pregunta de si invitan gente o buscan leads propios, los closers dijeron que **no**. El diseño
sigue siendo correcto (y `traido_por_user_id` lo sigue escribiendo la ingesta si llega un link de
closer), pero el **enlace de captación** va al final de E1b, no antes que el resto. Que Comercial salga
en cero en "leads por área" es un dato real, no un bug.


---

## Enmienda 2026-09-28 (plan de reparto §3, ok de Mani)

Tracker y archivo decían dependencias distintas; quedan alineados en 085 y 092.

---

## Avance 2026-10-06 (Alejo + Claude): en código, la 0070 sin aplicar

**Decisiones (tomadas en la sesión, revisables):**
- **El código opaco se deriva, no se guarda:** los 12 primeros hex del sha256 de `captacion:<users.id>`
  (`codigoDeCaptacion`). Sin columna ni catálogo nuevo (ADR 0024, ADR 0077). Distinto de `codigoDeCloser` de las
  listas, que responde otra pregunta.
- **La campaña es una sola, `referidos`** (`CAMPANA_DE_REFERIDOS`): quién trajo al lead lo dice el código, no la campaña.
  `utm_source` y `utm_medium` salen del Canal con formato `closer` (en producción, `closer / referido`, área Referidos).
- **Un código solo acredita a un usuario activo con membresía ACTIVA en el programa del envío** (ADR 0043). El de
  alguien sin membresía ahí, desactivado, o uno que casara con dos, no acredita a nadie.
- **El alta manual NO escribe `traido_por`** (ADR 0044 punto 2: solo la ingesta). Queda con `entrada = crm`; si después
  aplica por el enlace de un closer, la ingesta lo acredita. El selector del ticket queda fuera hasta que haya un caso
  (los closers no traen leads propios, 24-sep). La primera versión ponía a quien lo creaba; el cadenero lo frenó porque
  contradecía el ADR.
- 🔴 **Para confirmar con Mani:** "el primero gana" es el primero que ESCRIBE. Un lead que entró por Meta sin código y
  después aplica con el enlace de un closer queda acreditado al closer (test lo fija).

**Hecho:**
- `leads.traido_por_user_id` (FK a `users`, `restrict`), migración **0070** con `lock_timeout`.
- `lib/atribucion/captacion-del-closer.ts`: el código, `closerDelCodigo`, `traidoPorDeEnvios` (puro: el envío más antiguo
  del canal closer con código que resuelve) y `enlacesDeCaptacion` (uno por programa activo con membresía activa, sobre
  `generarLink` y `destinoDeCaptacion` del 092; sin principal o sin canal, el motivo).
- Ingesta (`ingerirEntradas`, paso 7b `escribirTraidoPor`): escribe solo `WHERE traido_por_user_id IS NULL` (el primero
  gana, también ante un reintento o un webhook en paralelo); un lead que ya existía deja su fila en `change_log`.
- Inbox: "Traído por" en Agendados sin dueño, Por settear y "se perdió en el Calendly" (nombre o correo).
- Mi espacio: "Tus enlaces de captación", con Copiar, para quien trabaja leads.
- Tests (`tests/captacion-del-closer.test.ts`, 18; y "Traído por" en `tests/inbox-sin-dueno.test.ts`): el emparejador reconoce el enlace del generador y su código da el
  closer; primero gana (mordido quitando el `IS NULL`); frontera de programa; membresía inactiva; usuario desactivado; Meta y luego closer; el código en
  `utm_content` de otro canal no cuenta; alta manual sin envío ni traído por; dos programas, dos URL y nada guardado; guardián de
  escritores de `traidoPorUserId`. Typecheck, lint y build en verde.

**Done cuando:** 1 ✅ · 2 ✅ · 3 ✅ · 4 ✅ con origen `entrada = crm` (el deal manual sigue por `crearDealAMano`) · 5 ✅ (guardián: solo la ingesta).

**Hecho también:** cadenero (aprobado; sus hallazgos arreglados arriba) y **0070 aplicada en producción** con el ok de Mani, antes del push (72 migraciones).

**Falta:** confirmar con Mani la regla Meta → closer;
recorrido de Mi espacio en `dev:local`.
