---
id: 158
etapa: NC3
serves: "docs/anotaciones.md A-42"
depends: [156, 157]
status: descartado
---

# 158 — El reporte del día del closer sale del CRM

## Objetivo

Michael pidió (onboarding, 2-oct) que cada closer le mande al final del día: llamadas agendadas, canceladas,
efectivas, ventas y las objeciones o el "no tiene fit" que oyó. Todo eso, menos las objeciones, ya está en el CRM.
Si el closer lo teclea en WhatsApp, el dato se pierde para las métricas y se escribe distinto cada día. El reporte
lo arma el CRM, por closer y por día (Bogotá, hábiles), y el closer solo agrega lo que no está.

**Bloqueado por:** la decisión de cómo se registran las objeciones (pregunta abajo) y por el 157 (setter y closer
separados en los conteos).

> **4-oct (Mani):** las objeciones son un **catálogo editable por programa** (ADR 0012), se elige una al
> responder "¿Cómo terminó?". Con el 157 en done, queda desbloqueado.

## Lo que ya existe

Llamadas por `closer_user_id` y fecha (agendadas, show, no show, canceladas por Calendly), ventas (deals en
Ganado), motivos de Cierre perdido (catálogo `motivos` con su tipo).

## Pregunta para Mani y Michael

- **Objeciones:** ¿un catálogo de objeciones (como `motivos`, editable desde la app, ADR 0012) que el closer marca
  al responder "¿Cómo terminó?" en Atendido, o basta con los motivos de pérdida y una nota libre? Recomendación:
  catálogo, porque "tantas personas me hicieron esta objeción" es un conteo, y un conteo sobre texto libre no existe.

## Done cuando

No aplica: **descartado el 4-oct (Mani, sesión M4 de la ola O5).**

## Nota de cierre (M4, 4-oct)

- **Por qué se descarta:** casi todo el reporte ya existe. Mi espacio › Métricas muestra por closer agendas, shows,
  no shows y cierres, cada cifra con su lista, y con el periodo en "hoy" es el reporte del día. El "no tiene fit" ya
  es un motivo de pérdida. Lo único nuevo eran las objeciones, y medirlas pedía una migración (`motivos.program_id`,
  tipo `objecion`, `deal_etapa_historial.objecion_id`), un selector en la Transición y un catálogo por programa:
  sobrediseño para algo que Michael pidió como mensaje, no como métrica (ADR 0077: antes de agregar, quitar).
- **Cómo queda la operación:** el closer mira Mi espacio › Métricas en "hoy" y le escribe a Michael; las objeciones
  van en su mensaje, a mano, como hoy.
- **Si vuelve:** solo si Michael pide CONTAR objeciones con números. Entonces se reabre con esa necesidad; la
  propuesta técnica (objeción como `motivo` de tipo `objecion`, por programa, guardada en el historial y opcional)
  queda en el historial de esta sesión de M4.
- **La ola O5 queda sin migración:** era la única.
