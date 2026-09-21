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

**Acotado por ADR 0021 (16-sep-2026):** esta decision cubre lo que captura el formulario. El
responsable de una persona y las altas manuales son del CRM.

## Enmienda 2026-09-21 (plan v2, ADR 0039): la hoja sigue mandando, pero solo sobre los leads crudos

Esta decision **se conserva** y sigue siendo la mas cara del proyecto. Lo que cambia es **cuanto
territorio cubre**, y cambia en la direccion de estrecharlo.

**Lo que se conserva, literal:** Google Sheets es la fuente de verdad de los **leads**, la app
refleja, y ante conflicto en un campo del formulario **gana la hoja**. El `estado` con el que un
lead llega lo calcula la hoja (hoy el Apps Script, manana el scoring de Dapta) y el CRM **solo lo
trae**, sin reimplementar esa logica (insumo §1.2, ADR 0032).

**Lo que se estrecha.** Textual de Mani, 21-sep:

> *"cuando el CRM se vuelva el centro, las llamadas, etc. solo van a vivir aqui. Lo unico que va a
> entrar de afuera son Leads crudos que llenan un forms de un programa."*

- El ADR 0008 ya habia sacado llamadas y ventas de Sheets. El **ADR 0039** saca lo que quedaba:
  las pestanas de `Estudiantes`, `Registro de llamadas` y `Pauta` dejan de ser fuentes
  configuradas. Un programa tiene **una** hoja y **una** pestana de leads crudos.
- **El reparto de la verdad, en una linea:** la hoja es duena del `estado` de llegada del Lead; el
  CRM es dueno de la `etapa` del Deal y de todo lo que el closer hace (ADR 0037). Son dos columnas
  distintas de dos tablas distintas, a proposito: asi no hay ningun dato del que los dos se crean
  duenos.
- **El "escribe de vuelta a Sheets" de esta decision nunca se construyo y ya no se va a
  construir.** Lo que va en la direccion contraria (las pestanas de gestion) se apaga en la etapa 7
  del plan v2, despues de la migracion one-time.
