---
id: 117
etapa: E6
serves: "ADR 0061 · docs/analytics.md PT-01, PT-02, PT-05, PT-06, PT-07"
depends: [115]
status: done
---

# 117 — Los estados de llegada por tabla, y los envíos parciales por el webhook

## Objetivo

Que la etapa donde nace un deal salga de una **tabla por programa** y no de valores fijos en el código, y
que el CRM reciba el envío parcial previo al Calendly para no perder a quien llegó ahí y no agendó.

## 🩸 Por qué ahora

El 29-sep una edición del Typeform de Tactical quitó la variable `estado` y ningún envío abrió deal
entre las 11:40 y las 20:11 (23 envíos, 9 con cita), sin un solo error (`docs/analytics.md` §2.4). Hay un parche en el Typeform; este
ticket lo vuelve innecesario.

## Alcance

- **Dentro:** tabla `estados_llegada` por el molde de `lib/catalogo/` (ADR 0012): `program_id`, `valor`
  (como lo manda el formulario), `etapa_entrada` (Pendiente Setteo, Agendado o ninguna), `prioridad`
  (normal o alta), `alerta_minutos` (nulo = sin alerta), `activo`; único `(program_id, lower(valor))`.
  Pantalla en `/ajustes/fuentes` o en la ficha del programa (100), para quien administra.
- **Dentro:** siembra por la función del catálogo con `actorDelScript()` (ADR 0029), para los dos
  programas: `setteo_no_calificado` → Setteo normal · `con_calendly_sin_agenda` → Setteo alta, 5 minutos ·
  `con_calendly` → Agendado · `descartado` → Setteo normal mientras un formulario lo mande (Mani: todo el
  que llena el formulario es contacto).
- **Dentro:** `aplicarReglaDeDeal` decide con la fila de la tabla. `estadoConAgenda` sube a `con_calendly`
  **cualquier** valor cuando la pregunta de agenda trae link (hoy solo desde `setteo_no_calificado`).
- **Dentro:** vacío o desconocido → lead sin deal, contado como "sin estado" en la salud de la fuente
  (107, 110) y visible en Leads. Nunca un deal adivinado.
- **Dentro:** el webhook acepta `form_response_partial`: el adaptador lo guarda como `es_parcial = true`
  (ADR 0036, índice de la 0022). Un parcial sin `estado` (el del WhatsApp) no abre deal. El parcial con
  `con_calendly_sin_agenda` abre el deal en Pendiente Setteo; la completa con cita del mismo token lo mueve a
  Agendado por la regla de siempre (lead con deal abierto en 1).
- **Dentro:** verificar con el primer parcial real qué trae el payload (campos ocultos y variables, sobre
  todo `lead_value`) y anotarlo aquí.
- **Dentro:** reprocesar los 23 envíos de Tactical del 29-sep sin estado (11:40 a 20:11), con la regla nueva y el ok de
  Mani; los 9 con cita adoptan su llamada suelta. 4 de esos 23 leads ya tienen deal por un envío anterior: la regla
  de siempre decide (lead con deal abierto).
- **Fuera:** el urgente del Inbox (118). La configuración del Typeform (tarea O-7 de `docs/analytics.md`
  §7), que va **después** de este ticket en producción.

- **A tener en cuenta:** desde el 29-sep los dos Typeform mandan también la variable `etapa` (`Setteo` /
  `Agendado`), aparte de `estado` (`docs/analytics.md` §2.2, O-8). Llega en `respuestas` como
  `variable:etapa`. Si la tabla `estados_llegada` va a leerla, se decide aquí; mientras no, se ignora.

## Las reglas

- La regla de etapa no compara números de etapa ni textos fijos: lee la fila (ADR 0012).
- `regla-de-deals.ts` es del carril de Alejo y lo toca también el 115 (Mani): va después del 115.

## Done cuando

- [ ] Un valor nuevo en la tabla abre deals en su etapa sin tocar código, con test.
- [ ] Un envío sin estado o con un valor desconocido no abre deal y se cuenta, con test.
- [ ] Parcial `con_calendly_sin_agenda` y luego su completa con cita: un lead, un deal, que termina en
      Agendado con su llamada; con test.
