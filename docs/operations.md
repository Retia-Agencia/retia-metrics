# Operations del CRM de Retia

Cómo se opera la herramienta: entornos, URLs de cada programa, variables, base de datos, scripts,
despliegue, secretos, incidentes que enseñaron algo y la deuda que queda. Qué es el producto:
[`overview.md`](./overview.md). Cómo está hecho: [`structure.md`](./structure.md). Qué falta
construir: [`plan.md`](./plan.md). Las reglas duras del repo están en [`AGENTS.md`](../AGENTS.md) y
**mandan sobre este documento**.

Consolidado el 27-sep-2026 desde el handoff, los ADR 0018 y 0047, la estructura de las hojas y lo
medido ese día.

---

## 1. Entornos

| Entorno | App | Base | Estado al 28-sep |
|---|---|---|---|
| Producción (Vercel) | rama `main`, alias `retia-metrics-seven.vercel.app` | Supabase "CRM Retia" (desde el 28-sep; antes seguía en Neon) | ✅ |
| Local (Docker, desarrollo) | `npm run dev:local` (http://localhost:3000) | Postgres 17 local en Docker (puerto 54329, ticket 113) con datos de prueba | ✅ |
| Local (Producción) | `npm run dev` (http://localhost:3000) | Supabase de producción: pide ok de Mani para escrituras | ⚠️ |
| Preview (Vercel) | cada rama | ninguna: sin `DATABASE_URL` a propósito, se trabaja en `main` | — |

- **Supabase:** organización "Agencia - Dani", plan gratis. **Un solo proyecto, "CRM Retia", que es producción** (Mani, 28-sep): ref `hfqmiyiuyqapdsbywrag`,
  región `us-east-2`, vacío y sembrado (programas, cohortes, productos, fuentes, categorías y dos
  usuarios: un gerente y un developer), 24 migraciones aplicadas, RLS sin políticas en todas las tablas
  y Data API apagada. En plan gratis un proyecto **se pausa tras 7 días sin uso**: pasar producción a
  Pro (25 USD/mes) es la primera compra cuando haya operación real (ADR 0047).
- **Vercel:** team `agencia-dani`, proyecto `retia-metrics`, **plan Hobby** (verificado el 21-sep): el
  cron solo puede correr una vez al día. Hobby es para uso no comercial; pasar a Pro es la decisión R3
  (`plan.md` §7; Calendly ya no la exige: A5 se resolvió por webhook, sin cron).
- **Google Cloud:** proyecto `retia-growth`, dentro de la organización `retiagrowth.com`. Ahí viven la
  cuenta de servicio de lectura de hojas (`retia-metrics-sync@retia-growth.iam.gserviceaccount.com`) y
  el cliente OAuth del login. La pantalla de consentimiento es External y está publicada: cualquiera
  con cuenta de Google podría intentar entrar, y quien lo decide es la tabla `users` (sin
  auto-registro). `google-workspace-mcp` es el proyecto personal de Mani y no debe tener nada de la app.
- **Usuarios:** los gerentes comparten `administrativa@retiagrowth.com` (el perfil de Google aparece
  como "Alejandro Carvajal Parra"). Cada closer entra con su propia cuenta. 🔴 Los closers reales no
  están dados de alta en ninguna base de Supabase (ticket 007).

## 2. Los programas y sus URLs

🆕 **Mani, 27-sep: las URLs de cada programa se guardan completas en el repo.** Revierte la decisión
S-13 de la remediación de septiembre, que dejaba fuera los IDs de las hojas porque *"el permiso de una hoja es una casilla
que alguien puede cambiar a 'cualquiera con el enlace' sin enterarse de que el enlace ya está
publicado"*. Ese riesgo sigue: **las hojas se comparten solo con cuentas concretas y la cuenta de
servicio, nunca con "cualquiera con el enlace"**. Los scripts siguen leyendo los IDs de `.env.local`
(`SHEET_ID_COMUNICARTE`, `SHEET_ID_TACTICAL`).

| | ComunicArte | Tactical Investor |
|---|---|---|
| Hoja de Sheets | https://docs.google.com/spreadsheets/d/1NN6rlZXJJcgvWXYsbP99vLt9aj7FXVPd6ep4ULAcK54/edit | https://docs.google.com/spreadsheets/d/1DBKL4zwWWeJppe-6mzpJ4jT1G6MdEmT1Dd_uMiNBNwc/edit |
| Formulario (Typeform) | https://metodocomunicarte.typeform.com/to/nkMLdeh8 (identificado el 18-ago como el destino de los botones "Unirme" de la landing; confirmado por Mani el 27-sep) | https://postulacioness.typeform.com/to/GmPGBOf9 (confirmado por Mani el 27-sep; el ID distingue mayúsculas) |
| Formulario (Dapta, 30-sep) | `forms.dapta.ai/4bgty3/f/postulacion-evento-comunicarte`, publicado con Calendly real; fuente Dapta activa junto a la de Typeform (131). Redirects finales aún en `example.com` | 🔴 no hay. Memorable (programa nuevo, USD 1.200, inactivo): `forms.dapta.ai/rx4i7a/f/postulacion-memorable`, publicado **sin Calendly**; fuente Dapta activa |
| Landing | `programavirtual.eventoscomunicarte.com/landing.html` (el contenido vive en ese iframe) | 🔴 falta |
| Calendly | una organización por programa, un solo tipo de evento ("Postulación Método Comunicarte"); token verificado el 28-sep | una organización, evento "Postulación: De Cero a Tactical Investor"; token verificado el 28-sep (451 citas en ±3 meses) |
| `calendly_token` en la base (producción) | cargado por Mani el 28-sep (entonces desde `/ajustes/programas`; hoy la tab Programa) | cargado por Mani el 28-sep |
| **PAT de Calendly** (uno por programa, ADR 0057). **No trae llamadas** (eso lo hace el webhook): el CRM lo usa para preguntarle a Calendly en cuatro momentos, listados en `plan.md` §4.3c | en `programs.calendly_token`, verificado presente el 28-sep (sin leer el valor). Lo cambia un administrador en la tab Programa (`/p/<slug>/programa`); ninguna lectura lo devuelve. En local: `CALENDLY_PAT_LOCAL_COMUNICARTE` (§3) | en `programs.calendly_token`, verificado presente el 28-sep. En local: `CALENDLY_PAT_LOCAL_TACTICAL` |
| Cuenta de Calendly de cada closer (096) | por membresía, en `miembros_programa.calendly_email`: se elige en `/ajustes/usuarios` → "Cuentas de Calendly por programa", de la lista que da el PAT. 🔴 Vincular a las closers al desplegar la 0038 | igual |
| `web_url` / `calendly_url` en la base | vacías, y desde el 28-sep fuera del formulario (nada las lee) | vacías |

`programs.form_url` se retira con la 0069 (092, paso 2 del ADR 0068): la URL del formulario vive en la fuente principal (`sources.url_publica`).

### 2.1 Configurar un programa de punta a punta (aprendido el 30-sep con ComunicArte y Memorable en Dapta)

Cada pieza vive en UN lugar, y ninguna se duplica:

| Pieza | Dónde vive | Quién la pone | Para qué |
|---|---|---|---|
| El programa (nombre, slug, ticket USD) | "Nuevo programa" en el menú lateral, y se edita en la tab Programa (o un script por el molde, ADR 0029) | administrador | nace **inactivo** |
| Token de Calendly (PAT) | tab Programa, `programs.calendly_token` | administrador | que el CRM le pregunte a Calendly por las citas. Sin token ni fuente principal no se activa el programa (ADR 0057 y 0068) |
| Webhook de Calendly | Calendly → CRM, uno por programa (096) | ya montado en ComunicArte y Tactical | cuelga la cita del lead **por correo**. **El link de Calendly NO se guarda en el CRM** |
| Link de Calendly | el paso de agenda del formulario (Dapta) | quien edita el formulario | lo que la persona ve para agendar. En Dapta, conectar Calendly en *Integrations* con la cuenta dueña del evento y escogerlo |
| El formulario | Dapta, generado por `docs/dapta/generar-base.mjs` | Claude carga el JSON; Mani publica | ver `docs/dapta/README.md` |
| Fuente webhook | tab Programa → Formularios → "Nueva fuente", proveedor del formulario, **mapeo vacío** para Dapta | administrador | la URL `/api/webhooks/formularios/<id>` que se pega en el proveedor. Un programa puede tener varias activas (131) |
| Secreto de la fuente | se genera en la tab Programa (Formularios), se ve una vez | administrador, **a mano** | firma del webhook. Nunca pasa por un chat ni un script |
| Activar la fuente | tab Programa (Formularios) | administrador | inactiva = 404 a todo |
| URL del formulario y fuente principal | tab Programa, Formularios (campo URL; "Marcar como principal") | administrador | el destino de los links de captación (092, ADR 0068). Una por programa, activa y con URL; sin ella el programa no genera links ni se puede activar |

**Orden que funcionó:** programa → token de Calendly → formulario en borrador → fuente + secreto + activar → pegar URL y
secreto en el proveedor → **"enviar prueba"** (el CRM la recibe y no crea lead: se ve en `sobres_crudos`) →
conectar Calendly en el formulario y escoger el evento → cambiar los placeholders → publicar → **un envío real por
camino** (descalificado, sin agenda, con agenda, con las seis UTM) revisado en la base antes de compartir el link.
Antes de compartir un link de agenda, `npm run simular:cita -- --programa <slug> --host <correo> --lead <correo>` prueba el webhook firmado contra `dev:local`.
**Un Typeform nuevo copiado de otro se compara contra el de referencia vivo** (lógica, variables y ocultos por la API, 5-oct): la copia de Comunícate con Confianza salió de una versión vieja sin `lead_value` ni `utm_id`. Y su "Send test request" se guarda sin ingerir desde `67114fd`; antes creaba un lead falso.
**Los campos ocultos van completos desde el primer día** (ADR 0087, 14-oct): `utm_source`, `utm_medium`,
`utm_campaign`, `utm_term`, `utm_content`, `utm_id`, `ad_id`, `adset_id` y `campaign_id`. El formulario bota todo
parámetro que no declara, y los anuncios de Retia mandan el id del anuncio en `ad_id` o en `utm_id` según su
plantilla: sin el campo, ese anuncio no se puede recuperar después. **Hecho el 14-oct en los tres Typeform** (TI,
CA y Confianza, por API, con respaldo; el resto del form y los webhooks quedaron idénticos). ⚠️ Agregar un campo oculto
a un formulario con hoja conectada corre las columnas de la hoja (27-sep y 30-sep,
`work/retia/apps-script-sheets/README.md`). Desde el 14-oct las hojas de TI y CA **ya no se usan** (Mani): si alguien
reporta algo, Mani las arregla. Juanito solo lee las columnas A a C (nombre, correo, WhatsApp), que no se mueven. En un
programa nuevo los campos van al crear el formulario. En Dapta, verificar con un envío real que esos parámetros llegan.
El puntaje del formulario sigue el estándar único (`docs/dapta/README.md`, "Estándar de puntaje"). Desde el ADR 0069
el formulario no decide la etapa: manda agenda, calidad y valor, y el CRM enruta (se construye con las etapas de 30X).

### 2.2 AI Second Brain Jurídico (EstadoX) y Form30x (15-oct, en setup)

Programa nuevo de EstadoX. HubSpot Support y el assigner de 30X no han respondido, así que la operación comercial
corre en el CRM de Retia (Mani, 15-oct). Grupo donde se decide: WhatsApp "Core Estado X". Decisión de arquitectura
en el ADR 0092; la construcción en el ticket 271.

**Capacidad, medida el 15-oct:** la base pesa **42 MB** de los 500 MB del plan gratis de Supabase (lo más grande:
`submissions` 10 MB, con 948 envíos de cuatro programas). Vercel está en **Hobby**, con dos crons diarios (lo que ese
plan permite) y un volumen de webhooks mínimo. Un programa más no mueve ninguno de los dos límites. Lo que sí pesa es
lo que ya estaba abierto: el plan gratis de Supabase no trae respaldos (S1 en `plan.md` §7).

| Pieza | Estado al 15-oct |
|---|---|
| Programa en el CRM | 🔴 no existe. Nombre `AI Second Brain Jurídico`, slug `second-brain-juridico` (Mani, 15-oct); ticket USD 1.750 (el del producto en HubSpot) |
| Formulario | Form30x, `AI Second Brain Jurídico \| Registro \| EstadoX`, id `cmulcaari04c001s6m0x1ats6`, público en `form.30x.com/to/cmulcaari04c101s6llqgpzze`, publicado, con parciales y pixel de Meta |
| Calendly | evento `postulacion-second-brain-juridico-estadox`. 🔴 La cuenta está en plan gratis: el link no sirve hasta pagarla. Falta el round robin, invitar a los closers y cruzar sus calendarios. `CALENDLY_ACCESS_TOKEN_SB_JURIDICO` está en `.env.local`, vacío |
| HubSpot | el form ya empuja cada envío a HubSpot por su `salesFlow` (pipeline `944331885`, producto `segundocerebrojuridico_noviembre_2026`). **No se toca** |
| Fuente webhook | 🔴 bloqueada por el 271: Form30x no es proveedor registrado todavía |
| Envíos reales | 2 completos (4-oct con agenda, 14-oct sin agenda, este último una prueba interna de 30X) y 3 parciales, todos sin UTM |

**Convenciones de Form30x** (de la doc del 15-oct y del form real; ADR 0092):

- **La API key toca todos los forms de 30X y EstadoX.** Solo se usa con el id de arriba (regla completa en
  `AGENTS.md`, sección del `.env.local`). Escribir pide el ok de Mani y va con `If-Match` (ETag).
- Antes de escribir en el form, `POST /forms/:id/validate` y `POST /forms/:id/simulate` (no escriben nada). Con
  `simulate` se verifica el puntaje combinación por combinación, como se hizo con Typeform (216 combinaciones).
- **Webhook:** se configura en la página *Connect* del form, no por la API de settings. Firma
  `X-Form30x-Signature: sha256=<HMAC>`; la codificación (hex o base64) se fija con la primera entrega guardada en
  `sobres_crudos`.
- **Respuestas:** las opciones se leen por `label` (sus ids se repiten entre preguntas). La de Calendly trae las URIs
  del evento y del invitado.
- **Parciales:** el form los guarda, pero la doc solo promete el webhook en `response.completed`. **Se prueba con un
  envío parcial real** (Mani, 15-oct) con la fuente ya montada: si no llega nada a `sobres_crudos`, SBJ no tiene Potencial.
- **Campos ocultos:** ya declara `utm_*` (incluido `utm_id`), `campaign_id`, `ad_id`, `gclid`, `fbclid`, `hsa_*` y
  `referral_30x`, y desde el paso 8 (15-oct) también `adset_id` (regla del 14-oct, §2.1).
- **Calidad y valor salen de `tags`**, que el form calcula con `scoreTagRules` sobre `score`. Hoy: `score ≥ 0` →
  `High`, `≤ −1` → `Low`. La variable `tag_lead_quality` es un texto fijo en `High` y no sirve.

**Qué hace el puntaje hoy, medido el 15-oct (la copia del form y sus 5 respuestas, por la API):**

- **El score no decide quién agenda.** La lógica (`logic`) solo esconde el Calendly a quien responde inversión "No, en
  este momento no cuento con los recursos": va a la pantalla "Estamos analizando tu aplicación". Todos los demás ven
  el Calendly, sin mirar ingreso, urgencia ni cargo.
- **El score tampoco va a HubSpot.** El `salesFlow` manda las respuestas por pregunta (`income_range_crm`,
  `x30x_urgencia`, `x30x_perfil`, `x30x_disposicion_inversion`, `motivation_crm`), nunca `score` ni `tags`.
- **El score solo produce `tags`** (`High`/`Low`), que hoy no lee nadie. El primero en leerlos será el CRM (271).
- ✅ **La pregunta de IA no se mostraba (corregido en el paso 8, 15-oct).** La lógica salta de "situación" a "inversión"; ninguna de las 5 respuestas
  la tiene. En el form de 30X sí se muestra (situación → IA → inversión). **Se corrige en el paso 8 (Mani, 15-oct):**
  la regla de `logic` que va de situación (`c23a9366-…`) a inversión (`34f6e3c2-…`) pasa a ir a la pregunta de IA
  (ref `7twn2s7h`), y de IA se sigue a inversión (con `simulate` se comprueba que pase por orden; si no, se agrega la
  regla IA → inversión). La pregunta no tiene `hubspotProperty`, así que HubSpot no cambia. Desde ahí "No lo tengo
  permitido" resta 100 y deja la calidad en `Low`, pero **no esconde el Calendly** (eso sigue siendo solo de la
  respuesta de inversión).

**Por eso el arreglo del puntaje no rompe el form, con una condición:** se tocan SOLO los `score` de las opciones, las
`scoreTagRules`, `adset_id` en `hiddenFields` y **la única regla de `logic` que salta la pregunta de IA** (arriba).
**No se tocan los textos, el orden ni las opciones de `fields`, el resto de `logic`, el `salesFlow` ni el Calendly.** Así lo que ve la persona, quién agenda y lo que llega a HubSpot quedan idénticos; lo único que cambia es
la etiqueta que lee el CRM. Agregar `adset_id` a `hiddenFields` es aditivo (un campo oculto más que se llena desde la
URL) y va en la misma escritura. Antes de escribir: `validate` y `simulate`, y comparar el JSON completo antes/después
(solo deben cambiar esos campos).

**El puntaje que va: lo mínimo para que salgan calidad y valor** (Mani, 15-oct; reemplaza lo decidido horas antes
como S3). El form conserva sus descalificantes; solo se le dan puntos a lo que hoy vale 0 para que exista el valor:

| Pregunta | Hoy | Va |
|---|---|---|
| Ingreso mensual | las cuatro opciones en 0 | <1.000 → 0 · 1.000-3.000 → 10 · 3.000-10.000 → 20 · >10.000 → 30. **Sin −100**: el ingreso no descalifica |
| Situación | por cargo, sin puntos | Socio/CEO, Director/C-Level y Gerente Intermedio → 20 · Coordinador, Analista y Otro → 10 · Estudiante y Desempleado → 0 (el orden del form de 30X) |
| Urgencia "No es prioridad" | −100 | igual |
| Inversión "No cuento con los recursos" | −129 | **−100**, única corrección: con −129 las franjas de score de un descalificante se pisan (`−80` sería urgencia con 20 puntos o inversión con 49). Sigue en `Low` y el Calendly se esconde por la respuesta, no por el score |
| Puede instalar IA | "No lo tengo permitido" −100, pero no se muestra | igual, y **se muestra** (la regla de situación pasa a ir a IA) |
| Calidad | `scoreTagRules` `≥ 0` High · `≤ −1` Low | igual: **ya sale en `tags`, no se toca** |
| `lead_value` | no existe | reglas nuevas en `scoreTagRules` (abajo) |
| Pauta | `utm_*`, `utm_id`, `campaign_id`, `ad_id` | + `adset_id` en `hiddenFields` (aditivo) |

Resultado: la calidad de cada envío queda **igual que hoy**; el valor aparece; la persona, el Calendly y HubSpot no
cambian.

**Qué sale de cada envío en el CRM, y es coherente:** la etapa la deciden los hechos del envío (ADR 0069): agendó →
Agendado, aunque sea `Low`; completo `High` sin agenda → Calificado; completo `Low` sin agenda → Registrado; parcial →
Potencial. Un lead con ingreso bajo que agenda entra a Agendado con calidad `Low` y su valor, y el closer lo ve. Nadie
queda sin deal.

**`lead_value` en Form30x:** los puntos de valor van de 0 a 50, así que cada cantidad de descalificantes (0 a 3:
urgencia, inversión e IA) cae en una franja de `score` que no se pisa con otra: `[−100k, −100k + 50]`. Una regla por
franja y nivel: sin descalificantes, 30-50 MUY ALTO VALOR, 15-29 ALTO VALOR, 0-14 VALOR MEDIO; con uno o más, la
misma posición dentro de su franja baja un nivel (ALTO VALOR, VALOR MEDIO, BAJO VALOR). Son 12 reglas, más las dos de
calidad que ya existen.
Medido con `simulate` después de escribir (paso 8): dos reglas dan tag a la vez, así que `tags` trae las dos por
separado (`["High", "MUY ALTO VALOR"]`); no hace falta etiqueta compuesta.

**Contraste con 30X** (form `AI Second Brain | Registro | 30X`, ticket 2.000, leído una vez el 15-oct con el ok de
Mani): ahí el puntaje SÍ decide quién agenda, porque su lógica muestra el Calendly solo con `score > 6`, ingreso de
3.000 o más, sin Estudiante, sin "No es prioridad" y con IA "Definitivamente sí". Es lógica de ese form, no una regla
de Form30x, y no se copia: SBJ conserva la suya.

**Checklist para dejarlo listo** (en orden; ✅ = hecho):

1. ✅ Medir capacidad, leer la doc y el form de Form30x, decidir el proveedor (ADR 0092) — Claude, 15-oct.
2. ✅ Decidir nombre y slug (S2) y el puntaje (S3) — Mani, 15-oct.
3. 271 fase A: migración + proveedor que acepta hex o base64 — Codex implementa; la sesión aplica la migración con
   el ok de Mani y despliega.
4. Crear el programa (nace inactivo) y su fuente Form30x en la tab Programa; generar el secreto y activar la fuente —
   Mani, a mano (el secreto no pasa por el chat).
5. Pegar la URL de la fuente y el secreto en *Connect* del form — Mani.
6. Un envío parcial y uno completo **con datos falsos**; revisar `sobres_crudos`: codificación de la firma y si
   llegó el parcial — Mani envía, la sesión revisa.
7. 271 fase B: adaptador completo con los cuerpos reales — Codex; la sesión revisa y despliega.
8. ✅ Puntos de ingreso y situación, inversión a −100, reglas de valor y `adset_id` (solo `score` de opciones,
   `scoreTagRules` y `hiddenFields`) y la regla de `logic` situación → IA: `validate` +
   `simulate`, diff del JSON antes/después, `If-Match` — la sesión por la API, con el ok de Mani. Va **antes** del
   paso 6 si se quiere que los envíos de prueba ya traigan las etiquetas buenas.
   Hecho el 15-oct por la API (PATCH con `If-Match`, `validate` sin issues). Releído: solo cambió lo previsto. `simulate` no
   acepta borradores, así que se midió la línea base antes (108 combinaciones, cuadró con lo de arriba) y las 324 después
   (ingreso × urgencia × 3 situaciones × IA × inversión): 0 descuadres en score, calidad, valor, paso por IA y Calendly;
   sin "No lo tengo permitido", calidad y Calendly quedan idénticos a antes.
9. Pagar Calendly, montar el round robin, invitar a los closers y cruzar sus calendarios; conectar el evento en la
   pregunta de Calendly del form — Mani / EstadoX.
10. Poner `CALENDLY_ACCESS_TOKEN_SB_JURIDICO` en `.env.local` y el token en la tab Programa; montar el webhook de
    Calendly del programa (096) y vincular la cuenta de Calendly de cada closer en `/ajustes/usuarios` — Mani y la
    sesión.
11. Dar de alta a los closers con membresía en el programa — Mani.
12. Marcar la fuente principal con su URL y activar el programa — Mani.
13. Un envío real por camino (descalificado, sin agenda, con agenda, con UTM) revisado en la base: etapa, calidad,
    valor, UTMs y llamada colgada — la sesión.
14. Avisar al equipo en "Core Estado X" — Mani.

## 3. Variables de entorno

Solo nombres; los valores viven en `.env.local` (permisos `600`, nunca en el repo ni abiertos en un
editor) y en Vercel.

| Variable | Para qué | Dónde |
|---|---|---|
| `DATABASE_URL` | la app: pooler de Supabase en modo transaction (6543), con `prepare: false` | local, Vercel |
| `DATABASE_URL_DIRECTA` | `drizzle-kit`: pooler en modo session (5432); la conexión directa es solo IPv6 | local |
| `SUPABASE_DB_PASSWORD` | `.env.local` arma las dos URLs con ella | local |
| `DB_PROD` | sin uso desde el 28-sep: hay una sola base y `DATABASE_URL` ya es producción | local |
| `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_URL` | login con Google (Auth.js) | local, Vercel |
| `GOOGLE_SERVICE_ACCOUNT_JSON_B64` | la cuenta de servicio que lee las hojas: "probar" y activar una fuente de hoja en la tab Programa (Formularios), los scripts y el traslado | local, Vercel |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | el almacén de comprobantes (Supabase Storage, bucket privado `comprobantes`; ADR 0085). La llave secreta solo vive en el servidor; con una `DATABASE_URL` local se usa el adaptador de disco y no hacen falta | local, Vercel |
| `CRON_SECRET` | protege `/api/cron/comprobantes` (respaldo diario en Drive y barrido de subidas a medias); Vercel lo manda en cada llamada del cron. Lo generó la sesión del 13-oct sin mostrarlo | local, Vercel |
| `DRIVE_COMPROBANTES_ID` | la unidad compartida "Comprobantes CRM Retia" (`0ADSvd0QdWDh-Uk9PVA`, Workspace de Retia); la cuenta de servicio es Administrador de contenido. Sin ella el cron solo barre | local, Vercel |
| `SHEET_ID_COMUNICARTE`, `SHEET_ID_TACTICAL` | los IDs de las hojas, para los scripts | local |
| `SCRIPT_ACTOR_EMAIL` | quién firma el rastro de un script que escribe en una base viva (ADR 0029) | local |
| `SEED_GERENTE_EMAIL`, `SEED_GERENTE_NOMBRE` | el gerente que siembra `seed:users` | local |
| `ENLACES_PAGO_JSON` | los enlaces de pago que carga `cargar-enlaces-pago` (el JSON lo tiene Mani) | local |
| `TYPEFORM_TOKEN` | token personal de Typeform, **por cuenta**: ve los forms de los tres programas (Comunícate con Confianza: `E5F4chVT`, en la cuenta de Francisco) (lectura de forms, variables, webhooks y respuestas). Solo para scripts y revisiones de devs; la app no lo lee | local |
| `META_SYSTEM_TOKEN` | token del usuario del sistema `retia-insights` del portafolio Agencia Retia Growth (14-oct): **solo `ads_read`**, caducidad Nunca, ve las 7 cuentas publicitarias (`docs/hub.md` §2.4). Solo para scripts y devs; **la app no lo lee**: en producción el token vive en la base (`meta_conexiones`, 119, ADR 0062). Copia de respaldo fuera del repo en `~/.config/retia/meta.env` de Mani. La API exige `v26.0` | local |
| `CALENDLY_ACCESS_TOKEN_COMUNICARTE`, `CALENDLY_ACCESS_TOKEN_TACTICAL`, `CALENDLY_ACCESS_TOKEN_COMUNICATE_CONFIANZA` | un access token por programa, de una cuenta OWNER (ve miembros, tipos de evento, citas y webhooks de su organizacion). Solo para scripts y revisiones de devs; en produccion el token vive en la base (ADR 0057) | local |
| `CALENDLY_ACCESS_TOKEN_SB_JURIDICO` | el de AI Second Brain Jurídico (15-oct). Vacío hasta pagar la cuenta de Calendly | local |
| `FORM_30X_API_KEY` | key de la API de Form30x (15-oct, ADR 0092). **Lee y edita todos los forms de 30X y EstadoX**: se usa solo con el form de SBJ (§2.2); la app no la lee | local |
| `SEMAFORO_SECRETO` | el secreto con que Juanito llama a `POST /api/semaforo/envios` (ADR 0089, 259); el mismo valor va en `RETIA_SEMAFORO_SECRETO` del `.env` de Juanito, local y VPS. Generado el 15-oct sin mostrarlo | Vercel |
| `CALENDLY_PAT_LOCAL_COMUNICARTE`, `CALENDLY_PAT_LOCAL_TACTICAL` | **no se usan** (Mani, 29-sep). Solo los lee `seed-local`; vacios va un token de mentira |

`npm run build` no necesita `.env.local`: el cliente de la base se crea de forma perezosa.

### 3.1 El reporte de pauta por WhatsApp (semáforo; ADR 0089, tickets 259 a 269)

- **Qué se manda y cuándo** se configura en el CRM, Programa › General › Reporte por WhatsApp: encendido, horas del
  día (0 a 23), resumen de cierre y métricas. Al 15-oct los tres programas están encendidos a las 8, 11, 14 y 17 h,
  con el cierre a las 20 h (pedido de Dani Tovar).
- **A dónde** no se configura en el CRM: un solo grupo, "Alertas Paid Media - Retia", en `RETIA_SEMAFORO_GRUPO` del
  `.env` de Juanito (y en `environment:` de su `docker-compose.yml`).
- **Cómo sale:** Juanito pregunta cada hora en punto de lunes a viernes (`0 * * * 1-5`); el CRM responde a lo sumo un
  envío con un bloque por programa que toca a esa hora (269) y el texto ya armado. Si el CRM no responde, Juanito
  avisa en el grupo con la última configuración que guardó.
- **Apagarlo:** el interruptor "Enviar reporte" de cada programa. Para apagarlo todo desde Juanito, vaciar
  `RETIA_SEMAFORO_URL` en su `.env` del VPS y `docker compose up -d` (el job se autodesactiva).

## 4. La base de datos

**Reglas** (las completas en `AGENTS.md`, convenciones):

- **Las migraciones las genera y aplica la sesión principal, nunca un subagente.** `drizzle-kit
  generate` es interactivo (pregunta si algo es un renombre; la opción por defecto es siempre `create`)
  y sin terminal se cuelga o falla.
- **El SQL que genera `drizzle-kit` se lee antes de aplicarlo, siempre.** La 0020 traía cuatro defectos,
  dos destructivos (habría borrado todos los leads con un `DROP TABLE ... CASCADE`).
- **Orden (desde el 28-sep, una sola base):** generar → leer y corregir el SQL → `npm test` (PGlite aplica todas) → aplicar en la base **con
  el ok de Mani**. Un `CHECK` o un índice único se crea después de arreglar los datos, en la misma
  migración.
- **Antes de escribir, mirar el ref del proyecto dentro de la connection string** (`postgres.<ref>@...`),
  no el nombre de la variable.
- **Lectura libre, escritura con permiso:** consultas de solo lectura contra producción, libres; toda
  escritura de datos pide el ok de Mani en esa conversación. Desde el 28-sep hay una sola base: todo lo
  que corre en local escribe en producción.
- **`drizzle-kit push` y `drop` están denegados** en `.claude/settings.json`: se saltan el historial.
- **Toda tabla nueva lleva RLS sin políticas** (lo exige `tests/rls-en-todas-las-tablas.test.ts`), y la
  Data API se apaga en cada proyecto de Supabase.
- **No se corre una semilla sobre una base con datos reales:** `seed:datos` reconcilia por nombre y
  duplica filas si los nombres cambiaron (ADR 0029).

**Producción quedó armada el 28-sep** sobre el proyecto que hacía de `dev` (ADR 0047, enmienda): ya tenía
todas las migraciones, la Data API apagada, la configuración sembrada y los motivos cargados. Falta:
cargar los enlaces de pago (`cargar-enlaces-pago`, el JSON lo tiene Mani) y dar de alta a los closers
reales desde `/ajustes/usuarios` (ticket 007).

### 4.1 Base local para desarrollo de pantallas (Ticket 113)

Para construir y probar pantallas (como el Kanban de Deals o el Inbox) sin escribir en la base de producción ni arriesgar datos reales:

1. **Levantar base local y sembrar (un solo comando):**
   ```bash
   npm run db:local
   ```
   Levanta Postgres 17 en Docker (`retia-metrics-db-local` en puerto `54329`), espera a que acepte conexiones, aplica todas las migraciones de `drizzle/` con `drizzle-kit migrate` y ejecuta la siembra (`scripts/seed-local.ts`).

2. **Iniciar la app contra la base local:**
   ```bash
   npm run dev:local
   ```
   Sobreescribe `DATABASE_URL` y `DATABASE_URL_DIRECTA` en el proceso hacia `postgresql://postgres:postgres@127.0.0.1:54329/retia_local` sin tocar `.env.local`.

3. **Guardia contra producción:**
   Tanto `db:local` como `dev:local` y `seed:local` verifican estrictamente que la URL apunte a `localhost` o `127.0.0.1`, y rechazan cualquier host de Supabase o producción.

4. **Calendly en local (opcional):** con `CALENDLY_PAT_LOCAL_COMUNICARTE` y `CALENDLY_PAT_LOCAL_TACTICAL`
   en `.env.local` (placeholders vacíos desde el 28-sep), el seed guarda esos PAT en sus programas y lo que
   lee Calendly (la cuenta por membresía en `/ajustes/usuarios`, "buscar llamada") funciona en local. El
   seed lee de `.env.local` **solo esas dos llaves**, nunca el archivo entero, porque ahí está el
   `DATABASE_URL` de producción. Sin ellas, esas pantallas muestran el rechazo de Calendly.

5. **Reinicio limpio:**
   ```bash
   docker compose down -v && npm run db:local
   ```

6. **Login local (solo desarrollo):**
   `npm run dev:local` habilita un proveedor de credenciales que pide un correo y entra como
   ese usuario de `users` (activo), sin Google OAuth. Existe SOLO si `AUTH_LOGIN_LOCAL=1` (lo pone
   `dev:local` para su hijo) **y** `DATABASE_URL` es local (mismo check que la guardia del script,
   `lib/db/es-local.ts`); en producción no se registra. El rol y el `closerId` los sigue poniendo la
   base por los callbacks de siempre (`puedeIniciarSesion`, `revalidarToken`), igual que con Google.
   `/login` muestra el formulario "Entrar como (local)" solo cuando el proveedor está activo.
   Para Google (dev normal o producción) hacen falta `AUTH_SECRET`, `AUTH_GOOGLE_ID` y
   `AUTH_GOOGLE_SECRET` con redirect URI `http://localhost:3000/api/auth/callback/google`.

## 5. Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` · `build` · `start` | la app |
| `npm run dev:local` | la app apuntando exclusivamente a la base local de Docker (sin tocar `.env.local`) |
| `npm run db:local` | levanta Docker Postgres 17, espera conexión, migra y siembra la base local (ticket 113) |
| `npm run seed:local` | re-siembra la base local con datos de ejemplo (idempotente) |
| `npm test` · `typecheck` · `lint` | los tres chequeos; una etapa no se cierra sin los tres limpios |
| `npm run db:generate` · `db:migrate` · `db:studio` | migraciones (ver §4) |
| `npm run setup` | arma el `.env.local` |
| `npm run seed:users` · `seed:datos` | sembrar una base **vacía** |
| `npm run usuarios` | **acceso de emergencia**: `usuarios` lista, `usuarios -- agregar <correo> <rol> [closer_id] [programas...]`, `usuarios -- quitar <correo>` (desactiva, no borra). La vía normal es `/ajustes/usuarios` |
| `npm run rotar` | rota `AUTH_GOOGLE_SECRET` y `AUTH_SECRET` |
| `npm run cuenta-servicio` | carga la cuenta de servicio de Google |
| `npm run cargar-motivos` | carga las cuatro listas de motivos (ticket 104) por el molde y retira las 8 semillas de la migración 0004. **Se corre en toda base nueva después de migrar.** Idempotente; pide `SCRIPT_ACTOR_EMAIL` |
| `npm run descubrir` · `inspeccionar <sheetId> "<pestaña>"` · `comparar` | leer la estructura de las hojas |
| `npm run limpiar-respaldos` | borra respaldos locales de `.env.local` |
| `tsx scripts/cargar-enlaces-pago.ts` | carga los enlaces de pago por el molde, con `SCRIPT_ACTOR_EMAIL` |

Un script sale con `process.exit`: `postgres-js` deja el pool abierto y el proceso se queda colgado.

## 6. Despliegue

- **`main` es producción:** un `git push origin main` dispara el deploy. Antes de empujar: `npm test`,
  `npm run typecheck`, `npm run lint` y `npm run build`.
- **Cómo saber qué commit está vivo:** la CLI de Vercel de esta máquina está logueada y alcanza el
  proyecto (el conector MCP pide OAuth y no arranca en una sesión no interactiva).
  `vercel ls --yes` da el deploy de producción más reciente y `vercel inspect <url>` su fecha; se cruza
  con `git log --format='%h %ci'`.
- **`/api/health` no prueba nada de la base:** devuelve un JSON constante. Que las consultas corran solo
  lo prueba una sesión real abriendo una pantalla que consulte.
- Si una migración no es aditiva, hay una ventana en que código y esquema no se entienden: migrar y
  desplegar seguidos.

## 7. El sync de Sheets (retirado)

**Retirado el 28-sep (ticket 108).** Los leads entran solo por el webhook (corte directo, 22-sep). Se
fueron el cron, la corrida manual, `lib/sheets/sync.ts` y `plan-sync.ts`, sus scripts y sus tests
(`git show bfeea2a:<ruta>` los recupera). Queda en `lib/sheets/` lo que lee una hoja una sola vez, para
el traslado y la migración de la etapa 7. `sync_runs` sigue en la base como historial de solo lectura.

- 🩸 La primera corrida del cron contra Supabase (28-sep, 7:52 a.m.) metió **5.343 leads sin envíos** en
  producción por la puerta descartada, y se borraron con el ok de Mani. **Lección:** cambiar el
  `DATABASE_URL` de producción también redirige a los crons; revisar `vercel.json` cuando se cambia la
  base.
- Ya no queda ningún route handler que mute con sesión: el único, `POST /api/sync/[programa]`, se fue
  con su chequeo de origen (`exigirMismoOrigen`). El webhook muta, pero se autentica por firma HMAC y no
  por cookie.

## 8. Secretos y accesos

- **Nada de la app es público** salvo `/api/health`. `proxy.ts` exige sesión en todo lo demás; un
  webhook nuevo tiene que ir en su lista pública o cada envío recibe un redirect a `/login` y falla sin
  que nadie lo vea.
- **Quitar a alguien lo saca ya:** el rol se revalida contra `users` en cada emisión del token, y la
  sesión dura 8 horas (ADR 0002).
- Secretos solo en `.env.local` y en Vercel. Un `.env.local` nunca se abre en un editor ni se pega en un
  chat.

**Pendientes de seguridad** (de sesiones anteriores, sin resolver):

- 🔴 Rotar la contraseña de PayPal de Retia: está en texto plano en el grupo de WhatsApp de ventas de
  Tactical desde el 18-ago (decisión de Mani).
- 🔴 Rotar la llave personal de HubSpot de 30X que se usó el 22-sep para leer el portal: quedó en el log
  de esa sesión.
- 🔴 Borrar el cliente OAuth web viejo del proyecto `google-workspace-mcp`.
- 🔴 Probar el login con una cuenta real de closer, local y en producción.

## 9. Incidentes que enseñaron algo

| Fecha | Qué pasó | Lo que queda |
|---|---|---|
| 16-sep | `.env.local` apuntaba a producción mientras todos creían que era `dev`; cuatro migraciones se aplicaron directo a producción | antes de escribir, se mira el ref de la base, no el nombre de la variable |
| 18-sep | cinco enlaces de pago entraron a producción con un script que insertaba en crudo: cero filas de rastro | una fila de catálogo se crea por el molde, también desde un script (ADR 0029) |
| 18-sep | `seed:datos` corrido sobre producción insertó 3 productos duplicados | no se siembra una base viva |
| 18-sep | el menú de usuario tiraba la página entera al abrirse (un componente de Base UI fuera de su contenedor), con 543 tests en verde | una pantalla se prueba haciendo clic en todo lo que se abre, y un permiso forjando la petición |
| 20-sep | dos bugs con 669 tests en verde: un botón muerto y una función de `lib/` que nadie llamaba | antes de dar por probada una función, mirar quién la llama |
| 22-sep | al cambiar de driver se cayó el build: un componente de cliente importaba un módulo que arrastra la base | un componente `"use client"` no importa nada de `lib/db` |
| 23-sep | `next dev` murió con "Jest worker encountered 2 child process exceptions" tras levantar un segundo servidor sobre la misma `.next` | antes de arrancar un servidor, mirar si ya hay uno en el 3000 |
| 27-sep | agregar un cálculo en los Typeform activó `score` e insertó la columna "Score" en la O de las dos hojas; los Apps Script leen por posición y dejaron de clasificar leads nuevos, sin error, durante ~40 min (1 lead real afectado, rescatado) | un cambio en Typeform se verifica mirando la fila 1 de la hoja después del primer envío; nunca reconectar la integración con Sheets. Detalle en `work/retia/apps-script-sheets/README.md` |
| 14-oct | la sesión del Hub agregó `ad_id`, `adset_id` y `campaign_id` a los tres Typeform afirmando que "no rompía nada" sin leer la fila de arriba; el 30-sep el mismo tipo de cambio (`utm_id`) había corrido las columnas de las hojas. Se revirtió al minuto, sin envíos en medio, y se volvió a aplicar cuando Mani confirmó que las hojas ya no se usan. Medido el 15-oct: los closers sí seguían usándolas; se corrieron 3 columnas (Submitted = T, Token = U, Estado = V), en CA el enrutador dejó de clasificar y en TI escribió el Estado encima de `campaign_id` y copió sin fecha. El CRM no se afectó | antes de afirmar que un cambio en un borde no rompe nada, leer esta tabla y el README de los Apps Script |
| 15-oct | la cita de Calendly de un lead de TI (2-oct) no tenía llamada. El webhook sí la creó el 2-oct: la borró el corte en cero del 7-oct (203), y la recuperación del 8-oct solo trajo citas **futuras**. Medido contra Calendly (inicio desde el 1-oct): 21 citas previas al corte siguen sin llamada: 12 de estudiantes ya vendidos y 2 canceladas de deals en Calificado (se dejan como historia, Mani), 1 prueba de Mani, y 6 de personas que no estaban en el CRM porque el 208 filtró por la fecha del **formulario** (25 a 27-sep, antes de C3) y no por la de la cita (1 y 2-oct, ya en C3), o porque agendaron sin pasar por el formulario. Esas 6 se metieron el 15-oct con el ok de Mani, por las puertas del 208 (formulario rearmado desde Typeform, cita desde Calendly, `crearDealDesdeSuelta` para las 2 sin formulario): Agendado en C3, con la host de dueña y la llamada creada el día en que agendaron. Después del corte, 0 perdidas | un borrado masivo sobre `calls` se recupera sobre **toda** la ventana borrada, no solo lo futuro, y se mide contra Calendly antes de cerrar. Y una llamada recreada hoy cuenta como agenda de hoy (`metricas.md`, agendas por `created_at`) |
| 27-sep | `npm ci` falla porque el lock no está sincronizado (faltan `@emnapi/runtime` y `@emnapi/core`); un `node_modules` viejo tira 46 tests por falta del driver `postgres` | reparar el lock con `npm install` y un commit; mientras tanto, `npm install --no-package-lock` |

## 10. Deuda que queda

- **Escalabilidad** (medida el 19-sep en la base de Neon): 15 MB en total; `people.raw` pesaba 551 bytes
  por persona. El almacenamiento no es el problema (un millón de leads son ~550 MB). Los techos reales:
  `change_log` crece con cada cambio y nadie lo poda; el traslado lee la hoja completa en memoria; y los
  comprobantes en foto (1 a 5 MB cada uno) van a Storage, no a la base. Mani lo quiere en sesión propia.
- **Extraer los componentes grandes** (`mi-dia-registro`, dashboard y administradores) solo cuando haya
  una frontera de dominio estable (ADR 0033). Buena parte se reescribe igual en la etapa de UI.
- **Rutas viejas del Dashboard y de Metas (ticket 250, 14-oct):** `/p/<programa>/dashboard`, `/dashboard`,
  `/p/<programa>/metas` y sus `lista` solo redirigen al Hub, con la query y la misma guarda (como `/mi-dia`).
  Se borran el **14-nov-2026**, un mes después; antes de borrarlas, mirar en Vercel que ya no reciban visitas.
  `/mi-dia` (ticket 172) tampoco tiene fecha anotada y puede salir el mismo día.
- **Código muerto:** `lib/abonos/plataforma.ts` no lo importa nadie (verificado el 27-sep). Se señala,
  no se borra de paso.
- **`users.calendly_email` sin lector (28-sep, ticket 096):** la cuenta de Calendly pasó a la membresía
  (`miembros_programa.calendly_email`, migración 0038) y el campo salió del formulario. La columna sigue
  en el esquema y en el molde de usuarios; quitarla es una migración.
- **Columnas sin uso tras retirar T2 (28-sep):** `sources.calificacion`, `submissions.calificacion` y
  `submissions.puntaje` siguen en el esquema, y `scripts/seed-datos.ts` todavía siembra
  `sources.calificacion`. Quitarlas es una migración; nadie la ha pedido.
- **Hashes de migraciones en la base:** las filas de `drizzle.__drizzle_migrations` de 0000 a 0020 no
  casan con los archivos porque se aplicaron desde un checkout de Windows (CRLF). Verificado el 28-sep:
  con CRLF casan todas, el contenido es idéntico y no hay que tocar nada. drizzle solo mira la última.
  Desde el 28-sep `.gitattributes` fuerza LF en `drizzle/*.sql` para que no vuelva a pasar.
- **Detectar que un lead desapareció de la fuente:** nunca se borra un lead (Mani, 19-sep); con el
  webhook deja de aplicar, salvo para el traslado.

## 11. Datos de validación

Cifras que salieron de las hojas reales. Sirven para verificar cualquier motor de métricas: **no se
escriben en la app**, la app las recalcula. Si el código da otra cosa con los mismos insumos, el bug es
del código.

**Cohortes C1 (cerradas; no cambian más):**

| ComunicArte C1 | Tactical Investor C1 |
|---|---|
| Leads 1.100 → descartados 561 (51,0%) | Filas 2.932 → personas 1.825 (37,8% duplicados) |
| Con Calendly 152 (13,8%) → llamadas 135 | Descartados 741 (40,6%) · cola de setteo 883 (48,4%) |
| Shows 51 (37,8%) → cierres 29 (56,9% sobre show) | Agendaron 200 (11,0%) → llamadas 140 → shows 72 (51,4%) → cierres 17 |
| **Lead a venta 2,64% · invitado a venta 21,5%** | **Lead a venta 0,93% · invitado a venta 8,5%** (bajo el umbral de 15%) |
| Pauta COP 10.119.796 · CPL COP 9.200 | ROAS motor de llamadas 1,97 · ROAS lanzamiento 9,04 (motores distintos, no se mezclan) |
| Ritmo sostenido: 73 leads por día hábil | Matriculados 31, pero solo 17 pasaron por el registro de llamadas |

**Cohortes C2 al 14-sep** (consolidados de Michael; la regla que usaron: si el reporte del equipo y la
hoja no coinciden, manda el reporte):

| | ComunicArte C2 | Tactical Investor C2 |
|---|---|---|
| Cupos vendidos / meta | 22 / 50 (50% de la meta lineal) | 21 / 50 (55% de la meta lineal) |
| Días hábiles corridos | 22 de 27 | 19 de 30 |
| Leads del corte (Bogotá) | 775 | 746 |
| Lead a venta | 2,84% | 2,82% |
| Agendaron (12-ago al 14-sep) | 125 (14,9%) | 105 (11,9%) |
| Caja en la hoja de estudiantes | USD 11.154 | USD 19.120 |
| Pago total / parcial | 12 / 7 (1 sin dato) | 10 / 9 |

Los reportes diarios del equipo contaban los leads por fecha UTC; los consolidados, por fecha de
Bogotá. Por eso las dos cuentas no coinciden día a día.

## 12. El corte (hito B): guion, capacitación y reversa

> **Decisión vigente · 7-oct-2026 (ticket 203):** ComunicArte y Tactical Investor **no migran** la historia de
> Sheets. Producción se respaldó, su historia operativa se borró por `program_id` y ambos arrancaron en cero; desde
> ahí solo entra lo nuevo por webhook. Comunícate con Confianza quedó fuera del alcance. Por tanto, para esos dos
> programas **no se ejecutan** los pasos de `migracion:extraer`, `migracion:importar` ni la reversa del 078 descritos
> abajo; se conservan como procedimiento histórico y para otro programa que decida migrar. Falta el 082: poner las
> pestañas de gestión en solo lectura después de la semana acordada.

El procedimiento histórico de abajo describía el día en que los closers dejaban las pestañas de gestión
(`Setteo`, `Registro de llamadas`, `Estudiantes`) y el 078 traía lo abierto. Desde la decisión del 7-oct no se
ejecuta para ComunicArte ni Tactical; queda como referencia para otro programa que sí decida migrar.

### 12.1 Antes del día (bloquea el corte si falta algo)

| # | Qué | Quién | Cómo se comprueba |
|---|---|---|---|
| 1 | **S1 decidido.** Sin Supabase Pro no hay respaldos: la migración escribe en la única base y desde ese día la historia vive solo ahí | equipo | Pro pagado, o el respaldo manual de 12.3 paso 1 como regla fija |
| 2 | **La C3 de cada programa existe y está activa** (O-5). Sin cohorte activa, el primer abono no tiene a qué cohorte asignarse | gerente | Ajustes → Programas y cohortes |
| 3 | **Cada closer tiene cuenta, rol y membresía** en sus programas, y su correo de Calendly vinculado (096) | gerente o Mani | Ajustes → Usuarios. El dueño de un deal migrado sale del nombre de la hoja solo si ese nombre es un usuario del CRM (ADR 0030); si no, el deal nace sin dueño y va al Inbox |
| 4 | **Los montos de comisión cargados** (062) | hecho el 29-sep | Ajustes → Programas: CA USD 80, TI USD 100 |
| 5 | **Los 12 "cohorte pasada" de ComunicArte marcados** en el template (`movidoDesde`, 080) | quien conozca la hoja | el template de CA los trae |
| 6 | **Ensayo contra producción** de los dos programas, sin `--aplicar` (078). Transacción corta que se deshace sola | Alejo, con el ok de Mani | conteos coherentes con el ensayo local |
| 7 | **Revisión a mano** de los encabezados corridos del `Registro de llamadas` de CA (080) | Alejo | una muestra de filas del template contra la hoja |
| 8 | **La capacitación de 12.4 hecha** | Alejo o Mani | cada closer completó el recorrido una vez |

### 12.2 El día, en orden

1. **Aviso** a los closers por el grupo: desde la hora H no se escribe en las pestañas de gestión. Siguen
   atendiendo por WhatsApp y Calendly como siempre; lo que pase en esa ventana se anota aparte y se carga
   en el CRM al terminar.
2. **Extraer** con las hojas de ese momento, una vez por programa:
   `npm run migracion:extraer -- --programa comunicarte` y lo mismo con `tactical-investor`. El template
   queda en `.migracion/` (ignorado por git: lleva correos).
3. **Marcar a mano** en el template de CA los "cohorte pasada" (`movidoDesde: "C1"`), igual que en el
   ensayo.
4. **Ensayo final** de cada template contra producción (`npm run migracion:importar -- <template>`, sin
   `--aplicar`). Los conteos tienen que coincidir con el ensayo del día anterior, salvo lo que se movió ese
   día. Si no coinciden, se para y se entiende por qué.
5. **Respaldo** (12.3 paso 1) y revisión de `pg_stat_activity`: ninguna transacción larga abierta.
6. **Aplicar**, un programa a la vez, con el ok de Mani:
   `SCRIPT_ACTOR_EMAIL=<tu correo de developer> npm run migracion:importar -- <template> --aplicar`.
   Cada programa entra en **una sola transacción**: si algo falla a la mitad, no queda nada escrito.
7. **Conciliar** (12.5). Si algo no cuadra, se decide ahí si se corrige o se revierte (12.3).
8. **Abrir:** aviso por el grupo de que desde ya se registra solo en el CRM. La primera hora, alguien del
   equipo técnico en línea para dudas.
9. **Registrar** en el handoff y en el ticket 078 la hora, los conteos y las rarezas.

Las pestañas **no se tocan** ese día: quedan como respaldo hasta el 082, que las pone en solo lectura
después de una semana hábil operando solo en el CRM (hito C).

### 12.3 Plan de reversa

Lo migrado se reconoce siempre: los deals y abonos por `huella_migracion`, y las llamadas por
`huella_fila` que empieza con `sheets:` (ADR 0059). Eso vuelve la reversa selectiva: nunca hace falta
tocar lo que entró por el webhook.

1. **Antes de aplicar, un respaldo:** `pg_dump` de producción por la conexión directa (5432) a un archivo
   **fuera del repo** (lleva datos personales), con la fecha y la hora en el nombre. Sin S1 es la única
   vuelta atrás para un daño que no venga de la migración.
2. **Falla durante `--aplicar`:** la transacción se deshace sola. No hay nada que revertir: se corrige la
   causa y se vuelve al paso 4 de 12.2.
3. **Aplicado pero mal, antes de abrir a los closers:** nadie tocó todavía los deals migrados, así que
   deshacerlos es borrar lo que lleva huella de ese programa, con
   `npm run migracion:deshacer -- --programa <slug>` (ticket 127). Sin `--aplicar` es un ensayo que solo
   imprime conteos; con `--aplicar` y el ok de Mani borra los deals migrados (con su historial y sus
   notas), sus abonos, las llamadas `sheets:` y las rarezas del programa, y deja una fila
   `reversa_migracion` por registro en `change_log`. Leads, envíos y lo que entró por el webhook o
   Calendly no se tocan. **Se niega sin borrar nada** si alguien ya trabajó encima (un reclamo, una
   edición, un abono o una llamada del CRM, un movimiento de etapa, una anulación): eso es el nivel 4.
   La alternativa es restaurar el respaldo del paso 1, que también se lleva lo que entró por el webhook
   en esas horas.
4. **Mal y con los closers ya trabajando:** no se revierte en bloque, porque encima ya hay trabajo real.
   Se corrige fila por fila: un deal o un abono migrado que no debía existir se **anula** con su motivo
   (ADR 0038: anular es "esto nunca pasó", y deja rastro); lo que faltó se carga a mano.
5. **El CRM no sirve para operar** (se cae o bloquea el trabajo): los closers vuelven a las pestañas, que
   siguen intactas hasta el 082. Lo que registraron en el CRM mientras tanto queda ahí y se reconcilia
   después, a mano. Es la razón para no apagar las pestañas hasta el hito C.

### 12.4 Capacitación

Una sesión por programa, con los closers, sobre la base local (`npm run dev:local`) y compartiendo
pantalla: ahí se pueden equivocar sin consecuencias. Solo lo que existe hoy.

**Closer**, cada uno lo hace una vez:

1. **Inbox:** reclamar un Setteo; ver los agendados sin dueño; asignar una llamada suelta de Calendly a su
   deal.
2. **Ficha del deal:** registrar un contacto con canal y nota (reemplaza los `Registro 1-5`); pegar el link
   de Grain después de la llamada (el deal pasa solo a Atendido); marcar un no show (va a Re-agenda); mover
   de etapa.
3. **Cobrar:** elegir el producto, registrar el abono con el link del comprobante (la foto llega con el
   035), poner la fecha límite de pago y la nota del acuerdo. El deal pasa solo a Abonado, y a Completo con
   saldo cero.
4. **Students:** marcar el onboarding desde la ficha y verlo en la lista de su cohorte.
5. **Leads:** confirmar o separar un posible duplicado.
6. **Recursos** (brochures y links de pago) y el **Dashboard** con su comisión.

**Lo que deja de hacer desde el corte:** escribir en las pestañas de gestión, llenar Sí/No a mano, mandar el
comprobante al grupo como registro y calcular su comisión. Todavía no existe su link de captación (092):
mientras tanto, un lead que trae un closer no queda atribuido a él.

**Gerente:** el Dashboard por programa y el comparativo entre closers; la cartera vencida en Students y en el
Inbox; reasignar deals sin dueño; `/ajustes/migracion` para revisar las rarezas los primeros días; usuarios,
membresías y cohortes.

### 12.5 Conciliación, el mismo día

- Por programa, los conteos del `--aplicar` coinciden con el último ensayo.
- En `/ajustes/migracion` se revisan las rarezas por tipo, primero las de plata (`abono_sin_deal`,
  `monto_cobrado_desconocido`, `fecha_aproximada`).
- **Students de la C2** contra la pestaña de estudiantes de la C2: las mismas personas y la misma caja por
  closer. La caja de julio y agosto cuadra por cohorte, no por día (ADR 0059 punto 6).
- En el **Kanban**, los deals migrados aparecen en su etapa y se pueden mover por el motor.
- Una muestra de 5 deals al azar: la ficha contra la hoja, fila por fila.
