# 0070 — Re-agenda, Seguimiento y Próxima Cohorte son pendientes del deal, no etapas

- **Estado:** aceptado · 1-oct-2026 (Mani, sesión de `/grill-with-docs` sobre la QM-10). Se construye con el
  ticket 142, junto con las etapas de 30X. **El punto 6 lo enmienda el
  [ADR 0072](./0072-una-pregunta-por-etapa-mueve-el-deal.md) (2-oct):** Seguimiento también en Calificado (ya
  contactado) y en Compromiso Verbal (revisando propuesta).
- **Enmendado por el ADR 0081 (9-oct):** Mover o Anotar; los pendientes salen de lo anotado, se retiran los intentos y la alerta de tres intentos, y el origen declarado.
- **Reemplaza:** las etapas 3, 9 y 11 del ADR 0037 y las flechas T6, T7, T8, T15, T19 a T29 y el destino 9 de
  la R de `docs/structure.md` §3.1. **Enmienda:** ADR 0056 punto 1 (cuándo se muda la cohorte) y ADR 0049
  punto 4 (qué hace una cita nueva).
- **Fuentes:** `docs/comercial.md` §4 y §7.0 (QD-1: Dani, *"son estados dentro del deal"*),
  `docs/manual-gestion-comercial.md` §3.4 a §3.6 y §5, `docs/insumos/hubspot-30x-workflow.md` (W3, W5).

## Contexto

Con las etapas de 30X, Pendiente Re-agenda, Seguimiento y Próxima Cohorte dejan de ser etapas. En 30X el deal se
queda en Agendado o Atendido y lo que falta hacer lo dicen propiedades (*Estado de agenda*, *Resultado de
reunión*, *Próximo contacto*). Hoy el código **sí decide** con estas tres: el Inbox y el Kanban pintan el
Seguimiento vencido, una cita nueva saca de las tres y lleva a Agendado
(`ETAPAS_QUE_UNA_CITA_MUEVE_A_AGENDADO`), y Próxima Cohorte reaparece cuando abre la cohorte destino (T22). Y
hoy entrar a una de ellas queda en `deal_etapa_historial`: de ahí sale cuántos deals necesitaron re-agenda y
cuánto tardaron. Las dos cosas tienen que sobrevivir.

## Decisión

1. **Se llaman Pendientes.** Un pendiente es lo que el closer tiene que hacer con un deal que no avanzó:
   re-agendar, hacer el seguimiento o esperar la próxima cohorte. No se llaman "estado" porque **Estado** ya es
   la clasificación de llegada del envío (ADR 0061, 0069).
2. **Son un `pgEnum` de tres valores en una columna nullable del deal** (`deals.pendiente`, enum
   `pendiente_deal`: `reagenda`, `seguimiento`, `proxima_cohorte`). Enum y no catálogo porque el código decide
   con ellos (ADR 0012, la misma razón del ADR 0037 para las etapas). Un deal tiene **a lo sumo uno**. Sus datos
   siguen donde ya están: `fecha_seguimiento`, `cohorte_destino_id`, y el motivo de la re-agenda en la fila del
   historial que puso el pendiente.
3. **Poner un pendiente no mueve la etapa: el deal se queda donde estaba.** Re-agenda: en Agendado (no-show o
   cancelada) o en Atendido (hace falta otra llamada). Seguimiento: en Atendido. Próxima Cohorte: en la que
   estaba (setteo, Atendido o Compromiso Verbal). El embudo sigue diciendo hasta dónde llegó el deal.
   **Excepción, el retroceso:** un Compromiso Verbal que se echa para atrás vuelve a la etapa de la que llegó a
   Compromiso Verbal según el historial (Atendido si hubo llamada; la de setteo si fue venta por chat), con
   pendiente Seguimiento y motivo de la lista `retroceso`. Compromiso Verbal significa "dijo que sí"; si se
   quedara ahí, seguiría la alerta de compromiso vencido. Es el molde de A1.
4. **Solo `moverEtapa()` escribe la etapa y el pendiente.** Poner, cambiar o quitar un pendiente es una flecha
   del motor (con la etapa igual o distinta), con quién mueve (ADR 0056 punto 3) y su dato en el mismo
   movimiento (ADR 0056 punto 4). El guardián del 046 cubre las dos columnas.
5. **Cada movimiento deja huella en `deal_etapa_historial`**, que gana el pendiente de antes y el de después
   junto a la etapa. Una sola línea de tiempo por deal: la ficha (076) la muestra como el log, y "cuántos
   deals pasaron por Re-agenda" sale de ahí igual que hoy.
