---
id: 209
etapa: corte
serves: "reunión del 8-oct (Jero, setter): ver en Leads lo mismo que en la hoja"
depends: []
status: done
---

# 209 — Leads: "Mostrar respuestas del formulario" como columnas

## Por qué existe

Jero, el setter de los dos programas, abre la conversación desde la respuesta abierta (*"¿Qué te motivó a
hacer parte del programa?"*): ahí ve el dolor del lead. En la hoja la tiene como columna. En el CRM solo
está dentro del envío, en la ficha del lead. Pidió que el CRM no le dé menos información que la hoja, y que
la columna **Canal** no le sirve como setter.

## Decisión (reunión del 8-oct)

Un control en la barra de Leads, **"Mostrar respuestas del formulario"**, que muestra u oculta columnas con
las respuestas del último envío del lead, como ocultar columnas en Sheets. Apagado por defecto.

## Por decidir antes de construir

- ¿Todas las preguntas del formulario o se eligen? Recomendación: el usuario elige cuáles mostrar, y la
  elección se recuerda por persona (preferencia de vista, no dato del lead).
- ¿Canal se oculta por defecto para el setter o se deja? Recomendación: entra en el mismo selector de
  columnas en vez de una regla por rol (ADR 0077: menos configuración que operar).
- Las preguntas salen del envío (`respuestas`) del programa, nunca de títulos escritos en el código
  (`tests/ingesta-estado.test.ts`).

## Done cuando

- [ ] En Leads de cada programa se encienden y apagan las columnas de respuestas, en tabla y en celular.
- [ ] La respuesta larga se corta en la celda y se lee completa al pasar o abrir.
- [ ] Recorrido con un setter.
