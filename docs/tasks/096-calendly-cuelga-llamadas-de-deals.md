---
id: 096
etapa: E4
serves: "ADR 0049 · propuesta 24-sep §2.3 y §3.7"
depends: [057, 045]
status: en curso
---

# 096 — Calendly por programa: cada llamada a su deal, y si hay duda, suelta

## Objetivo

Que las llamadas de Calendly se cuelguen solas de su deal, con fecha real y host, **sin forzar**: lo
que tenga duda queda suelto en el Inbox para que un closer lo asigne.

## Las reglas (ADR 0049)

- Se cuelga sola **solo** si el correo del invitado es de **un solo lead del programa con un solo deal
  abierto**. Todo lo demás queda **suelto**. El teléfono no empareja.
- Efecto por `moverEtapa()`: deal en 1, 2, 3 o 9 → Agendado; en 4 → se queda con la fecha real; en 5,
  6 o 7 → segunda llamada, la etapa no cambia. Cancelada o no-show → Re-agenda solo desde Agendado.
- Dueño: si el deal no tiene y el host es closer registrado en el programa, el host. Si ya tiene, se
  respeta y se avisa.
- Una llamada que llega antes que el envío queda suelta y se reintenta cuando llega el envío. 🟡

## Alcance

- **Dentro:** la cuenta de Calendly del closer **por membresía** (hoy `users.calendly_email` es global).
- **Dentro:** la credencial de Calendly por programa, guardada como secreto.
- **Dentro:** el emparejador de llamadas como **módulo puro** con su guardián: nadie cuelga una Call de
  un deal por fuera de él.
- **Dentro:** asignar una llamada suelta a un deal, a mano, con rastro.
- **Por decidir al abrir:** webhook (exige Calendly Standard o superior) o consulta periódica (exige
  Vercel Pro para un cron de 15 min).
- **Fuera:** crear deals desde Calendly. El deal lo abre el envío.

## Done cuando

- [ ] Cada regla de emparejamiento tiene su test en los dos sentidos; ante la duda, **suelta**, nunca
      la opción "más parecida".
- [ ] Una llamada suelta aparece en el Inbox y se asigna a mano, con su fila de `change_log`.
- [ ] Una segunda llamada sobre un deal Atendido no lo hace retroceder.
- [ ] ~~El dueño nunca se pisa si ya existía.~~ Reemplazado por la decisión de Mani del 28-sep: el deal
      es de la closer host si está registrada en el programa; si tenía otro dueño, pasa a la host y se avisa.

## Kiro

Sí, con revisión. El emparejador es donde un bug es silencioso.

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

## ✅ Reunión con los closers 2026-09-24 ([reunión con los closers del 24-sep](../overview.md), resumen en la propuesta §0)

- **Cada closer tiene su propia cuenta de Calendly y es dueño de sus llamadas.** Andrea y Maru tienen
  **un correo distinto por programa**: la cuenta vive en la **membresía** (closer × programa), como dice
  el ADR 0049. El closer la configura en su perfil, por programa.
- **Todas las llamadas se graban con Grain.**
- Evidencia a favor de emparejar **solo por correo**: hay leads que ponen **un teléfono en el formulario
  y otro en la agenda**. Emparejar por teléfono habría colgado llamadas de la persona equivocada.
- ✅ **Decidido por Mani el 28-sep:** si el lead agenda con otra closer, el deal es de esa closer (la que
  es host de la cita).

---

## Pedido de Mani (28-sep, al decidir el 052)

*"No debería ser que no encuentra y luego nunca le llega llamada."* Cuando el form dice `con_calendly`
pero la cita no aparece (o está cancelada), el 052 deja el deal en Pendiente Setteo con una nota. Este
ticket cierra el ciclo:

- La llamada que llegue después desde Calendly se cuelga sola de ese deal por las reglas de arriba
  (un solo lead, un solo deal abierto) y lo mueve a Agendado.
- **Dropdown de llamadas de Calendly** para que un closer asocie una a mano (es la llamada suelta del
  Inbox, con rastro).
- **Botón "buscar llamada"** en el deal, que vuelve a consultar Calendly por si la cita apareció. Usa
  `citaDeCalendly` de `lib/calendly/cita.ts` (ticket 109, renombrada de `fechaDeCita` por el ticket 052,
  que ahora devuelve `{ inicio, cancelada }`) con el uuid del envío.

## Nota 2026-09-28 (ADR 0058)

