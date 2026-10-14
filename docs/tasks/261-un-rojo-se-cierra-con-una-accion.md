---
id: 261
etapa: hub
serves: "ADR 0090 punto 4 · docs/hub.md §5.2 (cierre del ciclo) · la lección de 30X: detectar no es actuar"
depends: [257, 258]
status: todo
---

# 261 — Un rojo del semáforo se cierra con una acción

## Objetivo

Que un rojo de cierre no se pueda olvidar: queda "sin atender" hasta que alguien registre qué se hizo, escala a las 48 h
y el Hub mide qué tanto se cierra el ciclo.

## Alcance

- **Dentro:** cada rojo de cierre (programa o campaña, a las 18 h) queda registrado como pendiente de atender. Se
  atiende ligándole una acción (257): nueva ("pausé la campaña X", "bajé el presupuesto") o una que ya exista.
- **Dentro:** en Hub › Pauta y en Hoy, los rojos sin atender arriba, con sus días, y el botón de crear la acción con la
  cifra ya puesta.
- **Dentro:** a las 48 h sin acción, el rojo sube de nivel y se nombra a quien escala (HQ-2); el resumen de las 18 h de
  Juanito (260) lo trae.
- **Dentro:** la métrica **cierre del ciclo**: rojos con acción ÷ rojos, y horas hasta la acción, por programa y por
  periodo.
- **Fuera:** responder desde WhatsApp (radar).

## Done cuando

- [ ] Un rojo sin acción aparece como sin atender y deja de aparecer al ligarle una, con test.
- [ ] A las 48 h cambia de nivel, con test sobre el reloj.
- [ ] El cierre del ciclo de un caso armado a mano da lo esperado, con test.

## Notas

Los rojos se guardan (son un hecho del día, no se pueden recalcular igual después si cambia el umbral), con su umbral
del momento. La migración la hace la sesión principal.
