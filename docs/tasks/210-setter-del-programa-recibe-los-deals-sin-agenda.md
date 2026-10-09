---
id: 210
etapa: corte
serves: "reunión del 8-oct (Jero): reclamar uno por uno le alarga el trabajo"
depends: [157]
status: review
---

# 210 — El setter del programa recibe solo los deals sin agenda

## Por qué existe

Hoy un deal que entra sin cita cae sin dueño en "Por setear" del Inbox y alguien lo reclama (070). Jero es el
único setter de ComunicArte y Tactical: reclamar uno por uno solo le alarga el trabajo. Mani no quiere esa
regla fija en el código ("siempre a Jero"), porque Retia va a sumar programas y setters.

## Decisión (reunión del 8-oct)

Cada programa puede tener un **setter por defecto**. Si lo tiene, los deals que nacen sin agenda (Potencial,
Registrado, Calificado) le llegan con él de dueño; si no, siguen al Inbox como hoy. Los agendados siguen
siendo de la host de la cita (096).

## Por decidir antes de construir

- Dónde vive: recomendación, una marca en `miembros_programa` ("setter por defecto", a lo sumo uno activo por
  programa, con índice único parcial), porque es un dato del vínculo persona-programa y se edita desde la app
  (ADR 0012). Alternativa: `programs.setter_por_defecto_user_id`.
- ¿Se llena también `deals.setter_user_id` (157) al asignar? Recomendación: sí, es el crédito del setter.
- ¿Qué pasa con los que ya están en "Por setear" al activarlo? Recomendación: nada automático; un botón
  "asignarme todos" lo resuelve sin una regla retroactiva.

## Done cuando

- [ ] Configurable por programa desde la app, con rastro.
- [ ] Un envío sin agenda en un programa con setter nace con dueño; con agenda, sigue siendo de la host.
- [ ] Tests de la regla en los dos sentidos (con y sin setter configurado).
