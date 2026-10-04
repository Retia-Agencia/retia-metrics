# 0078: Corregir el último movimiento

- **Estado:** aceptado, 3-oct-2026 (Mani). Se construye en el ticket 182.
- **Confirma:** ADR 0037 (un solo motor), ADR 0038 (anular no es perder) y ADR 0075 (un solo pop-up).

## Contexto

Un clic equivocado podía dejar un deal en una etapa incorrecta. Cierre perdido significa un resultado real del
negocio y anular significa que el deal nunca debió existir. Ninguna de las dos acciones representa ese error.

## Decisión

1. **Corregir deshace solo el último movimiento humano.** El deal vuelve al `de` de la última fila de
   `deal_etapa_historial` y recupera su `pendiente_de`. Un movimiento del sistema se corrige anulando su causa.
2. **El motivo es obligatorio y pertenece al tipo `correccion`.** Los motivos son filas activas del catálogo. El
   enum del tipo cambia en `schema.ts`; la migración la genera y aplica la sesión central.
3. **La corrección pasa por `moverEtapa()`.** La flecha sintética `CORR` no vive en `TRANSICIONES`, porque su destino
   sale del historial. La misma transacción aplica la guarda de carrera, escribe el historial y deja `change_log`.
4. **No se corrige una corrección.** Si el último movimiento ya usó un motivo `correccion`, no se ofrece otra hasta
   que una persona haga un movimiento nuevo.
5. **Corrige quien ya puede mover ese deal.** Solo su dueño o quien administra. La ficha y el Kanban usan el mismo
   diálogo con destino, movimiento que se deshace y motivo.

## Consecuencias

- El último historial debe tener `de`, `user_id` y coincidir con la etapa actual del deal.
- Corregir no compara etapas por orden ni agrega una transición estática.
- Anular, perder y corregir conservan significados distintos en operación y métricas.
