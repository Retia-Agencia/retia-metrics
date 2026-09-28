# 0058 — El webhook no pierde nada

- **Estado:** aceptada · 28-sep-2026 (Mani)
- **Relacionadas:** ADR 0004 (se guarda como llegó), ADR 0012 (instancias en la base), ADR 0036
  (qué se promueve), ADR 0054 (el Estado lo manda el formulario), ADR 0055 (el webhook estándar),
  ADR 0057 (la cita de Calendly), tickets 052, 096 y 106

## Contexto

El 28-sep entraron los primeros envíos reales de Typeform a producción. Funcionó el camino entero
(firma, Estado, cita, deal en Agendado con su llamada), pero el envío real destapó huecos por donde se
perdían datos **sin lanzar un error**:

- el lead quedaba **sin nombre** (la ingesta nunca lo escribía), así que el buscador de Personas no lo
  encontraba;
- el mapeo de una fuente webhook **no heredaba** la plantilla del programa y leía llaves que no son las
  de producción (`emailNormalizado`), que se ignoraban en silencio;
- solo se leía la variable `estado`: cualquier otra variable de Typeform se descartaba;
- el cuerpo crudo solo se guardaba si algo fallaba;
- el Forms Link trae `utm_*=xxxxx` como plantilla, y ese texto habría entrado como un origen real;
- una re-agenda con otra cita sobre un deal ya en Agendado **perdía la fecha nueva**.

Mani: *"toca que TODOS los campos del envío lleguen al CRM sin fallo"* y *"testear todos los casos
posibles para encontrar fallas rápido, así en producción no se pierden leads"*.

## Decisión

1. **Caja negra.** Todo envío con firma buena guarda su cuerpo crudo en `sobres_crudos` apenas la
   firma cuadra (`error` nulo = se procesó bien). Si algo falla después, esa misma fila guarda el
   error y la ruta responde 200. Guardar el sobre nunca tumba la ingesta del lead (migración 0034).
2. **Capturar es genérico; entender es configuración.** Toda respuesta, campo oculto y **variable**
   de Typeform entra sola a `submissions.respuestas` (las variables con el prefijo `variable:`). Qué
   variable es el Estado lo dice el mapeo de la fuente (`estadoHoja`, por defecto `estado`), igual que
   `agenda`. Una variable nueva no cambia nada en el CRM hasta que una decisión de producto le dé uso.
3. **Un solo mapeo para webhook y hoja.** Misma precedencia (defecto ← plantilla del programa ←
   fuente) y la misma función (`combinarMapeo`); la traducción del vocabulario de la hoja al del Envío
   vive en un solo lugar (`lib/ingesta/mapeo-webhook.ts`). `agenda` solo cuenta si alguien la
   configuró, nunca por defecto del código.
4. **El lead lleva su nombre y todo su contacto.** `submissions.nombre` se promueve (migración 0033)
   porque el resumen del lead se recalcula desde los envíos: gana el del envío completo más reciente; si
   ningún envío trae nombre, el lead conserva el suyo. Todo correo y todo teléfono de todos los envíos
   van a `lead_contactos`.
5. **`xxxxx` en un UTM es un centinela, no un dato:** se guarda como "sin UTM" en los cinco campos.
   Lo demás sigue guardándose como llegó (ADR 0004).
6. **Re-agenda (caso 7c):** una cita **vigente** sobre un deal en 4, 5, 6 o 7 crea su llamada en el
   mismo deal, sin moverlo (`agregar_llamada`). La misma cita dos veces no duplica (huella
   `calendly:<uuid>`). Cancelar la vieja cuando Calendly avise es del ticket 096.
7. **Agendó y después se descartó (caso 7a):** el lead toma el Estado del envío más reciente
   (`descartado`) y su deal **sigue en Agendado**. Una llamada agendada es una oportunidad viva; decide
   el closer en la llamada, no un segundo formulario.

## Consecuencias

- Una matriz de casos contra la ruta real (`tests/webhook-matriz.test.ts`) fija cada uno de estos
  comportamientos: reintentos, envíos fuera de orden, re-aplicaciones, frontera de programa, envíos sin
  correo o sin nombre, tipos de respuesta desconocidos, Calendly caído, firmas malas, entregas
  simultáneas y el invariante "ningún error después de la firma pierde el lead".
- Sigue sin llegar lo que Typeform no manda: un formulario abandonado sin Partial Submit Point, y una
  entrega rechazada antes de la firma (solo vuelve con Redeliver).

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Guardar el sobre crudo solo cuando falla | Un adaptador que lee mal sin lanzar deja el envío como "bien" y el payload original desaparece |
| Que cada variable nueva de Typeform actúe sola sobre el lead | El código decidiría por un campo que nadie configuró; es una heurística, no configuración (ADR 0012) |
| Mover el deal a Pendiente Setteo cuando llega un `descartado` después de agendar | Un segundo formulario decidiría por el closer sobre una llamada ya agendada |
| Ignorar la segunda cita porque el deal ya está en Agendado | El closer llamaría a la hora vieja |
