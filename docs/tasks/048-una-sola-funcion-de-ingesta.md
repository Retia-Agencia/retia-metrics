---
id: 048
etapa: E3
serves: "plan v2 §6 etapa 3 · tarea E3-1 · invariante 2 del plan v2, insumo §5.5"
depends: [042]
status: todo
---

# 048 — Una sola funcion de ingesta: fila de hoja y payload de webhook entran por la misma puerta

## Objetivo

Que exista **una** funcion que normaliza cualquier entrada a un **Envio**, y que el origen (una
fila de Google Sheets hoy, un webhook de Dapta manana) sea solo un adaptador delante de ella.

## Por que es la primera tarea de la etapa

Es el invariante 2 del plan v2: *"la ingesta es UNA funcion"*. **Es lo que hace que Dapta despues
salga gratis en vez de ser un segundo camino que mantener.** Si el webhook se escribe aparte
cuando llegue, habra dos implementaciones de la identidad del lead, dos de la regla de deals y dos
de los centinelas, y divergiran en silencio, que es la herida de los ADR 0024 y 0026.

## Alcance

- **Dentro:** `ingerirEnvio(entrada)` con su tipo de entrada normalizado: fuente, posicion,
  columnas crudas y su mapeo ya resuelto.
- **Dentro:** el adaptador de Sheets, que es lo que hoy hace `lib/sheets/sync.ts`, reescrito para
  llamar a la funcion en vez de escribir la persona directo.
- **Dentro:** el **enganche** del webhook (el tipo de entrada y el punto de llamada). **No** la
  ruta ni la autenticacion del webhook: eso se activa con Dapta.
- **Fuera:** la identidad del lead (050), el estado (051), la regla de deals (052). Esta funcion
  los **orquesta**; cada uno vive en su modulo.

## Lo que se conserva del motor de hoy

`lib/sheets/leer.ts`, `mapeo.ts`, `auth.ts`, el candado de `sync.ts` y `ejecutar-juntas.ts` (ADR
0019, 0031). Esto reescribe **que se hace con la fila**, no como se lee la hoja ni como se evita
que dos corridas se pisen.

## La escala, medida

El sync completo procesa 4.791 leads en ~3,2 s y tiene que caber en el `maxDuration` de una
funcion de Vercel. **Toda operacion sobre el set completo se escribe por lotes desde el principio**
(`TAMANO_DE_LOTE` = 200): fila por fila tardaba 161 s y se pasaba.

## Done cuando

- [ ] Hay una sola funcion de ingesta y el adaptador de Sheets la usa.
- [ ] Un test le pasa un payload con forma de webhook **sin tocar Sheets** y produce el mismo
      Envio que la fila equivalente.
- [ ] El candado del ADR 0031 sigue verde (`tests/sync-candado.test.ts`).
- [ ] Una corrida completa sobre `dev` sigue cabiendo en el limite de tiempo.

## Kiro

Si, **con revision cercana**: aqui un bug es silencioso.

## Avance 22-sep (status sigue `todo`)

- ✅ **La puerta existe y es pura:** `construirEnvio(entrada)` en `lib/ingesta/envio.ts`, con
  el tipo `EntradaEnvio` (fuente, zona, posición, columnas crudas, mapeo resuelto y `esParcial`
  opcional para el webhook). El adaptador de Sheets es `entradasDesdeMatriz` en
  `lib/ingesta/adaptador-sheets.ts`.
- ✅ Test: un payload con forma de webhook produce **el mismo Envío** que la fila equivalente
  (`tests/ingesta-envio.test.ts`).
- ⏳ **Falta:** que `lib/sheets/sync.ts` use la puerta y escriba por lotes (con el 049). Si se
  decide R1 (transacciones), esa escritura va sobre el driver nuevo.
