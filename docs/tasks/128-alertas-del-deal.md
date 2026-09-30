---
id: 128
etapa: E6
serves: "docs/anotaciones.md A-13 · principio P-1 · ADR 0050"
depends: [074, 071]
status: todo
---

# 128 — Las alertas del Deal: qué urge y qué le falta para avanzar

## Objetivo

Que un closer abra un Deal y sepa **sin memorizar nada** qué tiene que hacer. Arriba de la ficha, un
bloque de alertas en dos colores:

- **Rojo · urgente:** lo que ya está mal y cuesta plata si se deja. Hoy son exactamente los motivos de
  "lo mío que necesita atención" del Inbox (`MotivoAtencion` en `lib/queries/inbox.ts`): Re-agenda sin
  fecha, Compromiso Verbal vencido, fecha de pago vencida con saldo, lead que volvió a llenar el
  formulario, deal estancado. Más la llamada de hoy sin resultado.
- **Amarillo · para avanzar:** lo que le falta al deal para moverse a la **siguiente etapa**, dicho en
  español explícito ("Falta el producto", "Falta el link de Grain de la llamada"). Sale de
  `queLeFalta` (`lib/deals/requisitos.ts`), el mismo que hoy solo se usa como reja al mover.

## Por qué así (y no una lista nueva)

**Una respuesta, un módulo** (AGENTS.md, regla del ADR 0024). Las dos preguntas ya tienen dueño:
el motor de etapas sabe qué exige cada flecha y el Inbox sabe qué está vencido. Si el bloque de
alertas escribiera sus propias reglas, la ficha diría "te falta X" mientras el motor exige Y, y el
closer aprendería a no creerle. Por eso:

- El amarillo llama a `queLeFalta(etapaActual, destino, hechos)` para cada flecha permitida desde la
  etapa actual (`mapa-transiciones.ts`) y muestra la del **camino feliz** primero (la siguiente etapa
  del embudo), las otras plegadas.
- El rojo reutiliza la decisión del Inbox extraída a una función por deal, que el Inbox también
  importa. Nunca una segunda copia de "qué está vencido".

## Alcance

- **Dentro:** el bloque en la ficha del Deal (074), con la acción para resolver cada alerta ahí mismo
  cuando existe (elegir producto, pegar el Grain, poner fecha), según P-1.
- **Dentro:** un indicador pequeño en la tarjeta del Kanban (rojo/amarillo, conteo), mismo origen.
- **Fuera:** avisos push o por WhatsApp. Esto se calcula al leer, sin cron.
- **Fuera:** alertas configurables por programa, salvo la X de estancado, que ya existe
  (`programs.dias_sin_actividad`).

## Done cuando

- [ ] Para cada flecha del camino feliz, lo que dice el amarillo es exactamente lo que `moverEtapa`
      rechazaría (test que compara las dos salidas, como `tests/saldo-centralizado.test.ts`).
- [ ] Un deal que aparece en "necesita atención" del Inbox muestra la misma alerta en rojo en su
      ficha, y uno que no, no (mismo test en los dos sentidos).
- [ ] Resolver la alerta desde el bloque la hace desaparecer sin recargar a mano (`router.refresh()`).
- [ ] Recorrido visual a 390 px con la consola abierta.

## Kiro

Sí, con revisión visual.
