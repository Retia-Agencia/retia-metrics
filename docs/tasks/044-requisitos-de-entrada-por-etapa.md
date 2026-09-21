---
id: 044
etapa: E2
serves: "plan v2 §6 etapa 2 · tarea E2-2 · ADR 0037, insumo §3"
depends: [043]
status: todo
---

# 044 — Los requisitos de entrada de cada etapa, como predicados puros

## Objetivo

Que cada etapa sepa **que le falta** a un deal para entrar, y que eso se pueda contestar sin base
de datos, sin sesion y sin pantalla: una funcion pura que recibe el deal y devuelve el requisito
que falta.

## Los requisitos (insumo §3)

| Etapa | Entra cuando |
|---|---|
| Pendiente Setteo | `estado` = Setteo No Calificado; o deal manual |
| En Contacto | el owner registro el primer contacto (actividad con fecha) |
| Pendiente Re-agenda | la Call quedo en `no_show` o `cancelada` |
| Agendado | `estado` = Con Calendly; o una Call con fecha y link |
| Atendido | la Call tiene link de Grain |
| Compromiso Verbal | producto asignado **y** fecha prometida |
| Abonado | primer abono con saldo > 0 |
| Completo | saldo = 0 |
| Proxima Cohorte | lo marca el closer |
| Cierre Perdido | **motivo obligatorio** |

## Alcance

- **Dentro:** un predicado por etapa, puro, y un tipo de resultado que **nombra el requisito que
  falta** en espanol, listo para mostrarse.
- **Dentro:** el saldo sale de `lib/queries/saldo.ts` y **no se recalcula aqui** (ADR 0024).
- **Fuera:** escribir nada. Estos predicados solo contestan.

## Por que "que le falta" y no un booleano

Un booleano obliga a que la pantalla adivine el mensaje, y dos pantallas adivinan distinto. El
requisito que falta es la unica parte del motor que el usuario va a leer: vive con la regla, no
con el boton.

## Done cuando

- [ ] Cada etapa tiene su predicado y su test en los dos sentidos (cumple / no cumple con el
      requisito nombrado).
- [ ] Ningun predicado toca la base ni la sesion: se prueban con objetos en memoria.
- [ ] Ninguno recalcula el saldo por su cuenta.

## Kiro

Si, con revision.
