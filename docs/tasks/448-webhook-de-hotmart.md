---
id: 448
etapa: dinero
serves: "ADR 0133 puntos 1 y 6"
depends: []
status: todo
---

# 448 — El webhook de Hotmart entra, se guarda y se procesa una vez

## Qué
Una ruta pública nombrada para pagos (`/api/webhooks/pagos/[fuente]`) que recibe los eventos de Hotmart de un programa.
Verifica el `hottok` (`X-HOTMART-HOTTOK`) contra el secreto de la fuente, guarda el cuerpo crudo antes de procesar
(ADR 0058) y responde 200. Sin negocio todavía: solo entrada, rastro e idempotencia.

## Dónde mirar
`app/api/webhooks/formularios/[fuente]/route.ts` (el molde de la caja negra) · `lib/ingesta/proveedores.ts` (registro
de proveedores) · `lib/catalogo/fuentes-webhook.ts` · `sobres_crudos` y `entregas_webhook` en `lib/db/schema.ts` ·
AGENTS.md › "nada-publico" y "secretos" (la ruta nueva entra en la lista de endpoints nombrados) · contrato del evento:
https://developers.hotmart.com/docs/en/2.0.0/webhook/purchase-webhook/

## Cómo
1. Proveedor `hotmart` con contrato zod del evento 2.0.0 (`event`, `data.buyer`, `data.purchase`, `data.product`) y
   un fixture tomado del **primer envío real** (el botón de prueba de Hotmart, si existe, o la primera compra).
2. Fuente de pagos por programa con su secreto, que se pega a mano en la tab Integraciones (como el de Dapta).
3. Comparación del `hottok` en tiempo constante; sin secreto o distinto → 401 y nada se guarda como compra.
4. Idempotencia: un mismo `purchase.transaction` con el mismo evento se procesa una vez (índice único en la base).
5. Se aceptan los eventos de compra aprobada y completa; los demás se guardan y se ignoran hasta el 452.

## Done cuando
- [x] Test: firma buena, firma mala, evento repetido (una sola fila), evento ignorado.
- [ ] El primer evento real de Hotmart queda en `sobres_crudos` sin error y su fixture está en `tests/fixtures/`.
- [x] La ruta está en la lista de endpoints públicos de `docs/agents/restricciones.md`.
