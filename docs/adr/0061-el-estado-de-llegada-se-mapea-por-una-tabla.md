# 0061 — El Estado de llegada lo manda el formulario y una tabla por programa lo lleva a su etapa

- **Estado:** aceptado · 29-sep-2026 (Mani, en la sesión que mapeó la reunión con Pauta). **Reemplaza el
  ADR 0054** (queda en la tabla de retirados de `README.md`).
- **Relacionadas:** ADR 0004 (se guarda como llegó), ADR 0012 (instancias en la base), ADR 0036 (el
  envío, parcial y completo), ADR 0037 (dónde nace un deal), ADR 0055 y 0058 (el webhook), ADR 0060 (el
  origen es del envío); tickets 117 y 118; `docs/analytics.md` DP-8 a DP-10.

## Contexto

Tres hechos del 29-sep:

1. **El Typeform de Tactical perdió sus reglas de `estado`** entre las 11:26 y las 11:40, en la edición que
   agregó el scoring. El CRM solo abre un deal con `descartado`, `setteo_no_calificado` o `con_calendly`, y
   sube a `con_calendly` solo desde `setteo_no_calificado` (`estadoConAgenda`). Resultado: ningún envío de
   Tactical abrió deal entre las 11:40 y las 20:11 (23 envíos, 9 con cita), **sin un solo error**. La lógica de "qué valor va a
   qué etapa" vivía en el código, y una edición del formulario la rompió en silencio.
2. **Pauta quiere llamar en minutos a quien llegó al Calendly y no agendó.** De quienes ven el Calendly no
   agenda el 43% (Tactical) y el 51% (ComunicArte). El Calendly es obligatorio, así que esa persona no
   envía nada y hoy se pierde entera.
3. **Mani:** *"todo el que llene el form es potencial de contacto"*; el Estado solo decide dónde empieza el
   deal, lo que importa después es `lead_quality` y `lead_value`; y el CRM no tiene que pensar: *"si en
   algún futuro agregamos otros valores posibles, el CRM solo tiene que recibirlos"*. La variable se sigue
   llamando `estado`, para no romper nada.

## Decisión

1. **El formulario manda el Estado en la variable `estado`, y una tabla por programa, `estados_llegada`,
   dice a qué etapa entra el deal y con qué prioridad.** Cada fila: el valor tal como lo manda el
   formulario, la etapa de entrada (Pendiente Setteo, Agendado o ninguna), la prioridad y, si aplica, los
   minutos tras los cuales es urgente. Es catálogo (ADR 0012): un valor nuevo o un programa nuevo es una
   fila, no código.
2. **Valores de hoy:**

   | Valor | Cuándo lo pone el formulario | Etapa de entrada | Prioridad |
   |---|---|---|---|
   | `setteo_no_calificado` | completó sin pasar por el Calendly (camino a la página de gracias) | Pendiente Setteo | normal |
   | `con_calendly_sin_agenda` | va hacia el Calendly; llega en el envío parcial previo al Calendly | Pendiente Setteo | **alta**, urgente a los 5 minutos |
   | `con_calendly` | lo sube el CRM (punto 4) | Agendado | · |

3. **`descartado` desaparece para lo nuevo.** Quien dijo no tener recursos también es contacto; va a
   Setteo y el `lead_value` lo ordena al final. Mientras un formulario lo siga mandando, su fila existe y
   el gerente decide su etapa; lo histórico conserva su texto (ADR 0004).
4. **Lo único que queda en el código es un HECHO, no una regla de negocio:** si la respuesta de la
   pregunta de agenda (la que nombra la llave `agenda` del mapeo de la fuente, no una heurística) trae un link de
   Calendly, el envío es `con_calendly`, venga con el valor que venga. Entrar a Agendado exige leer esa cita
   (ticket 052); si no se encuentra, el deal entra en Pendiente Setteo con la nota del sistema, como hoy.
5. **Un valor vacío o que la tabla no tiene no se adivina:** el envío queda como lead sin deal, visible y
   contado en "sin estado" (en la salud de la fuente y en la tab Leads). Así un formulario editado mal se ve
   el mismo día, no cuando alguien nota que no llegan deals.
6. **Los envíos parciales:** el webhook recibe `form_response_partial`. Hay dos puntos de envío parcial:
   el que ya existe tras el WhatsApp y uno nuevo justo antes del Calendly. El primero llega sin `estado`: es
   lead sin deal, visible en Leads como "abandonó el formulario". El segundo llega con
   `con_calendly_sin_agenda` y abre el deal. Parcial y completa comparten token (ADR 0036): si llega la
   completa con la cita, el mismo deal pasa a Agendado por el motor; no hay segunda persona ni segundo deal.
7. **"Se perdió en el Calendly" no se guarda:** es un deal en su etapa de entrada, con estado
   `con_calendly_sin_agenda`, sin la completa de su token pasados los minutos de su fila. Se calcula al leer
   el Inbox; no hay cron. El aviso fuera de la app (WhatsApp o correo) es del mecanismo único de alertas
   (A2 de `plan.md` §7).

## Consecuencias

- `estadoDesdeTexto` deja de traducir tres valores fijos: lee la tabla. `calificacion_envio` (enum) queda
  para lo histórico hasta que el 117 decida si se retira; el texto de `submissions.estado_hoja` es lo que
  llegó.
- Orden de despliegue: **primero el CRM entiende los valores y los parciales, después el formulario los
  manda.** Al revés se repite el hecho 1.
- El parche del 29-sep (Tactical pone `setteo_no_calificado` a todos) queda obsoleto con el 117, sin
  tocarlo.
- Los 23 envíos de Tactical sin estado (11:40 a 20:11) se reprocesan con la regla nueva, con el ok de Mani.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Sin estado: el CRM infiere de "¿es parcial?" y "¿trae cita?" | Con dos puntos parciales, "parcial" no dice si llegó al Calendly; solo el formulario sabe el camino |
| Valores fijos en el código (lo del ADR 0054) | Es lo que se rompió en silencio el 29-sep; cada programa nuevo pediría código |
| Un valor `con_calendly` puesto por el formulario | Duplicaría el hecho que el CRM ya lee del link; con dos fuentes de la misma verdad, un día discrepan |
| Mantener `descartado` sin deal | Mani: todo el que llena el formulario es contacto |
