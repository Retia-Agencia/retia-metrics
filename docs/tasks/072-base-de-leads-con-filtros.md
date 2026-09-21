---
id: 072
etapa: E6
serves: "plan v2 §6 etapa 6 · tarea E6-4 · insumo §4.3, ADR 0032"
depends: [069]
status: todo
---

# 072 — La base de Leads: lo que existe y todavia no es una oportunidad

## Objetivo

Ver y filtrar los leads **sin deal**: Descartado, Sin Calificar, parciales, y los que
"desaparecieron de la hoja".

## Por que esta pantalla importa mas de lo que parece

Es donde vive la parte de arriba del embudo, que hoy **esta vacia**: 4.791 de 4.791 leads con el
estado en su valor por defecto. Con el ticket 051, por fin hay algo que mirar. Y los parciales
huerfanos (236 en Tactical) **existen aqui o no existen en ninguna parte**.

## Alcance

- **Dentro:** listado con filtros por estado (**agrupado dinamicamente**, ADR 0032), por rango de
  fechas y por programa.
- **Dentro:** la accion de **combinar dos redacciones** del estado, que es un acto humano guardado
  como dato (`📅 Con Calendly` y `📅 Con Calendly (Juanito)` son el mismo grupo).
- **Dentro:** la lista de **posibles duplicados** (unidos por telefono) con separar / confirmar
  (ticket 050).
- **Dentro:** ningun dato personal en la URL ni en la query string. Los ids son opacos.
- **Fuera:** crear un lead a mano. El alta manual crea **deal** y vive en el Kanban (ADR 0021).

## Done cuando

- [ ] Los filtros reproducen la distribucion real de estados de `dev`.
- [ ] Combinar dos valores deja rastro con quien y cuando.
- [ ] Separar un lead unido por telefono deja dos leads con sus envios intactos.
- [ ] Ningun correo aparece en una URL.

## Kiro

Si, con revision visual.
