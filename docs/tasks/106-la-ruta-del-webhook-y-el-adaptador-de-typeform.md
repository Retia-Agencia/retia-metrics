---
id: 106
etapa: E3
serves: "ADR 0055 · ADR 0054 (enmienda) · plan §4.3a · hito A"
depends: [105, 051]
status: done
---

# 106 — La ruta del webhook y el adaptador de Typeform

## Objetivo

Que un envío de Typeform llegue solo al CRM: la ruta verifica, el adaptador traduce y
`ingerirEntradas` escribe. Con esto se cumple la primera mitad del hito A.

## El camino

1. `POST /api/webhooks/formularios/[fuente]`. Si el id no es una fuente webhook activa: 404, sin leer
   el cuerpo (error visible en el log).
2. Firma HMAC-SHA256 sobre el **cuerpo crudo** con el secreto de esa fuente. Si no cuadra: 401.
3. **El adaptador de Typeform** convierte `form_response` en un Envío: respuestas por pregunta, campos
   ocultos (UTM), la variable `estado` (051), el token del envío y si es parcial.
4. `ingerirEntradas` con la regla de deals encendida (052).

## Las reglas

- **"Agendó" lo lee el adaptador** (ADR 0054, segunda enmienda): Typeform solo manda `descartado` o
  `setteo_no_calificado` en la variable `estado`. Si dice `setteo_no_calificado` y la respuesta de la
  pregunta de agenda (la que el mapeo de la fuente marque como agenda) contiene un link de Calendly, el
  Estado del Envío es `con_calendly`. `descartado` nunca sube. Es una función pura con su test por fila.

- **Nunca responde con redirección** y la ruta va en la lista pública de `proxy.ts`, o cada envío falla
  sin que nadie lo vea.
- **Un envío que no se puede procesar (firma buena, contenido malo o la ingesta falla): se guarda el
  sobre crudo y se responde 200** (Mani, 27-sep). Así no se pierde el lead y se puede reprocesar.
  Guardarlo es una tabla nueva (migración de la sesión principal) con la fuente, el cuerpo, el error y
  si ya se reprocesó.
- El programa sale de la fuente, **nunca** del payload.
- Idempotente por `(fuente, token, es_parcial)`: el reintento de Typeform no duplica (migración 0022).

## Done cuando

- [x] Con el payload de ejemplo de Typeform: firma buena crea lead, envío y contactos; firma mala es 401
      y la base no se mueve; el mismo envío dos veces deja una fila.
- [x] Un payload sin correo queda en la tabla de sobres crudos y la respuesta es 200.
- [x] Una URL con un id que no es fuente activa es 404.
- [x] Un envío real de cada Typeform en `dev`, con la variable `estado` y el parcial. El que agenda
      llega con `setteo_no_calificado` y su link de Calendly, y el CRM lo guarda como `con_calendly` (ADR
      0054, segunda enmienda); el link queda en `submissions.respuestas` para el 096.
- [x] `npm test`, `npm run typecheck` y `npm run lint` limpios.

## Kiro

Sí el código y los tests, con revisión. La migración de los sobres la escribe y aplica la sesión principal.

---

## Avance 2026-09-28 (Kiro, revisado por la sesión principal)

- **Hecho:** `app/api/webhooks/formularios/[fuente]/route.ts` (404 sin leer el cuerpo si el id no es
  UUID o no es una fuente webhook activa de Typeform; firma `Typeform-Signature: sha256=<base64>` sobre
  el cuerpo crudo, en tiempo constante; sobre crudo + 200 si la firma es buena y no se puede procesar),
  `lib/ingesta/adaptador-typeform.ts` (respuestas por título de pregunta, hidden fields, la variable
  `estado` a `estadoHoja`, parcial por `event_type`), la ruta en la lista pública de `proxy.ts`, y
  `sobres_crudos` (migración **0029**, sesión principal) declarada como dependiente de `sources`.
