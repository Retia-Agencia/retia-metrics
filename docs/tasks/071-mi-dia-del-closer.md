---
id: 071
etapa: E6
serves: "plan v2 §6 etapa 6 · tarea E6-3 · insumo §4.3 y §7"
depends: [069, 061, 070, 096, 097]
status: todo
---

# 071 — El Inbox (antes: Mis deals · mis Calls de hoy · cartera vencida)

## Objetivo

La pantalla con la que un closer **empieza el dia sin acordarse de nada**. Reemplaza a `/mi-dia`
del modelo viejo.

## Alcance

- **Dentro:** mis deals abiertos por etapa; mis Calls de hoy (con su link de Calendly y el hueco
  para pegar el Grain); **cartera vencida** (cuota vencida sin abono, ticket 061).
- **Dentro:** registrar el abono desde aqui, porque 🩸 **un closer registra un abono desde el
  telefono en mitad de una llamada**. El celular no es un extra en esta pantalla.
- **Dentro:** registrar una actividad de contacto (la que mueve a En Contacto).
- **Fuera:** metricas del programa. Eso es el dashboard.

## Done cuando

- [ ] Un closer abre la app y ve, sin filtrar nada, que tiene que hacer hoy.
- [ ] Pegar el Grain desde aqui mueve el deal a Atendido (ticket 058).
- [ ] La cartera vencida dice **que cuota** y de **cuando**, no solo un total.
- [ ] Probado en celular, con la consola abierta.

## Kiro

Si, con revision visual obligatoria.

---

## Enmienda 2026-09-24 (ADR 0050): esta pantalla es el **Inbox**

"Mi día" se reemplaza por el Inbox, la tab de inicio del closer. Absorbe el ticket 070. Secciones 🟡
(se validan con los closers):

1. Deals sin dueño: Pendiente Setteo nuevos y Agendados con host no registrado (ticket 070).
2. **Llamadas sueltas** de Calendly (ADR 0049, ticket 096).
3. Lo mío que necesita atención: llamada de hoy sin resultado, Re-agenda sin nueva fecha, Compromiso
   Verbal vencido, cuota vencida, deal sin actividad en X días (X por definir), un lead con deal
   abierto que volvió a llenar el formulario.
4. Para el gerente: lo mismo de todo el equipo, más los leads unidos por teléfono.

Siempre de un programa (el del selector, ADR 0048). Depende también de 096 y 097.

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