Desde el 28-sep una re-agenda con cita vigente sobre un deal en 4-7 crea **otra** llamada en el mismo
deal (`agregar_llamada`), sin tocar la vieja. Cuando este ticket escuche las cancelaciones y
reprogramaciones de Calendly, la llamada vieja se marca ahí; mientras tanto el deal puede mostrar dos
llamadas `agendada`. Y cancelar una cita en Calendly hoy no cambia su llamada en el CRM.

## Avance 28-sep (Alejo)

**Hecho, sin migración ni A5:** el emparejador, `lib/calendly/emparejar-llamada.ts`, puro.
`emparejarLlamada(llamada, candidatos, closers)` devuelve `colgada` (lead, deal y el dueño antes y
después, con `cambio` para avisar) o `suelta` con su motivo: `sin_correo`, `sin_lead`, `varios_leads`,
`sin_deal_abierto` o `varios_deals_abiertos`.
- Empareja **solo por correo confirmado** (`lead_contactos.confirmado`): un correo que entró unido por
  teléfono no decide, o el teléfono estaría emparejando por la puerta de atrás (ADR 0035).
- Normaliza con `normalizarEmail`, la misma función de la llave del lead.
- El dueño sigue la decisión de Mani del 28-sep (la host registrada se queda el deal). Un correo de
  Calendly que reclaman dos closers se trata como host no registrada: no se inventa dueño.
- `tests/calendly-emparejador.test.ts` (20): cada regla en los dos sentidos y el orden de los
  candidatos; mordido rompiendo a propósito la regla del correo confirmado y la de varios leads.

**Falta el guardián** ("nadie cuelga una Call de Calendly por fuera del emparejador"): se escribe con
el escritor, que necesita la migración.

**Propuesta de migración de arranque de E2 (la revisa y la aplica Mani):**
- `miembros_programa.calendly_email text` nulo, con índice único parcial
  `(program_id, lower(calendly_email)) WHERE calendly_email IS NOT NULL`: dos closers no pueden reclamar
  la misma cuenta en un programa (el emparejador ya lo trata como duda, pero la garantía va en la base,
  ADR 0005).
- `calls.calendly_host_email text` nulo: quién hospeda la cita, para decidir el dueño y para mostrar la
  llamada suelta.
- La llamada suelta ya cabe: `calls.deal_id` acepta nulo y la huella `calendly:<uuid>` existe (052).
  Falta un `CHECK` que solo permita `deal_id` nulo con `origen = 'calendly'` (ADR 0049 punto 6: la
  suelta es la única Call sin deal).
- `users.calendly_email` (global) queda sin lector y se retira después.

**Sigue bloqueado por A5** (webhook o consulta periódica): de eso depende quién llama al emparejador.

## Avance 28-sep, noche (Alejo): lo que no espera a A5

**La primera cita ya llega por el Typeform** (Calendly embebido). El 052 la lee en la API al entrar el
envío, así que A5 (webhook o consulta periódica) solo hace falta para lo que pasa **después**:
cancelaciones, reprogramaciones, no-shows y citas agendadas fuera del formulario.

- **"Buscar llamada"**, el backend: `buscarLlamadaDelDeal` en `lib/calendly/buscar-llamada.ts`. Toma el
  link de agenda del envío más reciente del lead (la pregunta que dice el mapeo de la fuente, con el
  mismo `resolverContra` del adaptador), le pregunta a Calendly y, si la cita está vigente, aplica
  **`aplicarReglaDeDeal`**, el mismo camino del 052: la misma llamada, la misma huella (dos clics no la
  duplican) y el mismo motor. Si no está vigente, **no escribe nada** y devuelve el motivo. Lo puede
  usar cualquier sesión que vea el programa (lo que decide es un hecho de Calendly, y el movimiento lo
  hace el sistema); si el programa queda fuera de su alcance, 404. **No lo llama nadie todavía**: el
  botón va en la ficha del deal (074, carril de Mani). Tests: `tests/calendly-buscar-llamada.test.ts`
  (7), mordido quitando la reja de alcance.
- **El host de la cita:** `citaDeCalendly` devuelve `correoHost` (de `event_memberships`; `null` si no
  viene o si hay varios hosts) y `resolverCitaDeEnvio` lo pasa en la cita vigente. **Todavía no se
  guarda ni decide el dueño:** para eso hacen falta `miembros_programa.calendly_email` y
  `calls.calendly_host_email` (la migración propuesta arriba). Con la migración, el deal que abre el
  envío nace con la closer host como dueña (`closerHost` del emparejador).