- [ ] Parcial sin estado: lead sin deal, con test.
- [x] Los 23 envíos reprocesados, verificado con una consulta.

## Kiro

Sí para el código y los tests, con revisión. La migración, la siembra y el reproceso en producción, la
sesión principal con el ok de Mani.

---

## Suma 2026-09-30: el B4 de la auditoría 114 entra aquí (Mani)

Los títulos de pregunta de los Typeform de hoy siguen escritos en el código: `MAPEO_FORMULARIO`
(`lib/sheets/mapeo.ts`) y `MAPEO_POR_DEFECTO` (`lib/ingesta/adaptador-typeform.ts`), que hacen de defecto
cuando ni la fuente ni `programs.plantilla_lead` dicen nada (`combinarMapeo`, `lib/sheets/plantilla-lead.ts`).
Como este ticket ya reescribe el adaptador, el cambio se hace aquí una sola vez y no en dos pasadas:

- El defecto pasa a vivir en `programs.plantilla_lead` de cada programa (cargado una vez, por
  `lib/catalogo/programas.ts`, con `change_log`); el código deja de tener títulos de pregunta.
- Un programa sin plantilla y una fuente sin mapeo **fallan ruidosamente** (`MapeoInvalidoError`), no
  caen a un defecto que adivina. `agenda` ya se trata así en el webhook.
- La carga de las dos plantillas en producción la hace la sesión principal con el ok de Mani, **antes**
  de desplegar el código que quita el defecto.
- `MAPEO_FORMULARIO` puede quedarse solo como vocabulario del traslado/migración desde la hoja (etapa 7),
  que lee una hoja una vez; si se queda, que el nombre o un comentario lo diga.

**Done cuando (suma):** `rg` no encuentra títulos de pregunta de Typeform en `lib/ingesta/`; test de que un
programa sin plantilla y sin mapeo de fuente falla con `MapeoInvalidoError`.

---

## Hecho el 2026-09-30 (Alejo, sesión 58)

**Decisiones de la sesión (Alejo):**

- `submissions.calificacion` y `leads.calificacion` pasan a **texto** (migración 0051) y el enum
  `calificacion_envio` se retira en la 0052, **en un commit posterior al deploy**: el código de antes escribe `::calificacion_envio`
  en SQL crudo y, sin el enum, todo webhook fallaría (hallazgo de la revisión de Codex, verificado en Postgres 17). El valor se guarda como llegó (ADR 0004) y su significado lo da la tabla. Un valor nuevo del
  formulario no pide migración.
- **La regla decide con el Estado del envío que la dispara, no con el resumen del lead.** Con el resumen, un parcial
  `con_calendly_sin_agenda` que llega después de una completa vieja decidía con la completa, y un parcial reintentado
  fuera de orden mandaba el deal a buscar una cita que no traía.
- El hecho de agendar sube **cualquier** valor a `con_calendly`, vacío incluido (ADR 0061 punto 4). Así, los 9 del
  29-sep con cita se habrían agendado aunque les faltara `estado`.
- La variable `etapa` se ignora: el link manda (nota del ADR 0061).
- "Sin estado" = vacío, un valor sin fila o con la fila inactiva. Una fila con etapa nula se *reconoce* y no abre
  deal (no se cuenta).
- B4: `MAPEO_POR_DEFECTO` desaparece del adaptador y el webhook combina solo fuente y plantilla. Sin mapeo del correo,
  `MapeoInvalidoError`: `procesarSobre` lo devuelve como `fallo_ingesta` y el sobre queda guardado para reprocesar.
  `MAPEO_ENVIO` de la hoja se deriva de `MAPEO_FORMULARIO` (`lib/sheets/`), así que `lib/ingesta/` no tiene títulos.

- Los dos puntos parciales comparten token: un parcial con **menos respuestas** no pisa al que tiene más (el del
  WhatsApp reintentado le borraba `con_calendly_sin_agenda` al previo al Calendly). La salud cuenta también un
  parcial con un valor desconocido; solo el parcial vacío (el del WhatsApp) no cuenta. Ambos, de la revisión de Codex.

