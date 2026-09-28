---
id: 096
etapa: E4
serves: "ADR 0049 · propuesta 24-sep §2.3 y §3.7"
depends: [057, 045]
status: todo
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
- [ ] El dueño nunca se pisa si ya existía.

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
