---
id: 151
etapa: NC2
serves: "ADR 0073; comercial.md GC-27; manual §3.1"
depends: [142, 117]
status: en_curso
---

# 151 — Un reenvío sube el deal a la etapa de entrada de su mejor envío, y el CRM avisa los envíos repetidos

**Origen:** revisión del checkpoint `cp-20261002-2` (2-oct). Alejo dejó abierto en el 117 que un parcial sin calidad
que después manda su completa High se quedaba en Potencial: el motor no tenía la flecha y un deal abierto no cambia de
etapa por un reenvío. Mani (2-oct): la flecha se agrega, **todas las subidas**, y "todos los envíos de un Lead deben
quedar visibles y asociados, y debe avisarse cuando hizo más de un envío". Decisión escrita en el
[ADR 0073](../adr/0073-un-reenvio-sube-el-deal-a-su-mejor-etapa-de-entrada.md).

## Objetivo

1. Tres flechas del sistema en el motor: **S1** Potencial → Registrado, **S2** Potencial → Calificado, **S3**
   Registrado → Calificado. Solo las toma la regla de deals al llegar un envío.
2. La regla de deals: un envío sobre un deal abierto que sigue en Potencial o Registrado lo sube a la etapa de entrada
   de ese envío si hay flecha S. Nunca baja; En gestión o más adelante no se mueve. Deja nota "Sistema" con el porqué.
3. Aviso de envíos repetidos: el lead con 2 o más envíos se marca en la tarjeta del Kanban y en la ficha del deal, con
   enlace a la ficha del lead (073), donde están todos los envíos y sus diferencias.

## Done cuando

- [x] Tests de la regla fila por fila en los dos sentidos (sube y no sube), del motor (S1 a S3 solo sistema), de la
  ingesta con la nota, y de las consultas con el conteo.
- [x] Typecheck, lint, `npm run build` y los tests del cambio en verde.
- [x] Recorrido (2-oct, base local): una tarjeta y una ficha de deal con "2 envíos" que enlaza a la ficha del lead.
- [x] `structure.md` §3.1 con S1 a S3 y el manual §3.1 al día (los escribe la sesión principal).

## Fuera de alcance

Unir o separar leads (ADR 0035 sigue igual); reabrir un deal cerrado por un reenvío (no se reabre: ADR 0037).
