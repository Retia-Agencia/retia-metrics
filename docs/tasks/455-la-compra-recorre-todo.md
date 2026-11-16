---
id: 455
etapa: dinero
serves: "ADR 0133 · de punta a punta"
depends: [448, 449, 450, 451]
status: todo
---

# 455 — Una compra de Hotmart recorre todo: del webhook a Students

## Qué
Conectar las piezas: el sobre guardado (448) se traduce (449), se empareja (450) y, si cruza, entra al motor (451). Si
no cruza, va a la bandeja (450) y, al asignarla, sigue el mismo camino. Una compra repetida no hace nada dos veces.

## Done cuando
- [ ] Test de punta a punta con el fixture real: deal sin dueño → Students en Parcial (USD 99 contra ticket de USD 149);
      deal con dueño → venta del closer; sin lead → bandeja y alerta; mismo evento dos veces → un solo abono.
- [ ] Un fallo de cualquier paso deja el sobre con su error y no a medias (todo en una transacción por compra).
