---
id: 118
etapa: E6
serves: "ADR 0061 punto 7 · docs/analytics.md PT-03"
depends: [117]
status: done
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

## Decisión D-7 (ADR 0071; Mani, 2-oct)

La variable `estado` ya no enruta (ADR 0069), así que la regla deja `estados_llegada`:

- **Se perdió en el Calendly** = deal vigente, sin dueño, en **Calificado**, cuyo envío de origen es un
  **parcial** y no tiene completo con la misma fuente y el mismo token pasados **5 minutos**. Sin tope de edad:
  sale de la lista al reclamarse o cambiar de etapa.
- **Los 5 minutos** son la constante `MINUTOS_PERDIDO_EN_CALENDLY` de `lib/queries/inbox.ts`, una para todos
  los programas. Si un programa necesita otro valor, pasa a una columna de `programs` con migración.
- **El orden del Setteo por `prioridad` y score queda fuera:** ninguno tiene fuente (nadie lee
  `estados_llegada` y el puntaje es nulo). La sección nueva va arriba, la más vieja primero.

Construido en `perdidosEnCalendly` (`lib/queries/inbox.ts`) y `components/deals/inbox-perdidos-en-calendly.tsx`.

## Done cuando

- [x] Un deal con parcial `con_calendly_sin_agenda` de hace 6 minutos sin completa aparece arriba; uno de
      hace 2 minutos no; uno cuya completa llegó tampoco. Con test (`tests/inbox-perdidos-en-calendly.test.ts`).
- [x] Recorrido en el celular sobre la base local, con la consola abierta (2-oct: 375 px, sin errores ni scroll horizontal; el de 8 min sale, el de 2 min no).

## Kiro

Sí, con revisión visual.
