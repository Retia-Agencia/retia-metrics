---
id: 201
etapa: O7
serves: "docs/anotaciones.md A-102, A-103, A-104; ticket 183; ADR 0049, 0076, 0077"
depends: [183, 096, 157]
status: done
---

# 201 — Novedades de Deals y Calendly para el closer

Sesión Kiro `deal-call-notifications`, revisada y cerrada por la sesión central. Lleva migración; la sesión
central la genera y la aplica solo después de aprobar el diff.

## Por qué existe

Los cambios de Calendly ya se reflejan dentro de la llamada, y un Deal asignado aparece en el tablero, pero
ninguno avisa a su dueño. El closer se entera solo si abre a mirar. A-102 conserva la cancelación como alerta
propia y A-103/A-104 hacen que lo nuevo sea visible, personal y descartable sin crear otra pantalla ni mezclar
programas.

## Decidido

1. Un Deal asignado o reasignado tiene una novedad para su dueño actual. El Kanban lo muestra con `Nuevo` y el
   resalte morado de Tinta hasta que ese dueño abre la ficha. Un Deal creado manualmente por el mismo closer ya
   está visto. Los Deals históricos no se convierten en nuevos y quitar el dueño quita la novedad.
2. Un único contrato cambia dueño + novedad. Lo usan creación del sistema, reclamo, reasignación y Calendly; nadie
   escribe esos dos campos por separado.
3. Mi espacio › Necesita atención pone arriba una cola personal de novedades de Calendly: cita nueva, reagenda,
   cancelación, no-show y corrección del no-show. Las no leídas van primero; las leídas quedan grises debajo.
   Abrir una novedad la marca vista y abre el Deal; también se puede marcar vista sin abrir.
4. La cancelación conserva urgencia comercial explícita (`Urgente`, tono peligro). Sin dueño no hay destinatario.
5. Cada novedad queda ligada a usuario, programa, Deal y llamada. La frontera es `(user, program)` tanto al leer
   como al marcar. El escritor valida que llamada y Deal vigentes pertenezcan al mismo programa.
6. La deduplicación vive en la base. Calendly no manda un id común para estos cuatro webhooks, así que la clave
   durable usa tipo de evento + `created_at` de la entrega + UUID del invitado: un retry conserva el mismo cuerpo,
   pero el ciclo legítimo no-show → corregido → no-show trae otro instante y vuelve a notificar. Una cita resuelta
   por la ingesta (sin webhook) usa la identidad única de su llamada.
7. Abrir la ficha durante “Ver como closer” no consume la novedad del closer real. Las acciones de lectura exigen
   la sesión real y no confían en ids, rutas ni programas enviados por el cliente.

## Modelo

- `deals.owner_novedad_en timestamptz null`, sin default de novedad.
- enum `tipo_notificacion_calendly`: `cita_nueva`, `cita_reagendada`, `cita_cancelada`, `cita_no_show`,
  `cita_no_show_corregida`.
- `notificaciones_calendly`: `id`, `user_id`, `program_id`, `deal_id`, `call_id`, `tipo`, `clave_evento`,
  `leida_en`, `created_at`; FKs e índices de consulta; unique `(program_id, tipo, clave_evento)`.

## Done cuando

- Asignar, reasignar y reclamar enciende `Nuevo`; creación manual propia e históricos no. Abrir como el dueño lo
  apaga; otro usuario, otro programa o una suplantación no.
- Los cinco cambios de Calendly crean una sola novedad para el dueño actual; sin dueño no crean. Retries no
  duplican y un segundo no-show después de corregir sí crea otra.
- Mi espacio muestra no leídas arriba y leídas grises abajo; abrir y “Marcar vista” cambian el estado. Cancelación
  dice `Urgente`.
- Tests de consulta, mutación, UI y guardas cubren idempotencia, otro programa, otro usuario, legado, reasignación y
  lectura al abrir.
- Tests focales, typecheck, lint y build limpios; suite completa en el checkpoint central.
