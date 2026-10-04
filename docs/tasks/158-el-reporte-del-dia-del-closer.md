---
id: 158
etapa: NC3
serves: "docs/anotaciones.md A-42"
depends: [156, 157]
status: todo
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

Se define al desbloquear.
