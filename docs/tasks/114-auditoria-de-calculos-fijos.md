---
id: 114
etapa: E4
serves: "A8 (el CRM no calcula nada) · AGENTS.md: una pregunta, un módulo · ADR 0012"
depends: []
status: todo
---

# 114 — Auditoría de lo que el CRM calcula o sabe "a mano" (29-sep)

Pedido de Mani: *"que el CRM sea escalable y sostenible, no que aumente la complejidad por programa"*.
La vara: lo que depende del formulario o del programa lo manda el formulario o vive en una fila; y una
misma regla vive en UN módulo. Revisado `lib/` entero (constantes, literales, títulos de preguntas, slugs,
montos). **Lo que NO se encontró:** ningún slug ni monto de programa en el código, ningún número mágico en
las métricas (dashboard, cartera, kanban), y los umbrales ya viven en la base (por fuente o programa).

## 🩸 A. Reglas copiadas que YA divergen (lo grave: una cifra o un movimiento sale mal sin error)

1. **"¿Desde qué etapas una cita nueva mueve el deal a Agendado?"** está copiada en tres archivos:
   `lib/deals/llamadas.ts` y `lib/calendly/colgar-llamada.ts` dicen 1, 2, 3, 9 y 11 (la decisión del
   24-sep); **`lib/ingesta/regla-de-deals.ts` dice 1, 2 y 9**, escrita antes de Seguimiento. Efecto: un
   lead en Pendiente Reagenda o en Seguimiento que vuelve a llenar el formulario con Calendly **no pasa a
   Agendado**. ✅ **Arreglado el 29-sep** (Kiro, con ok de Mani para tocar `lib/ingesta/`):
   `ETAPAS_QUE_UNA_CITA_MUEVE_A_AGENDADO` en `lib/deals/etapas.ts`, importada por los tres; test de 3 y 11 y
   guardián contra una copia local.
2. **"¿La llamada ocurrió?"**: `mover-etapa.ts` cuenta `show, compromiso_pago, cerrada, perdida`; las tres
   consultas del embudo en `lib/queries/dashboard.ts` cuentan "con show" sin `perdida`. Cuando se registre
   una llamada `perdida` (el lead se presentó y dijo que no), **la tasa de show sale subestimada**. Latente:
   hoy producción tiene 0 (25 agendadas, 1 cancelada). Arreglo: una constante exportada que usen el motor y
   el dashboard (`inArray`). Va con el 064 (dashboard sobre deals, carril de Mani).
3. `RESULTADOS_FALLIDOS` estaba en `mover-etapa.ts` y en `llamadas.ts`. ✅ 29-sep: vive en `mover-etapa.ts`
   (la dirección de dependencia ya existente) y `llamadas.ts` la re-exporta; guardián incluido.

## B. El CRM "sabiendo" cosas del formulario

4. **Títulos de pregunta de los Typeform de hoy escritos en el código:** `MAPEO_FORMULARIO`
   (`lib/sheets/mapeo.ts`: "ganas mensualmente", "que te motivo", "agenda aqui tu entrevista"…) y
   `MAPEO_POR_DEFECTO` (`lib/ingesta/adaptador-typeform.ts`). Son el defecto cuando ni la fuente ni la
   plantilla del programa dicen nada. Con dos programas que preguntan igual funciona; con un tercero que
   redacte distinto, un campo **casa en silencio o se pierde en silencio**. La plantilla por programa ya
   existe (`programs.plantilla_lead`, ADR 0019). Propuesta: que el defecto viva ahí (cargado una vez) y el
   código no tenga títulos; `agenda` ya se trata así en el webhook. No urgente: se hace antes de sumar un
   tercer programa.
5. **`sources.calificacion` (jsonb, los pesos del puntaje por fuente) está muerta** desde el 28-sep (T2
   borrado) y con el score de Typeform (070) no vuelve. Retirar la columna en una migración de limpieza.

## C. Menores

6. `MONEDAS = ["USD", "COP"]` (`lib/monedas.ts`) con la decisión "solo USD" (081). Revisar si COP sigue
   haciendo falta para la pauta (E7) antes de quitarlo.

## Lo que NO es deuda (y por qué)

Etapas, transiciones y resultados de llamada son tipos (el código decide con ellos, ADR 0012). Días hábiles
es regla de Retia para todos. Los límites técnicos (lotes de 200, retención de 90 días, tolerancia de firma)
no dependen de un programa.