- **"Agendó":** la pregunta de agenda es la llave **`agenda`** de `sources.mapeo_columnas`, con el
  título de la pregunta. Sin ella, nunca sube a `con_calendly`; sin heurística sobre las demás respuestas
  (ADR 0054, segunda enmienda).
- **La revisión corrigió:** un id que no era UUID salía como 500 (ahora 404, con test) y un comentario de
  `lib/catalogo/fuentes.ts` que describía una llave y una heurística que el código no tiene.
- **Falta para cerrar:** (1) el envío REAL de cada Typeform. Los tests usan un payload armado a mano:
  el nombre del evento parcial (`form_response_partial`) y la forma de la respuesta de Calendly en el
  webhook están sin confirmar. (2) Crear la fuente webhook de cada programa en producción, con su
  `agenda`, y pegar la URL y el secreto en Typeform. (3) El Partial Submit Point.
- Un envío completo sin correo queda **dos veces**: como `submissions` sin lead (lo escribe la ingesta)
  y como sobre crudo (para poder reprocesarlo). Es lo que pide el ticket; se anota para el reproceso.

## Avance 2026-09-28 (tarde, envío real)

- Las dos fuentes webhook existen en producción (Mani, desde la app): `f919d215…` ComunicArte y
  `e3007c99…` Tactical, activas, con `{"agenda": "agenda aqui tu entrevista"}`; las de Sheets quedaron
  inactivas. Una petición sin firma recibe 401 en las dos.
- 🩸 **Primeras 4 entregas de Typeform: 401.** El secreto se generó en la app pero no se pegó en el campo
  Secret del webhook de Typeform; sin él Typeform no firma. La ruta hizo lo correcto, pero el log no
  distinguía "sin firma" de "firma que no cuadra".
- **Partial Submit Point: decisión abierta del equipo** (Mani lo consulta). Hoy ningún formulario lo
  tiene, así que un abandono no sale de Typeform. El envío real del parcial queda fuera del "Done
  cuando" hasta que se decida; el código lo soporta sin probar contra el payload real.
- **Ya llegan envíos reales de los dos programas** (con el secret pegado). Las dos entregas rechazadas de
  ComunicArte: la de las 12:18 era un lead real y entró con Redeliver (Carolina Agudelo); la de las
  12:24 (17:24:35Z) **no corresponde a ninguna respuesta** en ningún Typeform (Mani lo verificó): era una
  petición de prueba de Typeform, no un lead. No se perdió ninguno.

## Cierre 2026-09-28 (ADR 0058)

El envío real destapó huecos por donde se perdían datos sin error. Kiro los cerró (revisado por la sesión
principal, que escribió y aplicó en producción las migraciones **0033** y **0034**):

- **Nombre del lead:** `submissions.nombre` (0033, rellenó lo ya entrado); el lead toma el del envío
  completo más reciente y conserva el suyo si ningún envío lo trae. Todo correo y teléfono va a
  `lead_contactos`.
- **Un solo mapeo** para webhook y hoja (`lib/ingesta/mapeo-webhook.ts` sobre `combinarMapeo`). Antes
  el webhook ignoraba en silencio las llaves de producción (`emailNormalizado`) y no heredaba la plantilla.
- **Caja negra** (0034): el cuerpo crudo de cada envío con firma buena; `error` nulo = procesado.
- **Variables genéricas**: toda variable de Typeform entra a `respuestas` como `variable:<nombre>`; cuál es
  el Estado lo dice el mapeo (`estadoHoja`, defecto `estado`).
- **`xxxxx` en un UTM = sin UTM** (Mani).
- **Re-agenda:** una cita vigente sobre un deal en 4-7 crea su llamada en el mismo deal
  (`agregar_llamada`, Mani). **Agendó y después descartado:** el deal sigue en Agendado (Mani).
- **Matriz de casos** contra la ruta real: `tests/webhook-matriz.test.ts`.
- **Fuera:** el parcial real, hasta que el equipo decida el Partial Submit Point; y distinguir en el log
  "sin firma" de "firma que no cuadra" (propuesto, sin decidir).