**Código:** `lib/catalogo/estados-llegada.ts` (molde), `lib/ingesta/estados-llegada.ts` (la única respuesta a "¿abre
deal?"), `lib/queries/estados-llegada.ts` y `components/admin/estados-llegada-admin.tsx` (sección en
`/ajustes/fuentes`, con los valores que llegaron sin fila y un botón para crearla), conteo `sinEstado` en
`lib/queries/salud-fuentes.ts` (24 h, marca la fuente), filtro y badge en Leads.

**Payload del primer parcial real:** anotado el 6-oct, abajo ("Primer parcial real de Typeform"). Lo de antes, como estaba: Medido en producción el 1-oct (solo lectura): **0 parciales de Typeform**; los 6 parciales por webhook son de Dapta (ComunicArte, 130), con llaves `email`, `whatsapp`, las preguntas, `outcome`, `form.*`, `visit.pageUri` y `utm.*`, sin `lead_value` ni `estado`.

## Producción: orden obligatorio (cada paso con el ok de Mani)

1. Aplicar **solo la 0051** (hecho el 30-sep; se aplicó con el número 0050 y se renumeró al chocar con la 0050 de Mani, ver el handoff) (`SET lock_timeout` incluido; mirar `pg_stat_activity` antes). Es compatible con el
   código desplegado hoy: probado en Postgres 17 que su `::calificacion_envio` sigue escribiendo en la columna de texto.
2. `npm run cargar-estados-llegada -- --aplicar` (4 filas por programa).
3. `npm run cargar-plantillas-lead -- --aplicar` (correo, WhatsApp y nombre, los patrones del defecto de hoy).
   **Antes del deploy**, o todo envío falla con `MapeoInvalidoError`.
4. Push a `main` (deploy). Después, en un commit aparte: borrar `calificacionEnvioEnumRetirado` de
   `lib/db/schema.ts`, `npm run db:generate` (sale `DROP TYPE "public"."calificacion_envio"`, la **0052**) y aplicarla. No
   van en el mismo commit porque `db:migrate` aplica todo lo pendiente de una vez.
5. Reprocesar los 23 de Tactical del 29-sep: los 9 con link entran en Agendado por la regla nueva (adoptan su
   llamada suelta si la hay). **Los 14 sin link ni `estado` quedan "sin estado" con la regla nueva: hay que decidir
   con Mani** si se les da `setteo_no_calificado` (lo que el parche puso a los posteriores) antes de reprocesar.
6. Después, la O-7: el Typeform manda `con_calendly_sin_agenda` en el parcial previo al Calendly.

---

## Recorrido visual de "Estados de llegada" (1-oct, sesión 67, Alejo)

Base local (`dev:local`, developer), `/ajustes/fuentes`, con clics reales:
- Las 8 filas (2 programas × 4 valores) con etapa, prioridad, minutos, envíos y estado; "Valores sin Estado de
  llegada" muestra el `estado_local_desconocido` de cada programa (5 y 1), igual que el aviso de la fuente.
- **Editar → Guardar:** el programa queda bloqueado, el cambio se guarda y `change_log` registra solo el campo
  tocado (`alertaMinutos` null → 30, origen app, con usuario). Desactivar, Reactivar y Crear Estado (desde un valor
  sin fila) funcionan con su aviso. Claro y oscuro por tokens, consola sin errores.
- **Arreglado:** (1) un valor con fila INACTIVA salía en "sin Estado" con **Crear Estado**, y crearlo terminaba en
  "Ese programa ya tiene ese Estado de llegada". Ahora la consulta trae `inactivoId` (con la misma llave del índice) y
  la pantalla ofrece **Reactivar** (`tests/estados-llegada-admin.test.ts`). (2) El `scrollIntoView` de Editar y
  Crear Estado dejaba el formulario debajo del encabezado fijo (81 px): `md:scroll-mt-28`, también en Canales.
- Ojo para el próximo recorrido: con la pestaña de Chrome oculta, el scroll suave no corre y las capturas se
  cuelgan; medir con `javascript` y no confundirlo con un bug.

---

## Enmienda del ADR 0069, fase 1 (2-oct, Alejo): la etapa de entrada la decide el CRM

