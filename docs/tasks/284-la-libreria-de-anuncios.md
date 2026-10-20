---
id: 284
etapa: pauta
serves: "Pauta ve cada anuncio del programa con su creativo y su rendimiento (gasto, agendas, ventas, costos) para sacar las variaciones de los winners (Anderson vía Michael, 19-oct)"
depends: [120, 262, 125]
status: todo
---

# 284 — La librería de anuncios

## Por qué

En la lista de Anderson (mensaje de Michael, 19-oct). César saca "variaciones de los winners (los que traen volumen y
los que cierran)" cada 15 días; hoy lo arma a mano desde Ads Manager, que no ve ventas.

## Alcance

- Una vista en Hub › Pauta: una tarjeta por anuncio de Meta del programa con su miniatura o video, el copy, el formato
  (ya en `pauta_objetos.formato`), la campaña y el conjunto, y al lado gasto, agendas (Meta y CRM), ventas,
  costo por agenda y costo por venta, en el periodo elegido. Orden por cualquiera de esas cifras.
- **Lo nuevo de datos:** la miniatura, el copy y el link del creativo. Se leen de la API de Marketing con el token de
  lectura (`ads_read` alcanza) en la sincronización del árbol (120) y se guardan en `pauta_objetos` (no son
  secretos). Una URL de miniatura de Meta caduca: se guarda el id del creativo y se refresca en cada sincronización.
- Las cifras salen de la capa de hechos por la dimensión anuncio (`utm_id`, ADR 0062); nadie escribe otra consulta.
- **Fuera:** subir o editar anuncios, la Ad Library pública.

## Done cuando

Pauta abre la librería de un programa, ordena por costo por venta y cada tarjeta abre la lista de agendas y ventas de
ese anuncio.
