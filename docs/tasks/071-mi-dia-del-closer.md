---
id: 071
etapa: E6
serves: "plan v2 §6 etapa 6 · tarea E6-3 · insumo §4.3 y §7"
depends: [069, 061, 070, 096, 097]
status: done
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
- [x] Recorrido visual en celular a 390 px, con consola abierta, estados e interacciones revisados.

## Kiro

Si, con revision visual obligatoria.

---

## Enmienda 2026-09-24 (ADR 0050): esta pantalla es el **Inbox**

"Mi día" se reemplaza por el Inbox, la tab de inicio del closer. Absorbe el ticket 070. Secciones 🟡
(se validan con los closers):

1. Deals sin dueño: Pendiente Setteo nuevos y Agendados con host no registrado (ticket 070).
2. **Llamadas sueltas** de Calendly (ADR 0049, ticket 096).
3. Lo mío que necesita atención: llamada de hoy sin resultado, Re-agenda sin nueva fecha, Compromiso
   Verbal vencido, cuota vencida, deal sin actividad en 3 días hábiles por defecto (configurable), un lead con deal
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

## 🆕 Reunión con los closers 2026-09-24 ([reunión con los closers del 24-sep](../overview.md), resumen en la propuesta §0)

- **El dolor número uno es registrar después de la llamada** cuando hay varias seguidas. El Inbox es
  la red de seguridad: *"llamada de hoy sin resultado"* tiene que aparecer arriba, para ponerse al día
  al final del bloque de llamadas sin que se pierda ninguna.
- El Setteo sin dueño viene **ordenado** por ingreso y recencia (ticket 070).
- Alguien lleva hoy sus etapas en las **etiquetas de WhatsApp Business**: el Inbox tiene que responder
  "¿en qué estoy con cada uno?" mejor que esas etiquetas, o las van a seguir usando.
- ✅ ADR 0053: donde este ticket diga "cuota vencida", se lee **"fecha límite de pago vencida con
  saldo"**. En v1 no hay cuotas.

---

## ✅ Decisión 2026-09-29 (Mani): la X de "deal sin actividad"

Es el rastreo de **deals estancados**. La X es un número por programa (`programs.dias_sin_actividad`,
de migración de arranque de E4 junto con la configuración del Inbox), en **días hábiles** (regla de Retia: solo se
excluyen sábados y domingos), con defecto **3**, editable en `/ajustes/programas`. "Actividad" es la
fecha más reciente entre: actividad del deal, llamada, abono y movimiento de etapa. Solo cuenta para
deals abiertos con dueño; Completo, Cierre Perdido y los anulados nunca están estancados.


---

## Enmienda 2026-09-29 (reunión con Pauta, [`docs/analytics.md`](../analytics.md))

- El Inbox gana la sección "se perdió en el Calendly" (118): arriba de todo, calculada al leer, sin cron.
