# 0069 — La etapa de entrada la decide el CRM con la agenda y la calidad; el formulario ya no manda `estado`

- **Estado:** aceptado · 1-oct-2026 (Mani: *"terminar de usar estado por completo, definir las etapas desde el
  CRM y no el formulario; estandarizado para todos los programas"*). **Reemplaza** al ADR 0061 cuando se construya con las etapas de 30X; hasta entonces rige el código del 117.
- **Relacionadas:** ADR 0061 (la tabla de Estados de llegada, ticket 117), ADR 0064 (varios formularios),
  `docs/comercial.md` (la operación de 30X, la misma para todos los programas; GC-27: ningún lead se descarta).

## Contexto

Con el 117, cada formulario manda una palabra (`estado`) y una tabla por programa la traduce a etapa. En la
práctica la palabra es redundante: se arma en cada formulario a partir de dos hechos que el formulario ya mide,
**si la persona agendó** y su **calidad** (`High` si no tiene respuestas descalificantes, `Low` si tiene). Eso
obliga a mantener la misma lógica en N formularios y N proveedores, y cuando una edición la rompe el CRM deja de
abrir deals sin error (29-sep, Tactical). Además la operación comercial es una sola para todos los programas: no
hay razón para que cada programa enrute distinto.

## Decisión

1. **Todo formulario manda tres hechos, iguales en todos los programas:** si agendó, `lead_quality` y
   `lead_value`. Ninguno se calcula en el CRM; el CRM solo **enruta** con ellos.
2. **La etapa de entrada sale de una regla única del CRM, la misma de 30X** (medida en su HubSpot el 1-oct,
   `docs/insumos/hubspot-30x-workflow.md` §3: su app de ingesta crea el deal así):

   | Formulario | Calidad | Agendó | Etapa de entrada (30X) | Hoy, mientras no entren las etapas de 30X |
   |---|---|---|---|---|
   | cualquiera | cualquiera | sí | **Agendado** | Agendado |
   | parcial o completo | High | no | **Calificado** (se le ofrece la agenda) | Pendiente Setteo, prioridad alta |
   | completo | Low (o Mid) | no | **Registrado** | Pendiente Setteo |
   | parcial | sin calidad | no | **Potencial** | Pendiente Setteo |

   Ningún envío se descarta (GC-27): todo envío abre deal o actualiza el abierto. En 30X un workflow pasa
   Potencial y Registrado a *En gestión* en minutos; eso es parte de la migración comercial, no de este ADR.
3. **"Agendó" lo dice la pregunta de agenda del mapeo de la fuente** (`agenda`, ticket 106): en Typeform, la
   respuesta con el link de Calendly; en Dapta, `data.agenda` lleno (`"booked"`, medido el 1-oct). La cita en sí
   la cuelga el webhook de Calendly (096).
4. **`lead_value` no cambia la etapa:** se guarda y ordena el trabajo, pero no enruta.
5. **La variable `estado` deja de leerse.** `estados_llegada` y su pantalla se retiran cuando el código nuevo esté
   desplegado; lo que llegue con `estado` se ignora sin error.
6. **El puntaje es UN estándar para todo formulario de todo programa** (Mani, 1-oct): las mismas preguntas que
   puntúan, los mismos puntos, los mismos descalificantes y los mismos tramos de `lead_value` y `lead_quality`.
   Solo cambian por programa los rangos de ingreso. El estándar está escrito en `docs/dapta/README.md`
   ("Estándar de puntaje"); un formulario que se aparte es un bug, no una variante.

## Cuándo se construye

- Mani (1-oct) aprobó la regla y pidió alinearla con la migración a 30X: se construye junto con las etapas
  nuevas (`docs/comercial.md`), no antes, para no migrar los deals dos veces.
- 30X tiene tres calidades (Low, Mid, High) y nuestros formularios dos (Low, High). Mid cae en Registrado.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Seguir con `estado` y la tabla por programa (ADR 0061) | La misma lógica copiada en cada formulario; una edición la rompe en silencio |
| Calcular la calidad en el CRM desde las respuestas | Rompe A8 (el CRM no califica) y duplica la lógica del scoring |