6. **Cómo entra:**

   | Pendiente | Lo pone | Desde | Exige |
   |---|---|---|---|
   | Re-agenda | el sistema, cuando la llamada queda no-show o cancelada | Agendado | el resultado de la llamada es el motivo |
   | Re-agenda | el dueño ("otra llamada") | Atendido | motivo de la lista `reagenda` |
   | Seguimiento | el dueño | Atendido, o el retroceso del punto 3 | fecha de seguimiento (más el motivo `retroceso` si viene de Compromiso Verbal) |
   | Próxima Cohorte | el dueño | setteo, Atendido, Compromiso Verbal, o desde otro pendiente | cohorte destino del mismo programa y distinta de la de origen |

7. **Cómo sale, siempre por un hecho:**
   - **Todo cambio de etapa lo limpia** (Compromiso Verbal, ganado al registrar un abono, Cierre perdido).
   - **Una cita nueva lo limpia y lleva el deal a Agendado**, aunque esté en Atendido. Reemplaza la lista
     `ETAPAS_QUE_UNA_CITA_MUEVE_A_AGENDADO`: la cita mueve a Agendado a un deal en setteo **o con cualquier
     pendiente**. Sin pendiente, en Atendido, Compromiso Verbal o Ganado Pago Parcial la cita se agrega sin
     mover (ADR 0049 punto 4).
   - **Un pendiente se cambia por otro** (Seguimiento → Próxima Cohorte), con el dato del nuevo.
   - **No hay "quitar" sin hacer nada**, y **el tiempo no lo quita** (ADR 0037: no hay relojes). Seguimiento
     vencido y Re-agenda sin cita nueva son alertas del Inbox (128), calculadas al leer.
8. **Próxima Cohorte guarda las dos cohortes y se muda al retomar** (enmienda del ADR 0056 punto 1). Mientras
   espera, `cohort_id` es la de origen y la conversión de esa cohorte lo ve. Cuando la destino abre ventas, el
   deal reaparece en el Inbox (hoy T22, ahora alerta). Lo resuelve el primer movimiento que lo limpia hacia
   adelante (retomar con un contacto posterior a la apertura de la destino, una cita, Compromiso Verbal o un
   abono): en ese movimiento el motor cambia `cohort_id` a la destino, con rastro (ADR 0042), y el historial
   guarda de dónde venía. Cierre perdido lo limpia **sin** mudarlo: se perdió en su cohorte de origen. La venta
   cuenta en la cohorte donde de verdad estudia (GC-41).

## Consecuencias

- **La migración del 142 traduce sin reescribir a mano:** un deal en `pendiente_reagenda`, `seguimiento` o
  `proxima_cohorte` queda en la etapa de 30X que le corresponde a la última etapa en la que estuvo antes de
  entrar ahí (según su historial), con el pendiente correspondiente. Las filas del historial se traducen igual:
  la `a` pasa a esa etapa y el pendiente va en su columna.
- **El embudo pierde tres columnas** y el Kanban muestra el pendiente como marca en la tarjeta. El Inbox lee
  `deals.pendiente`, no etapas.
- **La R (recuperar un perdido)** llega a En gestión o Agendado; a En gestión puede llegar con pendiente Próxima
  Cohorte (reemplaza el destino 9 de hoy).
- Los motivos siguen siendo filas editables en sus cuatro listas (ADR 0056 punto 2); el pendiente no las cambia.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Fila de catálogo editable | El código tiene que reconocer cada fila por nombre para decidir: es el "enum sin garantía" que el ADR 0037 descartó |
| Tres marcas independientes | Combinaciones (Seguimiento y Próxima Cohorte a la vez) que el motor y el Inbox tendrían que entender, sin caso de negocio |
| Una etapa fija por pendiente | Un Próxima Cohorte desde setteo quedaría en Atendido sin haber tenido llamada: el embudo mentiría |
| Huella en una tabla propia o en `deal_actividades` | Dos líneas de tiempo que la ficha y las métricas tienen que unir, o medir leyendo texto de actividades |
| Un botón de "quitar pendiente" | Deja deals en Atendido sin próximo paso, justo lo que la alerta de "no value" persigue |
| Próxima Cohorte como Cierre perdido + deal nuevo | La cohorte de origen contaría como perdido a alguien que sí compró, y la historia del deal se parte en dos |
