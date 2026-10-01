---
id: 139
etapa: NC1
serves: "comercial.md §9.3 · enmienda el 074"
depends: [132, 134]
status: todo
---

# 139 — La ficha del deal, reorganizada por bloques

## Objetivo

Que el closer tenga a mano todo lo del deal en una pantalla, en el orden de §9.3 de `comercial.md`.

## Alcance

- **Dentro:** cabecera (nombre derivado `<Nombre> | <Programa> | <Cohorte>`, nunca guardado; etapa, dueño,
  valor vendido, descuento contra el ticket base de la cohorte, saldo).
- **Dentro:** **Origen** con los datos crudos del envío de origen (los seis UTM como llegaron, sin
  normalizar, ADR 0004) y el origen declarado (121).
- **Dentro:** **Perfil**: `lead_quality`, `lead_value` y las respuestas del formulario legibles.
- **Dentro:** el lead (o los leads) asociado con sus contactos; notas y actividades; agenda y llamadas (con
  la marca de sin Grain del 135); el log de eventos (historial de etapas y `change_log`, la pantalla del 076);
  la **facturación**: abonos, saldo y el link de pago del programa.
- **Dentro:** las alertas del 128 arriba, si ya existe.
- **Fuera:** las etiquetas por etapa (lote 2, 143). Deal Insights con IA (QM-9: después de v1).

## Done cuando

- [ ] Todos los bloques cargan con datos reales de un deal de producción en la base local (`dev:local`).
- [ ] Los UTM salen tal como llegaron (test sobre la consulta de la ficha).
- [ ] Recorrido visual: abrir cada bloque y cada acción, 390 px, claro y oscuro, consola limpia.

## Codex

Sí, esfuerzo `medium`, con revisión visual.
