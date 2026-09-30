---
id: 118
etapa: E6
serves: "ADR 0061 punto 7 · docs/analytics.md PT-03"
depends: [117]
status: todo
---

# 118 — "Se perdió en el Calendly": urgente arriba del Inbox

## Objetivo

Que un closer vea en minutos a quien llegó a la pantalla del Calendly y no agendó (Pauta: 73% de quienes
llegan son calificados; hoy no agenda el 43% en Tactical y el 51% en ComunicArte).

## Alcance

- **Dentro:** en el Inbox (071), una sección arriba: deals sin dueño en su etapa de entrada cuyo envío de
  origen tiene un estado con `alerta_minutos` (hoy `con_calendly_sin_agenda`) y cuyo token **no** tiene
  envío completo pasados esos minutos. Muestra "hace X min" y el origen.
- **Dentro:** el orden del Setteo usa la `prioridad` de la fila del estado: alta primero, después el score
  desc (070) y la recencia.
- **Dentro:** se calcula al leer; nada se guarda y no hay cron (ADR 0024).
- **Fuera:** el aviso por WhatsApp o correo (A2 de `plan.md` §7).

## Done cuando

- [ ] Un deal con parcial `con_calendly_sin_agenda` de hace 6 minutos sin completa aparece arriba; uno de
      hace 2 minutos no; uno cuya completa llegó tampoco. Con test.
- [ ] Recorrido en el celular sobre la base local, con la consola abierta.

## Kiro

Sí, con revisión visual.
