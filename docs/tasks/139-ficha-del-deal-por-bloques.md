---
id: 139
etapa: NC1
serves: "comercial.md §9.3 · enmienda el 074"
depends: [132, 134]
status: done
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

- [x] Todos los bloques cargan con datos reales de un deal de producción en la base local (`dev:local`).
- [x] Los UTM salen tal como llegaron (test sobre la consulta de la ficha).
- [x] Recorrido visual: abrir cada bloque y cada acción, 390 px, claro y oscuro, consola limpia.

## Codex

Sí, esfuerzo `medium`, con revisión visual.

## Cierre (1-oct, Mani; checkpoint `cp-20261002-1`)

- **Hecho** (`0eec9bf`, `0c1ac3b`): cabecera con el nombre derivado (`lib/deals/nombre.ts`, nunca guardado),
  valor vendido, ticket base, descuento y saldo; Origen con los seis UTM crudos por `utmsDelEnvio` (ADR 0004);
  Perfil; Lead y contactos con copiar; Log de eventos; Facturación con el link de pago del programa.
- **El log agrupa la bitácora por objeto y momento:** una fila de `change_log` por campo lo volvía ilegible
  (crear un abono eran ~9 filas). Ahora es un evento por registro e instante, con los campos en un desplegable.
- **Cambió la forma de `fichaDeDeal(...).origen`** a `{ envioId, fecha, calificacion, utm }`; el test de
  `origen-del-envio` se actualizó en `e5319e2`.
- **Queda:** lo que salió del recorrido visual, en `docs/anotaciones.md`: A-15 a A-17 van al 075; A-18 se
  decide en E9. Las alertas del 128 no se tocaron.

