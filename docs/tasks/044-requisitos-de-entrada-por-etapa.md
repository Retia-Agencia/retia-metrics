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

---

## 🟡 Propuesta 2026-09-24 sobre tres requisitos (se valida con los closers)

- **Atendido** entra con el link de Grain **o** con el closer marcando "sucedió" (llamadas por WhatsApp
  o sin grabar). Sin la segunda vía, una llamada real sin grabación deja el deal trabado.
- **Compromiso Verbal**: la "fecha prometida" no tiene columna. Propuesta: es la **primera cuota
  pactada** (ADR 0041).
- **Próxima Cohorte** exige la **cohorte destino**; sin ella la etapa se vuelve un cementerio.
- **Seguimiento** (se queda en Atendido) exige fecha de seguimiento.
Detalle en `docs/auditorias/propuesta-crm-y-reunion-comercial-2026-09-24.md` §2.5 y §2.6.

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
