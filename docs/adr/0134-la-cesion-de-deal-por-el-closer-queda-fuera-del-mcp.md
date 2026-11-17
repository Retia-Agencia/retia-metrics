# 0134 — La cesión de un deal por el closer queda fuera del MCP mientras la app no la tenga; hoy reasigna un administrador

- **Estado:** aceptada · 17-nov-2026 (Mani: «Sí, (b)», opción b del ticket 411, F5).
- **Relacionadas:** ADR 0129 (el MCP es una puerta total: capacidad de la app = capacidad del MCP por rol), ADR 0003
  («reasignar el trabajo de otro es administrar»), ADR 0043 (el dueño debe ser posible en el programa del deal),
  ADR 0025 (el developer no se restringe), anotación A-177, ticket 411 (decisión D5 del 12-nov).

## Contexto

A-177 pide que un closer pueda ceder su propio deal a otro closer del programa. Hoy la app no lo permite: cambiar el
dueño es de quien administra (`editarDeal` exige `esAdministrador`, lib/deals/editar-deal.ts) y un closer solo reclama un
deal sin dueño. Ceder tiene nueve preguntas de negocio abiertas (aceptación del destinatario, la llamada agendada y su
anfitrión en Calendly, comisión de lo ya vendido, `traido_por`, historia y deshacer, aviso por Juanito, carrera entre
cesiones y reclamos, métricas por closer, y la enmienda a la norma del ADR 0003).

La decisión D5 (12-nov) ya había dicho que la cesión se resuelve primero en la app. El F5 del ticket 411 la
encontró como el único hueco de una evaluación real: «ceder mi deal» no es una acción del MCP.

## Decisión

1. **La cesión por el closer no entra al MCP** mientras la app no la tenga. El MCP no define reglas de negocio propias
   (ADR 0129): construirla allí decidiría en silencio las nueve preguntas de A-177.
2. **La ruta de hoy es que un administrador reasigne**, en la app (`reasignarDealAccion`) o por el MCP con la acción
   `reasignar_deal`, que llama al mismo caso de uso (`editarDeal` con `ownerUserId`), solo para quien administra, con vista
   previa y confirmación. El closer que quiere ceder se lo pide a un administrador.
3. La vista previa de `reasignar_deal` avisa de lo que no se mueve solo: **la llamada pendiente sigue a nombre del closer
   anterior** hasta que se reagende o reasigne en la app (hallazgo del traspaso del 9-nov).
4. La evaluación de A-177 de `tests/mcp-evaluaciones.test.ts` deja de ser un pendiente: verifica que el closer no ve
   ni puede forzar `reasignar_deal`, y que la acción se descubre para quien administra.

## Se reabre cuando

La app construya la cesión por el closer (ADR que enmiende el 0003 y su pantalla, anotación A-177 por `/grill-with-docs`).
Entonces entra al MCP como una fila más de `ACCIONES`, con su misma regla de rol.

## Consecuencias

- El trinquete de pendientes del MCP baja en 1 (`reasignarDealAccion` pasa a expuesta).
- A-177 sigue abierta para la app; solo deja de bloquear al 411.
- Un closer no puede ceder por el MCP aunque el modelo se lo ofrezca: la acción no aparece para su rol y el servidor la
  rechaza.
