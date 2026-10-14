---
id: 246
etapa: hub
serves: "ADR 0087 puntos 1, 2, 5 y 8 · docs/hub.md H-3, §5.2 (área, canal)"
depends: []
status: en curso
quien: Mani (14-oct)
---

# 246 — La regla del área y el canal que se define solo

## Objetivo

Que el área (Paid, Orgánico, Referidos, Sin UTM) y el canal de un envío salgan de una regla en código, sin un
catálogo que alguien tenga que mantener.

## Alcance

- **Dentro:** `resolverCanal` (`lib/atribucion/canal.ts`) deja de recibir el catálogo y aplica la regla del ADR
  0087 punto 1, en ese orden. La lista de medios pagos (`cpc`, `paid_social`, `paid`) es un tipo en el código. El
  paso 1 (un id de Meta que existe en el árbol) entra con el 247: aquí la regla arranca en el paso 2.
- **Dentro:** el canal: primera palabra de `utm_source`, normalizada (minúsculas, sin espacios de más; `ig` =
  instagram, `fb` = facebook, `an` = audience network, `msg` = messenger, `th` = threads); la segunda palabra es la
  cuenta (`instagram rosario` = Instagram · Rosario).
- **Dentro:** qué significan `utm_content` y `utm_term` también sale de la regla: `paid_social` = anuncio y
  placement; `cpc` = conjunto y anuncio (lo histórico de Retia); `referido` = código del closer. Hoy lo declara el
  catálogo (`formato` de cada canal).
- **Dentro:** todo lo que hoy lee `canales` (`emparejar`, `hechosDelEmbudo`, la pauta interina, los pares sin
  clasificar, el link de captación) pasa a la regla. `canales` deja de leerse; **no se borra en este ticket**.
- **Dentro:** "sin clasificar" desaparece de las consultas y de la pantalla; las macros sin expandir se siguen
  contando aparte.
- **Dentro:** `AGENTS.md`: la restricción del origen (las dos categorías de huérfano) y las filas de Contratos "A
  qué Canal y Área pertenece un envío" y "Qué significa cada campo UTM", reescritas con el ADR 0087.
- **Fuera:** la vista de cómo cuenta cada UTM (248), los ids de Meta (247), retirar la tabla `canales` (ticket
  aparte cuando nadie la lea).

## Done cuando

- [ ] Los pares que llegaron desde el 7-oct (`docs/hub.md` §2.5) dan el área esperada, incluido `instagram
  francisco` = Orgánico · Instagram · Francisco, con test.
- [ ] Una macro sin expandir en `utm_medium` cuenta como ausente, con test.
- [ ] El guardián de `tests/atribucion-emparejador.test.ts` sigue mordiendo en los dos sentidos.
- [ ] El Dashboard (o el Hub, si ya existe) muestra las mismas áreas que antes para los pares que estaban en el
  catálogo: se compara una semana antes y después del cambio (nota de cierre).

## Notas

Sin migración. Que el área nunca se haya guardado (se deriva al leer) es lo que hace este cambio barato: lo viejo
se reclasifica solo.
