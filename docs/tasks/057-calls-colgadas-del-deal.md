---
id: 057
etapa: E4
serves: "plan v2 §6 etapa 4 · tarea E4-1 · ADR 0015 (enmendado), insumo §2.5"
depends: [052]
status: done
---

# 057 — Las Calls cuelgan del deal, y el sync crea la `agendada` sin fecha

## Objetivo

Reescribir el registro de llamadas sobre el modelo nuevo: una Call es de una **oportunidad**, no
de una persona.

## Alcance

- **Dentro:** `calls (deal_id, closer_user_id, fecha_programada?, fecha_llamada?, link_calendly?,
  link_grain?, resultado, motivo_id?, notas)`.
- **Dentro:** cuando el sync trae `estado = Con Calendly`, **el sistema crea la Call en `agendada`
  sin fecha** y el deal queda *Unclaimed* (ticket 052 la dispara; aqui vive su forma).
- **Dentro:** al reclamar el deal, el closer completa **link de Calendly y fecha**.
- **Dentro:** los ocho `resultado` del ADR 0015 se conservan tal cual.
- **Fuera:** Calendly por API. El PAT es **por programa** y llega despues (spec §7, cerrado el
  21-sep).
- **Fuera:** mover etapas a mano. Todo por `moverEtapa()`.

## Done cuando

- [x] Una Call no puede existir sin deal. *(28-sep: `agregarLlamada` exige un deal vigente y abierto; la suelta de Calendly es del 096)*
- [x] ~~El sync crea la Call `agendada` sin fecha~~ *(28-sep: el sync se retiró; la crea el webhook con la fecha real de la cita, ADR 0057, `lib/ingesta/regla-de-deals.ts`)*
- [x] Un closer pone fecha y link, y queda registrado quien lo hizo (`completarAgendada`). *Reclamar el deal es del 070.*
- [x] Ninguna escritura de `calls` ocurre sin su fila de `change_log` (ticket 041).

## Kiro

Si.

---

## Enmienda 2026-09-24 (ADR 0049): Calendly entra, y la única Call sin deal es la suelta

- "Fuera: Calendly por API" deja de aplicar: la integración es el ticket 096.
- "Una Call no puede existir sin deal" se conserva para toda Call nativa. La excepción es la **llamada
  suelta** que trae Calendly y no se pudo colgar de un deal sin duda; vive en el Inbox hasta que un
  closer la asigna.
- 🟡 Regla propuesta para las métricas: el show se cuenta en las llamadas; el cierre, en los deals.

---

## ✅ Decisión 2026-09-24 (Mani, se valida con los closers): Seguimiento y "un deal, muchas llamadas"

- **Seguimiento es una etapa propia (la 11)**, después de Atendido: la llamada ocurrió y hay que volver a
  contactarlo. Separa lo que salió bien (Compromiso, pago) de lo que hay que re-contactar. Reemplaza la
  propuesta anterior de "quedarse en Atendido con fecha". El `pgEnum` gana un valor (migración de la
  sesión principal). El número no es el orden: va después de Atendido.
- **Un deal tiene muchas llamadas y nunca se duplica.** Si una llamada falla (no-show, cancelada, u
  otra llamada necesaria), el deal pasa a Re-agenda **con motivo** (5 → 3 incluido). Una llamada nueva
  de un lead con deal abierto **se agrega y se avisa al dueño**; en 1, 2, 3, 9 u 11 el deal pasa a
  Agendado, en 5, 6 o 7 la etapa no cambia.
- **La conversión cuenta deals distintos** que llegaron a una etapa, no entradas: el ir y volver no infla.
- Transiciones nuevas: T24 (5 → 11), T25 (11 → 6), T26 (11 → 7 u 8), T27 (11 → 4), T28 (11 → 9), T29
  (5 → 3 con motivo); T11 queda reemplazada y T15 pasa a 6 → 11. Perdido llega también desde 11. Tabla
  completa en `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md` §2.5 y §2.6.
- **Reemplaza** lo dicho antes en este documento sobre "la segunda llamada no hace retroceder".

---

## Cierre 2026-09-28

- `lib/deals/llamadas.ts`: `agregarLlamada` (llamada nativa sobre un deal abierto del actor; en 1, 2, 3, 9
  y 11 mueve a Agendado por `moverEtapa()`, en 5, 6 y 7 no) y `completarAgendada` (el dueño del deal le
  pone fecha y link a la agendada del sistema y queda como `closer_user_id`). Implementado por Kiro;
  revisado en la sesión principal, que agregó la transacción: la llamada y el movimiento van juntos o no
  va ninguno.
- Migración **0036** (`closer_user_id`, `link_calendly`, `link_grain`), aditiva. **Sin aplicar en
  producción**: se aplica al abrir E1, junto con la tabla del 110.
- `tests/llamadas-del-deal.test.ts`: 23 casos. Suite completa: 1.091 en verde, typecheck y lint limpios.
- Queda: un test del rechazo del motor dentro de `agregarLlamada` (hoy no se puede provocar: las cinco
  flechas a Agendado existen). Sin pantalla: la usa el 069/074.
