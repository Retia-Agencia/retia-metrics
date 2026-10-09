---
id: 219
etapa: O8
serves: "A-118, A-123; ADR 0081 punto 2"
depends: [215, 216, 217]
status: done
---

# 219 — Mover pide adentro lo que la etapa destino necesita

## Por qué existe

Hoy el diálogo de mover dice "Regístrala en Actividades" o "falta la llamada" y manda al closer a otra tarjeta.
Mani: *"el pop up + el botón de mover se vuelve la centralización y estandarización para mover deals"*, igual al
arrastrar.

## Alcance

- `components/deals/dialogo-mover.tsx` y `responder-pregunta.tsx`: los requisitos que hoy se prueban con un HECHO
  (llamada que sucedió, Grain, abono, cita) se **registran dentro del diálogo**:
  - **→ Atendido**: la llamada de la que se trata, compacta (fecha y hora, closer; se expande al tocarla), con el
    resultado (Show) y el campo del Grain. Si no hay llamada, se crea ahí con su fecha.
  - **→ Ganado**: el formulario del abono (el de `ficha-pago.tsx`, incluida la plataforma nueva del 212).
  - **→ Agendado** desde Calificado: la cita.
  - Los datos tecleados (valor vendido, fecha límite, cohorte destino, motivo) siguen como hoy.
- Todo en una sola server action por movimiento: el hecho se escribe (con rastro) y después `moverEtapa`; si el
  motor rechaza, nada queda escrito (transacción).
- **Mismo diálogo para el botón y el arrastre** del Kanban (`tablero-kanban.tsx`). Un solo componente.
- **Llamadas y Pago quedan como historial**: ver, editar, corregir y anular. Se quitan sus botones de registrar
  algo nuevo (marcar Show, pegar Grain en una llamada sin Grain, "Agregar llamada", "Registrar abono"); la
  reagenda y la llamada nueva viven en Anotar (217). **Pegar o cambiar el Grain de una llamada que ya está
  registrada sí se queda en Llamadas, como corrección** (Mani, 9-oct).
- Botones: un solo tamaño y variante por tipo de gesto (etapa, Anotar, Corregir); nada a mano (§9 de
  `docs/structure.md`).

## Done cuando

- [ ] Desde Agendado se llega a Atendido marcando Show y pegando el Grain en el diálogo, por botón y por arrastre.
- [ ] Desde Compromiso Verbal se llega a ganado registrando el abono en el diálogo.
- [ ] Si el motor rechaza, no queda ni la llamada ni el abono (test).
- [ ] Llamadas y Pago no tienen botones de registrar; sí de corregir y anular.
- [ ] Recorrido haciendo clic en todo lo que se abre, claro y oscuro, 390 px; `npm run build`.