**Hecho, sin migración.** La regla de deals ya no lee la variable `estado` ni la tabla `estados_llegada`:
- `lib/ingesta/etapa-de-entrada.ts` (nuevo, puro): `etapaDeEntrada({ esParcial, agendo, leadQuality })` con la tabla
  del ADR 0069; `agendoElEnvio` (la ÚNICA lectura de `calificacion` que queda: el `con_calendly` que pone el
  adaptador) y `esCalidadAlta`. El embudo del formulario (126 A) usa la misma `agendoElEnvio`.
- `regla-de-deals.ts`: `decidirAccionDeDeal(etapaDeEntrada, dealAbierto, cita)`; `aplicarReglaDeDeal` recibe los
  `hechos` del envío que la dispara. `ingerir.ts` los saca de la fila recién escrita; `lib/calendly/buscar-llamada.ts`
  pasa `agendo: true`.
- **Ningún envío se queda sin deal** (GC-27): un completo sin estado o con `descartado` abre en Registrado; un parcial
  sin calidad, en Potencial.

**Decisiones tomadas aquí** (se revisan con Mani):
- Un **parcial Low** (no está en la tabla del ADR) nace en **Potencial**: Registrado es "terminó el formulario".
- Un **parcial sin calidad que después manda su completa High sin agenda se queda en Potencial**: el motor no tiene
  la flecha Potencial → Calificado y con deal abierto la etapa no cambia (ADR 0037). El manual §3.1 lo deja 🟡.
