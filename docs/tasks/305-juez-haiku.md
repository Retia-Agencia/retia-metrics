---
id: 305
etapa: envios-falsos
serves: "ADR 0105 punto 2 (la IA) y punto 6"
depends: [304]
status: todo
---

# 305 — El juez Haiku

## Por qué

Las reglas no ven lo que solo dice el texto: "No tienes corazón para estafar, yo tampoco lo voy a tener con tu hijo".
Haiku marca lo que se ve raro, en unión con las reglas (ADR 0105 punto 2). Costo estimado: unos USD 0,27 al mes con
~860 envíos.

## Alcance

1. `lib/sospecha/juez-ia.ts` con el SDK oficial `@anthropic-ai/sdk` (se instala en este ticket, ADR 0006), modelo
   `claude-haiku-5-5`, salida estructurada (`output_config.format` con `{sospechoso, razones[]}`), effort bajo.
2. **Qué se manda:** nombre, correo, teléfono, todas las respuestas del envío (o, para una cita suelta, las del
   invitado en Calendly) y las razones de las reglas. Sin ids
   internos, sin UTM y sin datos de otros leads. El texto del envío va como dato, nunca como instrucción (un troll
   escribe para mover la respuesta).
3. **Si falla** (sin crédito, timeout, `refusal`, 5xx): el veredicto queda `sin_revisar_por_ia` y el siguiente envío lo
   reintenta (304). Las reglas ya marcaron lo suyo.
4. La llave: `ANTHROPIC_API_KEY` en Vercel, puesta por Mani; ningún otro módulo la lee. Ojo: el `.env.local`
   compartido de los devs no la tiene hoy.

## Fuera

- Jev de TypeSafe: se compara después con los veredictos guardados (ADR 0105, opciones descartadas).
- Cualquier anulado automático (ADR 0105 punto 3).

## Done cuando

- [ ] Test con el cliente simulado: la salida se valida con zod, una respuesta inválida o un error queda como
  `sin_revisar_por_ia`, y lo que se manda no trae ids ni UTM.
- [ ] Prueba manual con los envíos medidos del 23-oct (troll, "A", Karen García): Haiku marca al troll y no a Karen.
- [ ] typecheck, lint y los tests del módulo.
