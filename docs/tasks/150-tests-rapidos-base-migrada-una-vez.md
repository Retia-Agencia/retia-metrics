---
id: 150
etapa: O1
serves: "plan-reparto.md §6 (checkpoints) · AGENTS.md, Feedback loops"
depends: []
status: todo
---

# 150 — Tests rápidos: la base de prueba se migra una vez por corrida, no una vez por archivo

## Objetivo

Que la suite completa sea más rápida en el CI, porque es la que valida cada checkpoint, y que los tests de un
ticket también corran más rápido en local.

## Contexto

`tests/helpers/base-de-prueba.ts` ya cachea el volcado de la base migrada, pero **por archivo**: vitest aísla los
módulos de cada archivo, así que ~91 archivos de test pagan cada uno `new PGlite()` (~700 ms) y las 58
migraciones (~150 ms). La suite completa se cortó tres veces a los 480 s en la Mac de Mani (1-oct, handoff), y
desde ese día no se corre en local: la corre el CI (~6,5 min de `npm test`). Con olas de varias sesiones, el CI de
`main` es la reja de cada checkpoint (`plan-reparto.md` §6), y cada minuto de esa corrida es un minuto en que
nadie puede empujar.

## Alcance

- **Dentro:** volcar la base migrada **una vez por corrida** en un `globalSetup` de vitest (`vitest.config.mts`),
  escribirla a un archivo temporal y que `crearBaseDePrueba` cargue de ahí. Si el archivo no existe (un test
  suelto lanzado de otra forma), cae al volcado por archivo de hoy.
- **Dentro:** la garantía de hoy no se pierde: si una migración trae SQL inválido, la corrida revienta con ese
  error, una vez y de forma visible.
- **Dentro:** medir antes y después: el tiempo de `npm test` en el CI y el de un archivo suelto en local. Las dos
  cifras van en la nota de cierre.
- **Dentro:** si mide bien, un bucle local opcional `npm run test:cambios` (`vitest --changed` por
  `scripts/test.mjs`, con el mismo candado). Se documenta en `AGENTS.md`, Feedback loops.
- **Fuera:** cambiar PGlite por otra cosa, y paralelizar más workers (la Mac ya se queda sin memoria).
- **Fuera:** los tests contra Postgres real (`DATABASE_URL_PRUEBA_POSTGRES`): no usan el volcado.

## Done cuando

- [ ] `npm test` en el CI tarda menos que antes, con las dos cifras medidas en la nota de cierre.
- [ ] Una migración con SQL roto (probada a mano en una rama y descartada) hace fallar la corrida con el error
      de la migración.
- [ ] `npm test -- tests/x.test.ts` sigue funcionando solo, con o sin el volcado global.
- [ ] `AGENTS.md` (Feedback loops) dice el tiempo nuevo y, si existe, el bucle `test:cambios`.
