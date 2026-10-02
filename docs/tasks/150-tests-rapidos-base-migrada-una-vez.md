---
id: 150
etapa: O1
serves: "plan-reparto.md §6 (checkpoints) · AGENTS.md, Feedback loops"
depends: []
status: done
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

- [x] `npm test` en el CI tarda menos que antes, con las dos cifras medidas en la nota de cierre.
- [x] Una migración con SQL roto (probada a mano en una rama y descartada) hace fallar la corrida con el error
      de la migración.
- [x] `npm test -- tests/x.test.ts` sigue funcionando solo, con o sin el volcado global.
- [x] `AGENTS.md` (Feedback loops) dice el tiempo nuevo y, si existe, el bucle `test:cambios`.

## Nota de cierre (1-oct, Mani)

- **Hecho** (`0e65c15`): `tests/helpers/volcado-global.ts` (globalSetup) migra y vuelca la base una vez por
  corrida a una carpeta temporal que borra al terminar; `crearBaseDePrueba` la carga y, si no existe, migra por
  archivo como antes. La migración y el volcado viven en `tests/helpers/volcar-base-migrada.ts`, una sola copia.
  Nuevo `npm run test:cambios` (`vitest run --changed`, mismo candado).
- **Medido:** CI, vitest **372 s → 274 s** (paso `npm test` 6 min 12 s → 4 min 34 s; corridas `36959521832` y
  `36964729770`). Un archivo suelto en local no gana: ~3,7 s → ~4,2 s, porque la migración se paga igual una vez
  y se suma escribir y leer el volcado.
- **Migración rota:** probada en una rama desechable (`SELEC` en la 0057): la corrida sale con código 1 y el error
  de la migración, una vez, antes de cualquier test.
- 🩸 **El sandbox de Codex no puede correr `npm test`:** `scripts/test.mjs` llama a `ps` y el sandbox lo niega
  (`spawnSync ps EPERM`). Los tests de un ticket delegado los corre la sesión principal.
- **Queda:** el checkpoint verde que lo incluya (y ahí marcarlo en `docs/tasks/README.md`); CI también en ramas.
