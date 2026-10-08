---
id: 206
etapa: O7
serves: "docs/anotaciones.md A-109; amplía ADR 0049 punto 7"
depends: [096, 052]
status: todo
---

# 206 — Una suelta se adopta por correo cuando llega el formulario

## Por qué existe

Hoy una suelta se adopta sola en un solo caso: el envío trae **esa misma cita** (el uuid del invitado,
`adoptarSueltaDeCita`). Si alguien agenda primero por el link directo de Calendly y después llena el
formulario sin agendar (o agenda de nuevo con otro invitado), su suelta se queda en el Inbox aunque ya haya
un lead y un deal con el mismo correo, sin ninguna duda sobre a quién pertenece.

## Decisión (Mani, 8-oct)

Cuando la ingesta termina con un envío de un lead, cada llamada **suelta y vigente** del mismo programa
cuyo correo es de ese lead se cuelga sola de su deal, **si y solo si no hay duda**. La duda la decide la MISMA
regla que ya usa el webhook de Calendly, `emparejarLlamada` (correo confirmado de un solo lead, con un solo
deal abierto): no se escribe un segundo criterio.

## Alcance

- Dentro de la transacción de la ingesta, después de la regla de deals (`lib/ingesta/regla-de-deals.ts`).
- El efecto es el de asignar una suelta: la llamada cuelga del deal, el deal va a Agendado si el motor lo
  permite y la host queda de dueña (`darDealAlHost`), con rastro (`change_log`) y una nota del sistema en el
  deal ("Se colgó la llamada suelta del <fecha> por el correo").
- Varias sueltas del mismo correo se cuelgan todas, de la más vieja a la más nueva.
- Con duda (dos leads o dos deals abiertos) no se toca nada: sigue suelta.
- Nada cruza programas.

## Done cuando

- [ ] Test por la ruta real del webhook: suelta → envío del mismo correo → llamada colgada y deal en
      Agendado con la host de dueña; con dos deals abiertos se queda suelta; otro programa no la ve.
- [ ] La adopción por uuid (`adoptarSueltaDeCita`) sigue igual.
- [ ] typecheck, lint y los tests de ingesta y Calendly en verde.
