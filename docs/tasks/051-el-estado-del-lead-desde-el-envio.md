---
id: 051
etapa: E3
serves: "ADR 0054 (enmienda del 27-sep) · cierra D4 y F-01 · plan §4.3b"
depends: [049, 050]
status: done
---

# 051 — El Estado del lead es el que manda el formulario

> **Reescrito el 27-sep en la noche.** La versión anterior (leer la columna `estado` de la hoja en el
> sync, y después calcularlo con T2) quedó vieja con el corte directo y el ADR 0054: el CRM **no
> califica**, confía en el formulario. La versión vieja: `git log -p` de este archivo.

## Objetivo

Que cada envío guarde el Estado que le puso el formulario, y que el lead tenga el de su envío completo
más reciente, en `leads.calificacion`, que es lo único que lee la regla de deals (ticket 052).

## El contrato (ADR 0054, enmienda)

| La hoja escribe | Valor en el CRM | Qué hace el 052 |
|---|---|---|
| 🗑️ Descartado | `descartado` | no abre deal |
| 📞 Setteo No Calificado | `setteo_no_calificado` | Pendiente Setteo |
| 📅 Con Calendly · 📅 Con Calendly (Juanito) | `con_calendly` | Agendado |

## Alcance

- **Migración (sesión principal, nunca Kiro):** el enum `calificacion_envio` pasa de
  `incompleto, sin_recursos, con_agenda, setteo` a `descartado, setteo_no_calificado, con_calendly`.
  Fundir dos valores en uno no se puede con `RENAME VALUE`: tipo nuevo, columnas con `USING` (incompleto
  y sin_recursos → descartado, con_agenda → con_calendly, setteo → setteo_no_calificado), tipo viejo
  fuera. Se escribe a mano y se lee antes de aplicar.
- **El Envío trae `estado`:** el adaptador lo llena. El del webhook (106) lo lee de la variable `estado`
  del formulario; el de Sheets (traslado) lee el texto de la hoja y lo pasa a su valor por el nombre de
  la tabla de arriba. Ninguno lo deduce de las respuestas.
- **La ingesta deja de calcular:** `ingerirEntradas` guarda el `estado` del envío en
  `submissions.calificacion` y no llama a `calificarEnvio`. `lib/ingesta/calificacion.ts` y
  `sources.calificacion` se quedan en el repo, desconectados (decisión A8 de `docs/plan.md` §7); sus
  tests se adaptan a los tres valores o se marcan como del módulo desconectado, sin borrarlos.
- **El lead:** `leads.calificacion` = la del envío completo más reciente con Estado; si solo hay
  parciales, la del último parcial que traiga uno (lo que ya hace `resumirEnvios`).
- **Fuera:** abrir deals (052), la pantalla que muestra el Estado, el puntaje (T4, sigue nulo).

## Lo que no se adivina

- Un envío **completo** sin `estado`, o con un valor fuera de los tres: entra sin calificación y se
  cuenta en `sinCalificar` con el motivo (error visible).
- Un envío **parcial** sin `estado`: entra sin calificación y **no** es error. 🟡 Lectura de este
  ticket, no decisión de Mani: un parcial nunca abre deal, así que marcarlo como error llenaría el
  reporte con los ~1.150 parciales de Tactical.

## Done cuando

- [ ] La migración convierte los datos de `dev` sin perder filas: el conteo por valor nuevo es la suma
      de los viejos.
- [ ] Cada fila de la tabla del contrato tiene su test, entrando por el adaptador de Sheets y por un
      Envío con `estado` directo.
- [ ] Un valor inventado (`"con calendly!"`) entra sin calificación y aparece en `sinCalificar`.
- [ ] Un lead con un parcial posterior a su completo conserva el Estado del completo.
- [ ] `grep` confirma que `ingerirEntradas` no llama a `calificarEnvio`.
- [ ] `npm test`, `npm run typecheck` y `npm run lint` limpios.

## Kiro

Sí el código y los tests, con revisión. La migración la escribe y aplica la sesión principal.


---

## Enmienda 2026-09-29 (reunión con Pauta, [`docs/analytics.md`](../analytics.md))

- **Reemplazado por el 117 (ADR 0061):** el Estado ya no se traduce con tres valores fijos; una tabla por programa (`estados_llegada`) dice a qué etapa entra cada valor, y `descartado` desaparece para lo nuevo. El código de este ticket rige hasta que salga el 117.
- 🩸 El 29-sep el Typeform de Tactical dejó de mandar `estado` y ningún envío abrió deal durante horas (`docs/analytics.md` §2.4). Parche en el Typeform aplicado ese día.