- **Dapta no agenda por `data.agenda`** (ADR 0069 punto 3): su adaptador no lo lee (test de Mani del 130, "nunca
  deduce una cita desde data.agenda"). Sus envíos entran por calidad y la cita llega por el webhook de Calendly (096).

**El reproceso de los 23 de Tactical** ya no espera la decisión de los 14 sin link ni `estado`: con la regla nueva
entran por su calidad (Calificado o Registrado). Sigue pidiendo el ok de Mani porque escribe en producción.

**Fase 2 (pendiente, con migración y ok de Mani):** retirar `estados_llegada` y su pantalla, `sinCalificar` del
resumen de la ingesta, la salud "sin estado" de la fuente y el filtro "sin estado" de Leads (ADR 0069 punto 5).
Mientras tanto siguen en pie y no deciden nada.

Tests: `tests/ingesta-regla-de-deals.test.ts` (la tabla del ADR fila por fila, la variable `estado` ignorada con
cinco valores, parciales en orden y fuera de orden), `tests/webhook-matriz.test.ts` y `tests/origen-del-envio.test.ts`
ajustados a GC-27. Corridos 27 archivos de ingesta, Calendly, webhook, costura y páginas: verdes.

## Fase 2, el código (2-oct, Alejo): nadie lee `estados_llegada`

**Hecho, sin migración.** Lo que solo servía a la tabla se fue y su alarma se reemplazó:
- **Fuera:** la sección "Estados de llegada" de `/ajustes/fuentes` (componente, acciones, `lib/catalogo/`,
  `lib/queries/` y `lib/ingesta/estados-llegada.ts`), `npm run cargar-estados-llegada`, la siembra en `seed:local` y
  en los tests, y `sinCalificar` del resultado de la ingesta y del traslado.
- **"Sin estado" pasa a "sin calidad"** en la salud de la fuente (`/ajustes/fuentes` y `/ajustes/salud`): completos de
  las últimas 24 h sin `lead_quality`. 🩸 Con el ADR 0069, un Typeform que deja de mandar la calidad manda a todos a
  Registrado sin un error: es el mismo agujero del 29-sep con otra variable. Medido en producción el 2-oct (3 días):
  13 completos de Typeform sin calidad, así que las dos fuentes de Typeform van a salir marcadas; hay que revisar por
  qué esos envíos no traen `lead_quality`.
- **Leads filtra por calidad** (High, Mid, Low, sin calidad) en vez de por estado, y la fila muestra la calidad.
- `scripts/estados-llegada-base.ts` pasa a `scripts/plantilla-lead-base.ts` (solo la plantilla de lead).
- Guardián nuevo en `tests/ingesta-estado.test.ts`: solo `lib/db/schema.ts` nombra `estadosLlegada`; mordido en los
  dos sentidos.

**Migración 0059 aplicada en producción el 2-oct** (ok de Mani): `DROP TABLE estados_llegada` sin CASCADE y `DROP TYPE
prioridad_llegada`, con `lock_timeout`. Verificado después: la tabla y el tipo ya no existen, 60 migraciones. Las filas de
`change_log` que hablan de la tabla se quedan como historia.

**Reproceso de los 23 de Tactical, hecho el 2-oct (ok de Mani).** Los 23 envíos del 29-sep (11:40 a 20:11) eran de 21
personas; cada sobre crudo pasó por `procesarSobre`, el mismo camino del webhook (adaptador con el mapeo de hoy, cita de
Calendly y la regla del ADR 0069), con un script desechable que se borró. Ensayo primero (solo lectura) y después
`--aplicar`: 23 de 23 procesados sin error. Verificado con una consulta: **19 deals nuevos** (11 en Registrado, 8 en
Agendado con su llamada de Calendly); el lead que estaba en Calificado con cita pasó a Agendado con su nota; el que ya
estaba en Registrado (3 envíos) no cambió. **Ningún lead de la ventana quedó sin deal.**

**Lo único que le queda al 117:** anotar el primer parcial real de Typeform cuando llegue (O-7). No es código.

## Primer parcial real de Typeform (6-oct, solo lectura en producción)

Llegaron el 5-oct entre las 22:09 y las 22:22 (Bogotá), todos de **Comunícate con Confianza** (`E5F4chVT`): 6 sobres
`form_response_partial`, de 3 respuestas (3 tokens, 2 leads; por la hora y los UTM `xxxxx`, pruebas de la puesta en
marcha). Ninguno con error.

- **Typeform manda un parcial por tramo**: con 3 respuestas (texto, correo, teléfono) y otra vez con 8 (más opciones),
  con el MISMO token. Entra como un solo envío parcial por token (`submissions_fuente_token_idx`); 6 sobres → 3 envíos.
- **Payload:** los seis ocultos UTM (`utm_source/medium/campaign/content/term/id`; vacíos o `xxxxx`) y las variables
  `estado`, `etapa` (`Setteo`), `hvm_points`, `hvm_tier`, `lead_value`, `score` y `tag_lead_quality`.
  **`lead_value` sí viene en el parcial.** Sin pregunta de Calendly respondida en ningún parcial.
- 🩸 **`tag_lead_quality` llega `High` desde el primer tramo**, con 0 puntos, tier C y `BAJO VALOR`. Con el ADR 0069
  (parcial High → Calificado) el deal del parcial **nació en Calificado** (historial: ∅ → calificado → agendado al
  completar con cita). La regla del CRM hace lo que dice el ADR; lo que no cuadraba era el dato.
- **La causa (leída por API el 6-oct, `TYPEFORM_PAT_LOCAL`):** en los tres formularios la variable arranca en `Low`;
  las respuestas malas de la #4, #6 y #8 restan 100 a `score`, y la ÚNICA regla que pone `High` vive en la #8 con la
  condición `score >= 0`, que no mira la respuesta. `score` arranca en 0, así que en un parcial que no llegó a la #8
  la condición ya se cumple y Typeform manda `High`. En un completo no se nota (el "No" de la #8 ya restó).
- **El arreglo (ok de Mani, 6-oct):** la condición pasa a `(score >= 0 Y #8 = "Sí, tengo…") O (score >= 0 Y #8 = "Sí,
  pero necesito facilidades…")` (Typeform exige OR de ANDs). En un completo es lo mismo; un parcial que no llegó a la
  #8 queda `Low` y nace en Potencial; uno que contestó "Sí" sigue `High` y nace en Calificado. Por `PUT /forms/{id}`
  con el JSON entero, comparando contra un respaldo leído antes: **aplicado y verificado en los tres** (Confianza
  `E5F4chVT`, Tactical `GmPGBOf9`, ComunicArte `nkMLdeh8`): contra el respaldo solo cambian esa condición y
  `last_updated_at`. Lo que ya entró no se reprocesa.
- **Con esto el 117 queda completo:** el primer parcial real está anotado y lo que destapó, arreglado en la fuente.
- No se tocó: las reglas de `hvm_tier` y `lead_value` de la #8 pueden tener el mismo patrón; `lead_value` no enruta.
