# 0054 — El Estado de llegada lo pone el formulario; el CRM lo valida

**Fecha:** 2026-09-27 · **Estado:** aceptado (Mani, 27-sep) · **Cierra:** la decisión A1 de
`docs/plan.md` §7 · **Toca:** ADR 0004 (lo abierto sobre quién calcula el Estado), T2
(`lib/ingesta/calificacion.ts`), tickets 051 y 052

## El problema

Hoy el Estado de llegada (Descartado, Setteo, Con Calendly) lo escribe un Apps Script en cada hoja,
cada 10 minutos. Leído el 27-sep en la copia de `work/retia/apps-script-sheets/`: **las dos hojas
usan las mismas cuatro reglas**, en este orden:

| Si el envío… | Estado de la hoja | Calificación del CRM |
|---|---|---|
| no respondió la pregunta de pago | 🗑️ Descartado (incompleto o duplicado) | `incompleto` |
| respondió "No, en este momento no cuento con los recursos" | 🗑️ Descartado (sin recursos) | `sin_recursos` |
| trae un link de Calendly en "Agenda aquí tu entrevista" | 📅 Con Calendly | `con_agenda` |
| puede pagar y no agendó | 📞 Setteo No Calificado | `setteo` |

No es un puntaje: es una respuesta más un hecho (agendó o no). El filtro por ingreso ya vive en el
Typeform, que decide a quién le muestra el Calendly. El 22-sep se decidió que el CRM replicara esas
reglas (T2, construido: 6.397 de 6.400 envíos coinciden con la hoja). El 27-sep Mani pidió que **el
lead llegue con el Estado ya puesto por el formulario**, y que el script de la hoja se borre.

## Decidimos

**1. El formulario manda el Estado en una variable.** En Typeform, una variable de texto `estado` que
la lógica cambia en la pregunta de pago: `sin_recursos` si responde que no tiene recursos, `califica`
en cualquier otro caso. Llega en el webhook, en `form_response.variables` (verificado en el payload de
ejemplo de Typeform). El mismo contrato vale para cualquier formulario (ADR 0055).

**2. Lo que es un HECHO no lo decide el formulario, lo lee el CRM del envío:**

- **Agendó:** la respuesta del bloque de Calendly viene en el payload. `califica` + respuesta de agenda
  = `con_agenda`; `califica` sin ella = `setteo`.
- **Incompleto:** es el envío parcial (el formulario manda el parcial con un *partial submission
  point*, ADR 0055). Un parcial sin completo es `incompleto`.

**3. T2 se queda como validador.** Para cada envío el CRM calcula también las cuatro reglas sobre las
respuestas. Si no coincide con lo que dijo el formulario, **gana el formulario y la discrepancia se
reporta como error visible**. Una regla mal puesta en el Typeform clasifica mal sin lanzar ningún
error; el validador es lo único que lo ve.

**4. Un envío sin `estado`, o con un valor que el CRM no reconoce, no se adivina:** queda sin
calificar y se reporta (la regla de siempre, `docs/plan.md` §4.3b).

**5. El script de la hoja se borra DESPUÉS del hito B** (los closers operan en el CRM), no antes. El
script además copia cada lead a la pestaña Setteo, que es donde trabajan los closers hoy: borrarlo
antes los deja sin leads nuevos, sin que nada avise.

## Consecuencias

- Hay que editar los dos Typeform (la variable y su regla). Lo hace quien tenga acceso a Typeform; el
  CRM no puede hacerlo.
- `calificarEnvio` cambia de papel: de fuente del Estado a validador. Su configuración por fuente
  (`sources.calificacion`) sigue sirviendo.
- El orden del Setteo por ingreso (ticket 070) no cambia: sigue siendo la pregunta de ingreso
  configurable por fuente.
- Siguen abiertos, sin bloquear: D4 (`leads.estado` texto frente a `calificacion`) y T4 (el valor del
  puntaje). Si el formulario un día manda un puntaje real, entra como otra variable.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Que el CRM siga calculando el Estado (T2 solo) | Mani quiere que la regla viva en el formulario, donde se edita la pregunta |
| Que el formulario también diga "agendó" | La lógica de Typeform corre antes de que el lead agende; el hecho ya viene en la respuesta |
| Retirar T2 | Una regla mal puesta en el form pasaría callada; el validador ya está construido |
| Borrar el script ya | Los closers dejan de ver leads nuevos en Setteo hasta el hito B |

---

## Enmienda 2026-09-27, noche (Mani): el CRM no califica; confía en el formulario

Mani, al revisar los tickets del paso 2: *"Estado viene ya con valor directamente del forms, el CRM NO
se encarga de calcular ni calificar ningún lead; se confía en los valores que vienen del forms."* Y:
*"sin recursos es descartado; quiero usar los nombres como lo manejan ya."*

Reemplaza los puntos 1 a 4 de arriba:

**1. El formulario manda el Estado completo, con los nombres de la hoja.** Son tres, los mismos que
escribe hoy el Apps Script (leídos en `work/retia/apps-script-sheets/`):

| La hoja escribe | El formulario manda en `estado` | Qué hace el CRM (ticket 052) |
|---|---|---|
| 🗑️ Descartado | `descartado` | no abre deal |
| 📞 Setteo No Calificado | `setteo_no_calificado` | abre deal en Pendiente Setteo |
| 📅 Con Calendly (Tactical: "Con Calendly (Juanito)") | `con_calendly` | abre deal en Agendado |

"Sin recursos" e "incompleto" ya no son estados propios: los dos son **Descartado**, como en la hoja.
La pantalla muestra el nombre de la hoja; el código usa el valor sin tildes ni emoji.

**2. El CRM no deduce nada.** Ni "agendó" desde el bloque de Calendly ni "incompleto" desde el parcial:
lo que diga el formulario es el Estado.

**3. T2 no corre.** `calificarEnvio` queda en el repo, desconectado de la ingesta, porque sigue abierta
la pregunta de si el Estado lo calcula el formulario o una función del CRM por programa (decisión A8 de
`docs/plan.md` §7). El 052 no depende de esa respuesta: lee `leads.calificacion` y no sabe quién la
escribió.

**4. Sigue en pie:** un envío completo sin `estado`, o con un valor fuera de los tres, no se adivina:
el lead entra sin deal y el envío se reporta como error visible.

**El formulario sí sabe si agendó** (Mani, 27-sep, corrige lo que este ADR suponía arriba): el
Calendly es un embed dentro del formulario; si el lead agenda, el link vuelve al formulario y este le
asigna `con_calendly`. Se asume que todo el que agenda llega con su link de Calendly y con ese Estado.
El envío real del ticket 106 lo confirma, no lo decide.

**Cierra D4** (`docs/plan.md` §7.1): se decide con `leads.calificacion`, la lista de tres valores.
`leads.estado` (texto, ADR 0032) queda como lo que escribió la hoja, para comparar en la migración;
nadie decide con él.
