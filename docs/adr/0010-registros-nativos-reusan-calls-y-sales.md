# 0010 — Los registros nativos del CRM reusan las tablas calls y sales existentes

**Fecha:** 2026-09-15

Con ADR 0008, las llamadas y ventas que un closer registra directo en el CRM necesitan un lugar
donde vivir. `calls` y `sales` ya existen (`lib/db/schema.ts`) pero fueron disenadas para filas
sincronizadas de Sheets: las dos llevan `huellaFila` como parte de su deduplicacion (ADR 0005), y
`calls` ademas lleva un `origen` de texto con default `"sheets"`.

**Decidimos reusar esas mismas tablas** en vez de crear tablas paralelas para los registros
nativos. Un registro de la app se guarda con `huellaFila = NULL` (y, en `calls`, con
`origen = "app"`); Postgres permite multiples `NULL` en un indice unico, asi que no colisiona con
la deduplicacion de filas de Sheets. La alternativa (tablas separadas) evitaria mezclar dos
origenes en una misma tabla, pero obligaria a que cualquier metrica futura (cierres por closer,
caja por programa) sume dos tablas en vez de una, para siempre.

**Consecuencia:** falta agregar a `sales` el campo de plataforma de pago (lista fija con opcion
"otro", ver `docs/spec.md`), que hoy no existe en el schema.

## Enmienda 2026-09-17 (ticket 004): `sales` nunca tuvo la columna `origen`

El texto original decia que `calls` y `sales` llevaban las dos un `origen` de texto con default
`"sheets"`. Es falso, y ya lo era el 15 de septiembre: la columna existe solo en `calls`, y
`abonos` la sumo despues con default `"app"` (ADR 0013). En `sales` la procedencia de la fila se
lee de `huellaFila`, que es la otra mitad de la regla que este mismo ADR fijo: nula = la escribio
la app, con valor = vino del sync.

Se corrige la descripcion del esquema, no la decision. Reusar las tablas sigue vigente, y las
consultas del ticket 004 no se ven afectadas: ninguna metrica filtra jamas por `origen`, asi que
las filas de Sheets y las de la app se suman sin logica especial.

**No se agrega la columna a `sales`.** Seria un segundo dato para un hecho que `huellaFila` ya
responde, y dos fuentes para el mismo hecho terminan desincronizadas. Es el mismo argumento con el
que el ticket 018 elimino `sales.esPagoCompleto` en vez de mantenerla como cache.
