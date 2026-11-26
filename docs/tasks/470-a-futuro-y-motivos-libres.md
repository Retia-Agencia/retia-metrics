# 470 — A futuro y motivos libres

## Objetivo

Separar los deals que podrían comprar después de los cierres perdidos y permitir que cualquier
movimiento con motivo capture una razón nueva sin abandonar el flujo.

## Alcance

- Etapa abierta `a_futuro`, transiciones F, RF y P, Kanban y contratos exhaustivos.
- Motivo libre de hasta 80 caracteres, opcionalmente reutilizable como fila del catálogo.
- Resolución y rastro dentro de la transacción del movimiento; `Otro` guarda el texto como nota.
- Catálogo administrativo de Motivos con la lista A futuro.
- ADR 0142 y pruebas de transiciones y resolución del motivo.

## Verificación

`npx tsc --noEmit` y ESLint sobre los archivos modificados. Las pruebas quedan para CI, según la regla
del repositorio.
