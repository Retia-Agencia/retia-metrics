---
id: 454
etapa: operacion
serves: "ADR 0133 · primer programa con checkout"
depends: [455]
status: todo
---

# 454 — Conectar el Hotmart de LiderArte y recuperar las compras que ya pasaron

## Qué
La parte de operación, sesión principal con Mani. Mani pide acceso a Hotmart (Alejo, Daniel Tovar).

## Lo que hay que pedir en Hotmart
- Acceso a la cuenta productora de LiderArte con permiso para configurar webhooks (Herramientas › Webhook).
- El `hottok` de la cuenta (lo muestra la configuración del webhook; se pega a mano en el CRM, nunca por chat).
- El producto y los códigos de oferta en uso: hoy `1nkyoolc` (USD 99) y `743p8ruw` (USD 49), producto `F108462688J`.
- Para recuperar compras pasadas: credenciales de la API de Hotmart (historial de ventas). Que esa API exista y qué
  devuelve está **por verificar**.

## Cómo
1. Crear la fuente de pagos en el CRM, pegar el `hottok` y registrar la URL en Hotmart con los eventos de compra
   aprobada y completa (y los de reembolso cuando el 453 esté).
2. Mandar el evento de prueba de Hotmart si existe; si no, una compra real controlada. Revisar el sobre en
   `sobres_crudos` y el deal en Students antes de dar la fuente por buena.
3. Recuperar las compras desde el 10-nov (primer envío del formulario) por la misma ruta del webhook, como la
   recuperación del 13-nov (`docs/operations.md` §9).
4. Anotar la fuente y lo medido en `docs/operations.md` §2.

## Done cuando
- [ ] Una compra real de LiderArte llega sola a Students.
- [ ] Las compras desde el 10-nov están en el CRM, contadas contra el panel de ventas de Hotmart.
