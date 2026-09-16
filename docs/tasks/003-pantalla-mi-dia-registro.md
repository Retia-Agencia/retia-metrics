---
id: 003
fase: F1
serves: "spec §4 pasos 1-4; criterio 1"
depends: [002, 019, 015, 026]
status: todo
---

# 003 — Pantalla de /mi-dia: buscar persona, registrar llamada, venta y abonos

## Objetivo
Un closer entra a `/mi-dia`, busca a la persona, registra el resultado y, según el caso, la
venta con su primer abono; también puede registrar un abono nuevo sobre una venta existente.

## Alcance
- Dentro: buscador de personas por nombre o correo, limitado a los programas donde el closer
  vende (`miembros_programa`, ticket 015).
- Dentro: formulario con resultado, origen y nota; campos condicionales: fecha de seguimiento
  (`reagendada`, `compromiso_pago`), motivo (`perdida`), venta + primer abono (`cerrada`).
- Dentro: selector de producto con opción "crear producto" en línea (ADR 0016).
- Dentro: acción "registrar abono" sobre las ventas de la persona (usa 019).
- Dentro: componentes shadcn que falten, agregados aquí (ADR 0006).
- Fuera: dashboard (005), historial completo (006), recordatorios.

## Done cuando
- [ ] El closer encuentra una persona sincronizada de sus programas.
- [ ] Cada resultado muestra solo sus campos (tabla del ADR 0015).
- [ ] Guarda vía server action con `requireRole("closer")` (el gerente no registra, ADR 0003).
- [ ] Solo muestra productos, plataformas, motivos y orígenes activos.
- [ ] Tras guardar, el formulario se limpia y confirma.

## Notas
Los montos se muestran con su moneda al lado.

**Responsable y alta manual (ADR 0021, ticket 026):** esta pantalla agrega "tomar persona"
(asignarse una sin responsable), "crear persona" (alta manual) y muestra el responsable de cada
resultado del buscador. La lógica vive en 026; aquí solo va la UI.
