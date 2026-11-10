# Diseño del registro tipado de métricas

> Ticket 385 F4 · ADR 0120 · 7-nov-2026. Qué es, qué contiene, cómo se consume, cómo se amplía y qué falta. Lo que ya existe
> está en `lib/metricas/` y se vigila con `tests/registro-de-metricas.test.ts`; lo demás está marcado **por construir**.

## 1. Piezas

| Pieza | Archivo | Qué hace |
|---|---|---|
| Fichas | `lib/metricas/registro.ts` | `REGISTRO`: una ficha por concepto registrado, con la clave del vocabulario. Puro: solo `import type`. |
| Pendientes | `lib/metricas/pendientes.ts` | Las claves del vocabulario aún sin ficha, y el tope que solo encoge. |
| Generador | `lib/metricas/ficha.ts` + `scripts/generar-diccionario-metricas.ts` (`npm run docs:metricas`) | Escribe el bloque de `docs/metricas.md` §3.0 entre marcas. `--verificar` no escribe. |
| Nombres | `lib/vocabulario-metricas.ts` (ya existía) | Nombre corto, largo y definición por clave. El registro no los copia. |
| Prosa | `docs/metricas.md` §3.1 y `docs/overview.md` §11 | La fórmula y el glosario, a mano. |
| Guardián | `tests/registro-de-metricas.test.ts` | Ata todo lo anterior (§4). |

## 2. La ficha

| Campo | Tipo | Qué dice | Por qué es cerrado |
|---|---|---|---|
| `filaDelDiccionario` | texto | primera celda de su fila de prosa en §3.1 | la prosa se encuentra por ese texto |
| `tipo` | `simple` · `razon` · `derivada` | cómo se calcula | una razón y una derivada nombran conceptos ya registrados en `de` |
| `unidad` | `cupos` · `personas` · `citas` · `deals` · `dinero` · `porcentaje` | qué se cuenta | evita "ventas" frente a "personas" frente a "citas" (H-02, H-04) |
| `monedas` | `usd` · `cop` | en qué se expresa; vacío si no es dinero | nunca se convierte en silencio |
| `anclaDeFecha` | unión cerrada | con qué fecha se ubica en un periodo | cada ancla se define en `hechos/fechas.ts` |
| `dimensiones` | lista blanca del hecho, por tipo | por qué se filtra o agrupa | el compilador la amarra a `DimensionVenta`, `DimensionAbono`… |
| `vigencia` | tablas | qué lecturas pasan por `vigente()` | ADR 0026, 0038 |
| `sumaEntreProgramas` | booleano | ¿se suma en "todos los programas"? | ADR 0048 |
| `cobertura` | `no_aplica` · `exclusiones_contadas_aparte` · `razon_con_cobertura` | cómo dice lo que no pudo calcular | N3 |
| `funcionSql` · `gemelaTs` | `{ archivo, nombre }` | la función canónica y su gemela | N1; el test exige existencia y llamador |
| `listas` | ids de `Metrica` | qué listas abre la cifra | un id pertenece a un solo concepto |

Hechos cubiertos hoy por el tipo: `venta` y `abono`. Cuando se registren conceptos de envío, agenda o cita se agregan al
mapa `DimensionesPorHecho`. Los de **agenda y cita esperan al ticket 353**.

## 3. Cómo se consume

| Consumidor | Estado | Cómo |
|---|---|---|
| Diccionario `docs/metricas.md` §3.0 | **hecho** | `npm run docs:metricas`; el test falla si está viejo |
| Pantallas | por construir (F5/358) | importan la ficha para unidad, moneda y si suman entre programas; el rótulo sigue saliendo de `nombreCorto(clave)` |
| WhatsApp | por construir (F5) | el texto del semáforo toma nombre y unidad de la ficha |
| `outputSchema` del MCP | por construir (F5) | un esquema por herramienta derivado de las fichas; el campo lleva `nombreLargo` y `definicion` |
| Paridad (hija A, números dorados) | por construir | un caso por ficha con la función y la gemela como par a comparar |
| Guardianes (hija C) | por construir | la matriz hechos × dimensiones y la regla "toda razón con cobertura" leen las fichas |

El registro es puro precisamente para que cualquiera de ellos lo importe sin traer la base de datos al navegador.

## 4. Qué vigila el test

1. Cada clave del vocabulario está en el registro o en pendientes, nunca en las dos; `TOPE_DE_PENDIENTES` igual a la longitud.
2. La forma es coherente: simple sin `de`; derivada y razón con `de` registrado; razón con cobertura; dinero con moneda.
3. Cada id de lista está en `METRICAS_DE_LISTA` y no se repite entre conceptos.
4. Cada función citada se exporta de su archivo y tiene un llamador fuera de `tests/` (N7). Muerde en los dos sentidos.
5. §3.0 está al día con el registro; el generador cambia de salida si cambia la ficha y lanza sin marcas.
6. Cada concepto tiene su fila en §3.1, que cita la función y coincide en "¿se suma entre programas?".
7. El nombre corto de cada concepto aparece en el glosario de `overview.md` §11.

## 5. Cómo se agrega un concepto

1. Si la clave no existe en `lib/vocabulario-metricas.ts`, se agrega con su nombre corto, largo y definición; el test exige
   subir `TOPE_DE_PENDIENTES` o registrarla en el mismo cambio.
2. Se escribe la ficha en `REGISTRO` y se borra la línea de `PENDIENTES_DE_REGISTRO` (bajar el tope en uno).
3. La fila de prosa en §3.1 (fórmula, ADR, ticket) y el nombre en `overview.md` §11.
4. `npm run docs:metricas`.
5. `npm test -- tests/registro-de-metricas.test.ts`.

## 6. Migración incremental

Hecho al 10-nov (403): los 40 conceptos del Hub y los 10 de Pauta tienen ficha; el trinquete está en 0 y se conserva como guardián. Historia: `ventas`, `vendido`, `recaudado`, `por_cobrar`, `entro_a_caja` fueron los primeros (35 pendientes de 40). Orden sugerido para el resto, de
lo que da cifras falsas hoy a lo cosmético: (1) lo que desbloquea el 353 (`shows`, `no_asistio`, `llamadas_sin_resultado`,
`asistencia`, `cierre_de_ventas`, `citas_*`); (2) `registros`, `leads` y los deals desde formulario (354); (3) objetivos,
proyección y comisión; (4) lo que queda. Cada paso baja el tope y no cambia ninguna cifra.

## 7. Lo que no resuelve (por construir)

- **Gasto y pauta:** no hay módulo `hechos/gasto.ts`; esperan al 355.
- **Una función por métrica de verdad:** la ficha apunta a la función canónica, no la reemplaza. Mientras haya seis recorridos a
  la venta (H-08) el registro dice cuál es el canónico y los guardianes de la hija C vigilan que nadie escriba otro.
- **Filas del diccionario sin clave** (por ejemplo «Saldo de un deal»): entran cuando el vocabulario les dé nombre.
- ~~Quitar de §3.1 las columnas ya cubiertas por §3.0~~: hecho el 10-nov; §3.1 es Métrica, Fórmula y Estado, y las filas sin ficha llevan su unidad, suma y función dentro de la fórmula.
