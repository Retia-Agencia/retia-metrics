# 0004 — Google Sheets es la fuente de verdad; la app refleja y proyecta

**Fecha:** 2026-08-18

El equipo comercial de Retia ya trabaja en Google Sheets todos los dias: ahi caen los formularios
de aplicacion, ahi esta el registro de llamadas, ahi estan las pestanas de descartados y de cola
de setteo.

**Decidimos que Sheets sigue siendo la fuente de verdad y la app refleja.** Cuando la app escriba
de vuelta, escribe en Sheets y luego re-lee para confirmar. Ante conflicto, gana Sheets.

Una app que exige abandonar Sheets no se adopta, y una adopcion a medias es peor que ninguna:
quedarian dos verdades parciales y nadie sabria cual mirar.

El costo es real y hay que asumirlo: toda la complejidad del mapeo de columnas, el dedup, la
bitacora de cambios y la cola de escritura existe por esta decision. La alternativa (la app como
duena de los datos, con Sheets como export) seria mucho mas simple de construir y es exactamente
lo que el equipo no usaria.
