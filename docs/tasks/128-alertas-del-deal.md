---
id: 128
etapa: E6
serves: "docs/anotaciones.md A-13 · principio P-1 · ADR 0050"
depends: [074, 071, 135]
status: en curso
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

- [x] Para cada flecha del camino feliz, lo que dice el amarillo es exactamente lo que `moverEtapa`
      rechazaría (test que compara las dos salidas, como `tests/saldo-centralizado.test.ts`).
- [x] Un deal que aparece en "necesita atención" del Inbox muestra la misma alerta en rojo en su
      ficha, y uno que no, no (mismo test en los dos sentidos).
- [x] Resolver la alerta desde el bloque la hace desaparecer sin recargar a mano (`router.refresh()`).
- [x] Recorrido visual a 390 px con la consola abierta.

## Kiro

Sí, con revisión visual.


---

## Enmienda 2026-10-01 (norte comercial, lote 1, [`docs/comercial.md`](../comercial.md))

- **Rojo nuevo: atendido sin Grain** (ADR 0066), con la función del **135**, no una copia. Depende del 135.
- **Amarillo:** "Falta el producto" pasa a "Falta el valor vendido" (132), y sale de `queLeFalta` como todo lo demás.

## Entrega 2-oct (Codex implementa, Claude revisa)

- `alertasDelDeal` en `lib/queries/ficha-deal.ts`, bloque `components/deals/ficha/ficha-alertas.tsx` arriba de la ficha.
  **Rojo:** las filas de `inboxDelPrograma(…, "equipo").atencion` de este deal y su llamada de hoy sin resultado (sin
  copiar la regla; `inbox.ts` no se tocó). **Amarillo:** `queLeFalta` por cada flecha de `siguientesDe`, con los hechos
  de `leerHechos` (se exportó de `mover-etapa.ts`); el camino feliz arriba, las otras rutas plegadas, sin el requisito
  "motivo" (se pide en el diálogo de mover). Cada requisito enlaza a la sección que lo resuelve. **Aviso en En gestión:**
  "Para registrar un pago, primero marca el contacto como logrado" (un lead trabajado solo por WhatsApp va a pago por
  E2 → E6, sin agenda).
- **Fuera de esta entrega (Mani, 2-oct):** la alerta roja de Grain (la enmienda de arriba queda sin aplicar) y el
  indicador del Kanban. Tampoco entra "se perdió en el Calendly" (118, función aparte del Inbox); si se quiere en
  rojo, se agrega leyendo esa función.
- Recorrido en `dev:local` a 375 px: En gestión muestra aviso y "falta el contacto"; registrar el contacto por
  WhatsApp movió el deal a Contactado (E2) y el bloque desapareció sin recargar. Consola limpia.
- Ojo: con el camino feliz cumplido y sin urgentes el bloque NO se muestra, aunque otras rutas tengan faltantes.
- Tests: `tests/alertas-del-deal.test.ts` (amarillo contra el rechazo real de `moverEtapa`, rojo contra el Inbox en
  los dos sentidos). Corridos por Codex; en local la máquina no tenía aire tras rebasar sobre el 118, los valida el CI.
