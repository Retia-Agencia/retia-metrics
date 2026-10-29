---
id: 349
etapa: pauta
serves: "Paid Ads Trafficker (29-oct): no shows y ROAS por origen · docs/hub.md §5.2 · ADR 0086"
depends: [093, 251, 262]
status: done
---

# 349 — Hub › Pauta: no shows por origen, cifras que abren sus personas y periodo visible

Pedido por Pauta (29-oct): "demasiados no shows y el ROAS de pauta es como 0,2"; quieren ver de qué anuncios y
campañas llegan más no shows, en una vista fácil de leer que enseñe **quiénes** son las personas detrás de cada cifra.

## Hecho (29-oct)

- **Pauta (`pautaInterina`)** suma por origen los **shows** y **no shows** de las agendas del periodo (`calls.resultado`;
  show = `RESULTADOS_QUE_OCURRIERON`). La tasa de no show es no shows ÷ (shows + no shows): lo pendiente o cancelado
  no entra. La tabla dice "2 de 5 citas" bajo cada tasa, para que nadie lea una tasa de 2 citas como la de 80.
- **Cada cifra abre su lista** (`hub/lista`): registros y agendas creadas por canal y por campaña, y shows y no shows
  por canal y campaña. Se agregaron dos filtros a las dos listas de origen, no una métrica nueva: `campaign`
  (`utm_campaign` crudo, ambas listas) y `resultado` (`show` | `no_show`, solo agendas creadas), así que la cifra y su
  lista salen del mismo universo (`tests/origen.test.ts`, `tests/pauta-interina.test.ts`).
- **Ventas por origen (pedido de Michael, 29-oct: "falta show / venta / tipo de venta"):** la tabla gana la columna
  **Ventas**, con dos líneas debajo: *cuándo pagaron* (en llamada = escalón 1, después = escalones 2 y 3, sin llamada =
  escalón 4, ADR 0109) y *cuánto* (completas = Ganado completo, parciales = Ganado parcial). Mani: tipo de venta = "en
  llamada o luego" + "pago completo o parcial". Las ventas son las **cerradas en el periodo** (fecha de la venta), la misma
  definición del Hub y de `escaleraDeDeals` (una sola, ADR 0024): se cargan con `cargarEscalera` y se reparten por el envío
  que abrió el deal; cortesías y anulados fuera; sin envío de origen, su propia fila. La lista `escalera` ganó los filtros
  de origen (`source`, `medium`, `campaign`, `categoria`), el grupo de escalones `ventas` y `despues` y `pago`
  (`completo`|`parcial`), así que cada número abre sus personas; esa lista es de quien administra (Gerencia y developer),
  al closer no se le ofrece el enlace. `tests/escalera.test.ts` (349): cada cifra contra su lista.
- **El periodo se ve:** el chip del `SelectorPeriodo` lleva ícono de calendario, borde de marca y, en pantallas
  anchas, el rango de fechas. Es el mismo chip del Hub, los dashboards y las listas.
- Los textos de la tarjeta dejan de decir "vista interina" y explican qué es cada fila y qué hacer con un número.

## No incluido (ticket 350)

Nada se infiere de la fila de un solo anuncio: el nivel 3 (`utm_content` / `utm_term`) sigue sin lista por renglón.
El ROAS por origen y la exportación del registro de llamadas están en el 350.
