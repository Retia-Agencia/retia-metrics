# 0143 — Etapa A futuro y motivos libres

- **Estado:** aceptada · 25-nov-2026 (Mani).

## Contexto

`Cierre perdido` no representa a quienes no compran ahora pero podrían retomar después. Además, las
flechas que exigen motivo solo aceptan opciones administradas de antemano, aunque el closer encuentre
una razón nueva durante el movimiento.

## Decisión

Se agrega la etapa `A futuro` y su lista de motivos. **A futuro cuenta como abierto**: no es venta,
cierre ni pérdida; vuelve al embudo mediante una recuperación con motivo. No admite correcciones libres.

Toda flecha que exige motivo permite escribir uno. El closer puede guardarlo como opción o dejarlo como
texto asociado al motivo `Otro`. Crear o reactivar motivos desde el diálogo de mover es una excepción
nombrada al catálogo exclusivo de gerencia, pero siempre pasa por el molde, con actor y rastro, dentro de
la misma transacción del movimiento.

## Consecuencias

Las métricas abiertas incluyen `A futuro`; las métricas de cierre y pérdida no. El catálogo de Motivos
administra todas sus listas y el texto no guardado como opción queda como nota del deal.
