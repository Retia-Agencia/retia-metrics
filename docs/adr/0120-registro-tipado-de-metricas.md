# 0120: Un registro tipado de métricas, con las fichas en código y la prosa en el diccionario

- **Estado:** aceptado · 7-nov-2026 (Mani, grill de la hija B del ticket 385, F4). Esqueleto construido con cinco conceptos;
  el resto migra por el trinquete de `lib/metricas/pendientes.ts`.
- **Concreta:** ADR 0115 N1 (un concepto, un módulo), N4 (un nombre por concepto), N7 (reemplazar es borrar) y N8 (código >
  ADR > ticket > reunión), y la decisión 1 del ticket 385 (registro tipado como fuente de verdad).
- **No cambia ninguna fórmula ni ningún nombre:** solo agrega dónde viven sus campos estructurados y quién los vigila.
- **Diseño completo:** `docs/diseno-registro-de-metricas.md`.

## Contexto

El 30-oct y el 7-nov se midió lo mismo: una cifra con varias respuestas y la suite en verde ("17 ventas contra 11", F2-01).
Las definiciones vivían en tres lugares que nadie comparaba: la prosa de `docs/metricas.md`, los 44 ids de lista del tipo
`Metrica` (`metricas-con-filas.ts`) y los 40 nombres de `lib/vocabulario-metricas.ts`. Ningún test ataba una cosa con la otra,
así que un concepto podía existir en la pantalla sin fila en el diccionario, o con una función que ya nadie llamaba.

## Decisión

1. **Un registro tipado, puro y por concepto** (`lib/metricas/registro.ts`). Una entrada por concepto de negocio, con la
   clave de `lib/vocabulario-metricas.ts`. Cada ficha dice: tipo (simple, razón o derivada), unidad y monedas, ancla de fecha,
   hecho y dimensiones permitidas (amarradas por tipo a la lista blanca del hecho), tablas con vigencia, si suma entre
   programas, cómo informa su cobertura, su función y su gemela TS, y los ids de lista que abre. Solo `import type`: lo puede
   leer un componente cliente, el MCP o WhatsApp sin arrastrar `lib/db`.
2. **El nombre visible sigue en `lib/vocabulario-metricas.ts`.** El registro apunta con `clave`; no copia el nombre. Dieciocho
   archivos ya importan ese vocabulario y lo vigila `hub-vocabulario-guardian`. El glosario `docs/overview.md` §11 conserva
   la definición en prosa y un test exige que el nombre esté ahí.
3. **El diccionario se genera a medias.** Las columnas estructuradas de cada concepto registrado se escriben en
   `docs/metricas.md` §3.0 entre marcas, con `npm run docs:metricas` (`--verificar` no escribe). La fórmula en prosa sigue a
   mano en §3.1 y un test la ata a la ficha: la fila existe, cita la función y dice lo mismo sobre sumar entre programas.
4. **Las funciones se referencian por nombre y archivo**, no se importan. Un test abre el archivo, exige el `export` y exige
   un llamador fuera de `tests/` (N7). Un renombre sin actualizar la ficha falla en CI, no en el build de Vercel.
5. **Migración con trinquete.** Toda clave del vocabulario está en el registro o en `PENDIENTES_DE_REGISTRO`, nunca en las dos,
   y `TOPE_DE_PENDIENTES` debe igualar la longitud de la lista: crecer o encoger es visible en el diff. Migrar un concepto es
   escribir su ficha y borrar su línea de pendientes.
6. **Por ahora el consumidor real es el generador y el test.** Pantallas, WhatsApp y el `outputSchema` del MCP se conectan en
   F5, cuando los nombres de F2-01 a F2-03 estén fijados.

## Alternativas descartadas

- **Solo enriquecer el tipo `Metrica`:** 44 ids de lista no cubren razones, dinero ni metas.
- **Generar todo el .md desde el registro:** la prosa de las fórmulas (hasta 600 caracteres, con ADR y tickets) pasaría a ser
  código; editar una definición dejaría de ser leer un documento.
- **Mantener el .md a mano y parsear la tabla:** el parseo de tablas markdown es frágil y cada cambio se hace en dos lugares.
- **Importar las funciones reales en el registro:** lo vuelve solo de servidor.
- **Un motor de capa semántica (MetricFlow, Cube):** descartados a esta escala en `docs/auditoria-datos-2026-11/f6-investigacion.md`.

## Consecuencias

- Una métrica nueva sin ficha ni línea de pendientes rompe `tests/registro-de-metricas.test.ts` el día que entra su clave al vocabulario.
- Mientras convivan, las filas de prosa de §3.1 repiten Unidad y Función que ya están en §3.0. Al terminar la migración se
  quitan esas columnas de §3.1 (queda la fórmula).
- El inventario de conceptos es el vocabulario (40 claves). Filas del diccionario sin clave (por ejemplo «Saldo de un deal») no
  están cubiertas todavía; entran cuando el vocabulario les dé nombre.
- No hay migración de base de datos.

## Enmienda del 10-nov (ticket 403 F2): el registro admite claves de Pauta

El registro se indexa por `ClaveDeConcepto = ClaveDeMetrica | ClaveDePauta` (`lib/vocabulario-metricas.ts`). Los diez conceptos de
la tabla semanal de Pauta que no son del Hub (inversión, costo por agenda del Hub y del semáforo, ROAS, profit, CPM, CTR, llegada
y conversión de la landing, frecuencia) tienen ficha con el hecho `gasto`, el ancla `fecha_del_gasto` y la unidad `veces`; su nombre
sale de `VOCABULARIO_PAUTA_SEMANAL`. Las claves de la tabla semanal y de los objetivos apuntan a un concepto con ficha
(`CONCEPTO_DE_PAUTA_SEMANAL`, `CONCEPTO_DE_OBJETIVO`) y ya no tienen trinquete propio: queda solo el del vocabulario del Hub.
