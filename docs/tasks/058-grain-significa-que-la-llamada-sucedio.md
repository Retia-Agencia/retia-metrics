---
id: 058
etapa: E4
serves: "plan v2 §6 etapa 4 · tarea E4-2 · insumo §2.5, ADR 0037"
depends: [057]
status: todo
---

# 058 — Pegar el link de Grain **es** decir que la llamada sucedio

## Objetivo

Quitarle al closer un formulario y sustituirlo por el gesto que ya hace: pegar el link de la
grabacion.

Pegar el Grain pone `resultado = show`, llena `fecha_llamada` si estaba vacia, y mueve el deal a
**Atendido**. Los tres, juntos, en una sola operacion.

## Por que esto no es azucar

Es la regla de "cero error humano en los campos" (insumo §1.3) aplicada al campo que mas se
olvida. El `show` teclease a mano es el dato del que sale el **% de show**, que es la metrica que
el equipo mira todos los dias: derivarlo de un hecho verificable (existe la grabacion) en vez de
una casilla es la diferencia entre una cifra y una opinion.

## Alcance

- **Dentro:** la mutacion, con su movimiento de etapa **por `moverEtapa()`** y su fila de
  `change_log`.
- **Dentro:** que pasa si el link se quita o se corrige. **Quitar el Grain NO devuelve el deal a
  Agendado por su cuenta**: es un retroceso y pasa por el motor, con motivo (ticket 047).
- **Fuera:** Grain por API e insights de llamadas. Fase posterior.
- **Fuera:** validar que el link sea de Grain de verdad. Un formato razonable basta; una reja que
  rechace un link valido de otra herramienta cuesta mas de lo que protege.

## Done cuando

- [ ] Pegar el Grain deja `show`, fecha y deal en Atendido, en una operacion.
- [ ] Si la fecha ya estaba, **no se pisa**.
- [ ] El movimiento tiene su fila de `deal_etapa_historial`.
- [ ] Quitar el link no mueve nada solo.

## Kiro

Si.

---

## 🟡 Propuesta 2026-09-24: Grain **o** "sucedió"

Para llamadas por WhatsApp o sin grabar, el closer puede marcar "sucedió" y el deal pasa a Atendido
igual (ticket 044). Después de pegar el Grain, el closer elige cómo terminó: pagó ahora · compromiso ·
seguimiento · próxima cohorte · perdido. Se valida con los closers.

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
