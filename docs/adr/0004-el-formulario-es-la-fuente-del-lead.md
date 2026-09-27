# 0004 — El formulario es la fuente del lead, y lo que manda una fuente se guarda como llegó

**Fecha:** 2026-08-18 · **Reescrito:** 2026-09-27 (consolida las decisiones T1 y T3 del 22-sep y los
ADR retirados 0008 y 0032) · **Estado:** aceptado

## De dónde viene

En agosto Google Sheets era la fuente de verdad de todo: el formulario escribía en la hoja, un Apps
Script clasificaba, los closers registraban llamadas y ventas a mano en otras pestañas, y el CRM
solo reflejaba. Se fue estrechando: las llamadas y ventas pasaron al CRM (15-sep), el responsable y
el alta manual también (16-sep), y el 21-sep Mani lo dijo entero:

> *"Cuando el CRM se vuelva el centro, las llamadas, etc. solo van a vivir aquí. Lo único que va a
> entrar de afuera son Leads crudos que llenan un forms de un programa."*

El 22-sep se decidió cómo entran esos leads: por webhook, con **corte directo** (sin convivencia con
el sync de la hoja).

## Decidimos

**1. Un lead entra solo por el formulario de su programa, o por alta manual de un closer.** El
formulario llega por webhook a la puerta única de ingesta (`lib/ingesta/`). El alta manual es el
respaldo para el lead que llegó por WhatsApp, un evento o un referido (ADR 0044).

**2. Todo lo demás nace y vive en el CRM:** deals, etapas, dueño, llamadas, abonos, actividades.
No hay escritura de vuelta a Sheets.

**3. Lo que manda una fuente se guarda como llegó.** El texto de los UTM, los nombres escritos a
mano en las hojas y las respuestas del formulario no se normalizan ni se reescriben. Cuando hay que
comparar, se normaliza del lado de la lectura (ADR 0030); cuando hay que clasificar, se hace con
reglas del catálogo (ADR 0045, 0051), que reparan hacia atrás sin tocar el crudo. Reescribir el
crudo para que "cuadre" borra la evidencia de lo que pasó.

**4. Lo que hay hoy en Sheets se traslada una sola vez, por la misma puerta.** El adaptador de
Sheets (`lib/ingesta/adaptador-sheets.ts`) convierte cada fila en el mismo Envío que produciría el
webhook, así que un envío que llegó por las dos vías no se duplica. Después vienen la migración de
las pestañas de gestión (etapa E7) y su apagado (ticket 082).

## Lo que queda abierto

✅ **Cerrado el 27-sep por el ADR 0054** (el formulario manda el Estado y el CRM lo valida; el webhook, ADR 0055). Contexto previo: **Quién calcula el `Estado` de llegada** (Descartado, Setteo, Con Calendly). El 22-sep se decidió
que lo calcula el CRM con las reglas del Apps Script (T2, construido); el 27-sep Mani pidió que lo
asigne el formulario con su scoring. Está en `docs/plan.md` §7 (A1). Mientras tanto, el traslado
guarda el Estado de la hoja tal como vino (`submissions.estado_hoja`) y la calificación del CRM al
lado, para compararlas.

## Riesgo operativo

Typeform tiene que seguir escribiendo en Sheets hasta que los closers trabajen en el CRM, aunque el
CRM ya no la lea. Si se corta antes, los closers se quedan sin ver los leads nuevos.
