---
id: 059
etapa: E4
serves: "plan v2 §6 etapa 4 · tarea E4-3 · ADR 0015 (se conserva), insumo §3"
depends: [057]
status: done
---

# 059 — `no_show` y `cancelada` mandan el deal a Pendiente Re-agenda

## Objetivo

Que el resultado de una llamada fallida tenga una consecuencia automatica y visible, en vez de
dejar el deal donde estaba.

## Las reglas

- `no_show` o `cancelada` → el deal pasa a **Pendiente Re-agenda** (etapa 3), por `moverEtapa()`.
- Los dos resultados **siguen siendo distintos** (ADR 0015): aviso antes ≠ no aparecio. Que
  disparen el mismo movimiento no los fusiona.
- Crear una Call con fecha sobre un deal en Re-agenda lo devuelve a **Agendado**.
- ⚠️ **La Re-agenda expira solo por decision del closer** (insumo §3). **No hay timer** que mande
  nada a Cierre Perdido: un deal que lleva dos semanas ahi se pinta, no se cierra solo.

## Alcance

- **Dentro:** los dos movimientos automaticos y el de vuelta.
- **Dentro:** `fechaSeguimiento` se conserva en `calls` (ADR 0015) y sigue siendo el dato que
  necesitaria un recordatorio futuro.
- **Fuera:** el recordatorio. La spec §2 dice que no se envia, y sigue sin enviarse.
- **Fuera:** el color del Kanban. Es etapa 6.

## Done cuando

- [x] Los dos resultados mueven a Re-agenda con su fila de historial.
- [x] Una Call nueva con fecha sobre un deal en Re-agenda lo devuelve a Agendado.
- [x] Ningun test necesita esperar tiempo: no hay expiracion que probar.

## Kiro

Si.

---

## 🟡 Propuesta 2026-09-24: la segunda llamada no hace retroceder

`no_show` y `cancelada` mandan a Re-agenda **solo si el deal está en Agendado**. En una segunda llamada
sobre un deal ya Atendido, marcan la Call y el deal no retrocede: retroceder contaría dos veces el mismo
avance e inflaría la conversión Agendado → Atendido. Una Call nueva con fecha sobre un deal Atendido
tampoco lo devuelve a Agendado.

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

Hecho: `marcarFallida(db, actor, { callId, resultado, motivoId? })` en
`lib/deals/llamadas.ts`. En una transacción escribe `resultado` (`no_show` o `cancelada`, **dos
valores distintos**, ADR 0015) por `editarConRastro`, y mueve el deal a **Pendiente Re-agenda** por
`moverEtapa()`. La flecha depende de la etapa (decisión del 24-sep, que reemplaza la propuesta 🟡
"la segunda llamada no hace retroceder"):

- Desde **Agendado**: T8 (`agendado → pendiente_reagenda`), flecha de **sistema**, requisito
  `llamada_fallida`, sin motivo → el movimiento va `{ tipo: "sistema" }`.
- Desde **Atendido**: T29 (`atendido → pendiente_reagenda`), flecha de **closer** con motivo de la
  lista `reagenda` → el movimiento va `{ tipo: "usuario", userId, rol }` con `motivoId`.

El `resultado` se escribe ANTES de mover porque `llamada_fallida` mira la última llamada vigente del
deal; ambos van en la misma transacción, así que si el motor rechaza (por ejemplo T29 sin motivo, o
una etapa sin flecha a Re-agenda) el resultado se deshace. La flecha a usar se decide preguntando a
`transicion()`: no se inventa ninguna transición.

La vuelta (una Call nueva con fecha sobre un deal en Re-agenda lo devuelve a **Agendado**) ya la hace
`agregarLlamada` del ticket 057 (T6, `pendiente_reagenda` está en `ETAPAS_QUE_AVANZAN_A_AGENDADO`);
se agregó el test que lo prueba. `fechaSeguimiento` sigue viviendo en `calls` y no se toca. Sin
timers ni expiración: ningún test espera tiempo.

Fuera de alcance, sin tocar: el recordatorio, el color del Kanban.

Tests: `tests/grain-y-reagenda.test.ts` (bloques `marcarFallida` y la vuelta). Suite completa 1116
pasando, typecheck y lint limpios.
