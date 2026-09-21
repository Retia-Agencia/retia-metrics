---
id: 055
etapa: E3
serves: "plan v2 §6 etapa 3 · tarea E3-8 · insumo §5.6"
depends: [054]
status: todo
---

# 055 — Alertas: una fuente se rompe, no se apaga

## Objetivo

Que el CRM avise cuando dejo de poder leer bien una hoja, **sin desactivar la fuente**, y que el
aviso tenga acuse.

## Que dispara

- Una **pestana renombrada o borrada**.
- Un **encabezado promovido que desaparece**.
- **Tres fallos seguidos** del sync.

La fuente pasa a **`rota`** (columna creada en el ticket 039) y el gerente la repara eligiendo la
pestana o el campo otra vez.

## Por que `rota` y no `inactiva`

Desactivarla la saca del sync y **el problema deja de doler**: nadie la arregla y los leads dejan
de entrar en silencio. Rota sigue intentando y sigue avisando.

## Alcance

- **Dentro:** el estado `rota`, su deteccion y su reparacion.
- **Dentro:** **banner dentro de la app** que exige "visto", y el acuse queda en `change_log` con
  **quien lo vio**. 🎯 La leccion del semaforo de 30X: **una alerta sin acuse es decoracion.**
- **Dentro:** destinatarios: gerentes del programa y developers.
- **Fuera:** el correo como segundo canal. Se agrega si el equipo lo pide.

## Done cuando

- [ ] Renombrar una pestana en una hoja de prueba pone la fuente en `rota` y **no la desactiva**.
- [ ] Quitar un encabezado promovido hace lo mismo.
- [ ] El banner no se puede cerrar sin dejar el acuse en `change_log`.
- [ ] Reparar la fuente la devuelve a `activa` y deja su fila de rastro.

## Kiro

Si, con revision visual del banner.
