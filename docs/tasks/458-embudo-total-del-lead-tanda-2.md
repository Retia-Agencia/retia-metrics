---
id: 458
etapa: pauta
serves: "Dani Rodríguez (Paid Media), audio del 11-nov: ver el embudo de los leads y su origen por campaña y anuncio · D1 enmendada por Mani el 20-nov y decisión B del 20-nov (pauta abre las listas del embudo) · nota `02 Projects/retia/embudo-total-del-lead-borrador.md` del vault"
depends: [457]
status: en curso
---

# 458 — El embudo total llega a Pauta: enlace al embudo de pauta, listas abiertas a pauta y etapas por campaña y anuncio (tanda 2)

## Corrección al ticket 457

El 457 dejaba para esta tanda «repetir el bloque en la pestaña Pauta». **Mani lo enmendó el 20-nov (D1): no se repite.**
El bloque «¿Dónde se pierden?» ya filtra por área (`area=paid`), así que una copia en Pauta sería casi redundante. En su
lugar entran un enlace y el embudo por campaña y anuncio, abajo.

## Decisiones (Mani, 20-nov)

1. **Enlace, no copia.** En Pauta, «Ver el embudo de pauta» abre Comercial con `area=paid`, la cohorte y el periodo activos.
2. **B: pauta abre las listas del embudo.** Antes, quien maneja pauta veía las cifras de «¿Dónde se pierden?» pero no sus
   listas: la pantalla las quitaba (`proyectarDashboardSegunRol` → `sinListas`) y la lista solo abría para administración
   (`capacidadParaMetrica` → `esAdministrador`). Desde este ticket las cuatro listas `embudo_comercial_*` abren con la capacidad
   del tablero (`veTableroDelPrograma`) y con la proyección de pauta existente (`proyectarParaPauta`): persona y etapa, sin
   closer, deal, monto ni última actividad. Es una enmienda al ADR 0052 (ADR 0138). La lista «+N sin llamada registrada»
   (ventas con monto) sigue cerrada a pauta.
3. **Etapas por campaña y anuncio, con el universo de Comercial.** Dentro de «¿Qué trae ventas?» entra una tabla aparte,
   no columnas nuevas en la tabla del ROAS: el ROAS cuenta eventos del periodo y el embudo cuenta deals creados en el periodo
   seguidos hasta hoy; mezclarlos en una fila daría dos «agendadas» distintas. La tabla dice su universo en la cabecera.
   Cada deal se asigna a campaña, conjunto y anuncio con la atribución central (`atribucionPorDeal`); no se crea otra.
4. **No es una métrica nueva.** Son las mismas cuatro métricas del embudo con un filtro más (el corte de pauta), como el área
   en la tanda 1. Se documenta en la ficha del embudo en `docs/metricas.md` y en el ADR 0138.

## Alcance

1. Enlace «Ver el embudo de pauta» en la pestaña Pauta.
2. Listas `embudo_comercial_*` abiertas a pauta con su proyección; el Hub deja de quitarle esos enlaces (solo esos).
3. Tabla «¿Dónde se pierden? por campaña / por anuncio» en «¿Qué trae ventas?»: creados, agendaron, show, compraron, % del
   paso anterior; cada cifra abre su lista filtrada por el corte (`corte` y `corte_id`).
4. Chip «Área: X» en las listas filtradas por área (pendiente menor de la tanda 1), con la etiqueta de `AREAS`.

## Fuera de este ticket

- Tanda 3: «Terminaron de pagar», la tabla con la fecha de cada hito por persona y el panel de traza. Necesitan decisión de Mani
  y validación con Dani Rodríguez y Daniel Tovar (qué es «calificado», si «Lo trabajaron» entra como corte, «compró» = primer pago).
- Abrir a pauta cualquier otra lista de Comercial (closers, abiertos por owner, ventas sin llamada).
- Cambiar la tabla del ROAS o sus columnas.

## Hecho

- **Enlace «Ver el embudo de pauta».** En `SeccionPauta` (`app/(app)/p/[programa]/hub/page.tsx`) la cabecera de
  `QueTraeVentas` recibe `hrefEmbudo`: la pestaña Comercial con `area=paid`, el periodo y la cohorte activos, sin los
  parámetros propios de Pauta (`vista`, `ver_por`, `corte`, `corte_id`, `nivel`, `tabla`, `por_cuenta`, `cumpl`).
- **Listas abiertas a pauta (B).** `capacidadParaMetrica` devuelve `veTableroDelPrograma` para las cuatro métricas de
  `METRICAS_DEL_EMBUDO_COMERCIAL`; `proyectarListaSegunRol` usa `proyectarParaPauta(lista, veEquipoComercial(rol))`
  (persona y etapa, sin closer, deal ni monto). En `lib/hub-programa/cargar-datos.ts`, los `detalle` y `detallePerdidos`
  del embudo se proyectan aparte: se conservan para `veTableroDelPrograma`; el resto de Comercial sigue cerrado.
- **Tabla por campaña y anuncio.** `lib/queries/embudo-comercial-por-pauta.ts` agrupa los deals de
  `dealsDelEmbudoComercial` (exportada) por la atribución central (`atribucionDePautaPorDeal`, extraída de
  `deals-del-corte-de-pauta.ts` y reusada por `atribuirLote`), y reúsa `pasosDelEmbudoComercial` por grupo.
  `lib/pauta/cifras-del-embudo-comercial.ts` arma cada celda como una Cifra que abre su lista con
  `corte=<campana|anuncio>&corte_id=<uuid>`. La tabla se pinta debajo de la del ROAS en
  `components/pauta/que-trae-ventas.tsx`; con `ver_por=canal` no se muestra.
- **Listas filtradas por corte.** `leerMetricaDelEmbudoComercial` intersecta el universo con `idsDeDealsDelCorte` cuando
  hay `corte`; `vistaDeLista` y la página de lista aceptan `corte`/`corte_id` para esas cuatro métricas vía
  `listaDelEmbudoComercialAdmiteCorte`. El chip de campaña o anuncio aparece en la cabecera de la lista.
- **Chip «Área: X».** La página de la lista pinta `<Badge>Área: {ETIQUETA_DE_AREA[area]}</Badge>`; las etiquetas viven
  en `lib/atribucion/canal.ts` (`ETIQUETA_DE_AREA`) y las usa también la fila de chips de `components/dashboard/operacion.tsx`.
- **Docs.** ADR 0138 (enmienda al 0052), enmienda al final del 0052, fila del Embudo comercial en `docs/metricas.md` y
  entrada en `docs/adr/README.md`.
- **Tests.** `tests/embudo-comercial-a-pauta.test.ts`: capacidad, proyección, agrupación por campaña y anuncio, y el
  conteo del corte igual al del grupo de la tabla.
