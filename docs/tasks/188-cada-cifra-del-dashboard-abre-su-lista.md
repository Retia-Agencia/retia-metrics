---
id: 188
etapa: O6
serves: "ADR 0067; 148 (Lo que sigue, puntos 1, 2, 4, 6 y 13)"
depends: [148, 065]
status: en revisión
---

# 188 — Cada cifra del dashboard abre su lista: embudo por etapa y comparativo

## Por qué existe

El 148 dejó cifras sin clic, contra el ADR 0067: las del embudo por etapa (065) y las filas del comparativo entre
closers. Y dos detalles de la lista que se ven raros.

## Alcance

1. **Embudo por etapa:** métricas nuevas en `lib/queries/metricas-con-filas.ts` (abiertos por etapa y owner, sin
   dueño por antigüedad, entraron a cada paso, tiempo en etapa), con el universo de `lib/queries/embudo-etapas.ts`.
   Los ids no van en la URL: la lista se recalcula con la métrica, la etapa y el rango.
2. **Comparativo:** cada celda (agendas, shows, cierres, caja) abre su lista filtrada por ese closer, con el código
   opaco (`codigoDeCloser`). Si el 187 ya cambió las tasas, la celda abre el grupo del 187.
3. **La lista desde un dashboard sin comparación** no inventa un periodo B (`vistaDeLista`).
4. **Una sola etiqueta de closer** en el dashboard y sus listas (hoy el comparativo usa `coalesce(closer_id, nombre,
   email)` y las listas `closer_id`). La función vive en `lib/closers/identidad.ts`.
5. **Color por antigüedad en las listas (GC-35):** los tonos de `<Badge variant>` (Tinta), sin colores a mano.

## Done cuando

- Por cada métrica nueva, un test que compara la cifra contra todas las páginas de la lista (con anulados y otro
  programa en la base).
- Clic en cada celda del comparativo abre la lista del closer correcto; forjar el código de un closer de otro
  programa da 404 o lista vacía, nunca filas ajenas.
- Typecheck, lint, tests, `npm run build`; recorrido en `dev:local`.

## Nota de cierre (5-oct, Alejo + Claude; Codex sin cuota)

- **Embudo por etapas:** `lib/queries/embudo-con-filas.ts` decide qué deals forman cada cifra (entraron, cada paso,
  salieron de cada etapa, abiertos por etapa, sin dueño por tramo) desde el MISMO cálculo que la pinta;
  `cargarEntradaDelEmbudo` y `entradasAlEmbudo` salen de `embudo-etapas.ts` para eso. En `metricas-con-filas.ts` son
  las métricas `etapa_*` (con `etapa` o `antiguedad` en la URL, sin ids). El dashboard arma todas las celdas desde UNA
  carga (`detallesDelEmbudo`). Abiertos y sin dueño son foto de hoy: la lista dice "A hoy, sin periodo". La fecha de
  la fila es la entrada del deal al embudo.
- **Comparativo:** cada celda abre la lista del closer (`detallesDelComparativo`); el % de show abre su grupo de citas y
  el % de cierre el grupo con show (ADR 0079). `vistaDeLista` busca el código también entre las cuentas, porque el
  comparativo junta bajo el `users.id` las filas históricas sin FK con el texto de esa cuenta.
- **Encontrado con el test:** la fila "sin closer" del comparativo no abría su lista (la clave histórica vacía comparaba
  contra `null` y daba 0). Ahora significa sin FK y sin texto (`porClaveConFk`) o sin dueño (`porClaveDeDeal`).
- **Sin B:** `urlDeLista` marca `sin_b=1` cuando el origen no compara, y la lista no inventa uno.
- **Una etiqueta:** `etiquetaDeCloserSql` / `etiquetaDeCloser` en `lib/closers/identidad.ts`; reemplaza siete copias y
  las listas que solo leían `closer_id` (un closer sin `closer_id` salía "Sin closer" en su lista).
- **GC-35:** los días de la lista llevan el tono de su tramo (neutro, info, alerta, peligro).
- Tests: `tests/cifras-del-embudo-y-comparativo.test.ts` (cada cifra del embudo contra todas las páginas, con anulados y
  otro programa; cada celda del comparativo; la agenda histórica sin FK; forjar el código de otra closer) y el de `sin_b`
  en `metricas-con-filas.test.ts`. 18 archivos vecinos en verde (230 tests), typecheck, lint y `npm run build`.
- Recorrido en `dev:local`: diálogos abiertos con clic (caja de carlos 9 registros = USD 4.643,65 en la lista; abiertos
  en Agendado de maria 15 = 15), consola limpia, "todos los programas" con sus celdas, y 375 px sin desborde.
- **Revisión del cadenero (otra sesión):** sin fuga de programa ni anulados. Encontró que "sin dueño por antigüedad"
  medía en horas y su lista en días de calendario (un deal de las 18:00 caía en "0-7" con 8 días en la lista): ahora
  el embudo usa días de calendario de Bogotá, con test. Y que el comparativo cargaba el grupo de citas dos veces por
  closer: ahora una vez por programa.
- **Falta:** el checkpoint.
