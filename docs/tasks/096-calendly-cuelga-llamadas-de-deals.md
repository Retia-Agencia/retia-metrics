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
