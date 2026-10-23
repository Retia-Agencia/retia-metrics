---
id: 303
etapa: envios-falsos
serves: "ADR 0105 punto 2 (las reglas)"
depends: []
status: todo
---

# 303 — Las reglas deterministas de un envío falso

## Por qué

Las reglas son el piso del juicio: corren siempre, aunque la API de Claude esté caída (ADR 0105 punto 2). Se
calibraron con la medición del 23-oct sobre 2.564 envíos.

## Alcance

Un módulo puro, `lib/sospecha/reglas.ts` (fuera de `lib/ingesta/`, cuyo guardián prohíbe calificar), que recibe el
nombre, el correo, el teléfono (de un envío o del invitado de una cita suelta, ADR 0105 punto 7) y el hecho "este lead o este teléfono ya se anuló por envío falso en el programa", y
devuelve las razones que dispararon (vacío = nada raro):

- **teléfono en secuencia o repetido:** 7 o más dígitos seguidos ascendentes, descendentes o iguales;
- **teléfono colombiano imposible:** 57 + 10 dígitos que no siguen con 3 ni 6;
- **correo de relleno:** 1 o 2 caracteres antes de la @, o un relleno conocido (`test`, `prueba`, `john.doe`, `asdf`);
- **dominio desechable:** lista corta en el código (mailinator, yopmail, guerrillamail, 10minutemail, temp-mail);
- **reincidente:** el hecho llega como dato; el módulo no consulta la base.

Cada razón es un tipo con su texto para la pantalla ("teléfono en secuencia: 312 345 6789").

## Fuera

- Palabras ofensivas por regex: medido inservible ("trata" contiene "rata"). Eso lo juzga la IA (305).
- Varios correos en un lead, nombre con dígitos: medido que no son señal.
- Validar MX o si el número existe (después, ADR 0105 punto 2).

## Done cuando

- [ ] Tests con los casos medidos: marca `573123456789` (troll), `573222222222` ("A"), `573050000000` ("Carlos"),
  `573211234567` y `john.doe@gmail.com` ("John Doe"), `a@gmail.com`, `prueba@gmail.com`; **no** marca
  `573012345651` (Karen García) ni `573155555569` (Alexander Rosero).
- [ ] typecheck, lint y el test del módulo.
