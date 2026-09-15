# 0010 — Los registros nativos del CRM reusan las tablas calls y sales existentes

**Fecha:** 2026-09-15

Con ADR 0008, las llamadas y ventas que un closer registra directo en el CRM necesitan un lugar
donde vivir. `calls` y `sales` ya existen (`lib/db/schema.ts`) pero fueron disenadas para filas
sincronizadas de Sheets: llevan `huellaFila` como parte de su deduplicacion (ADR 0005) y un
`origen` de texto con default `"sheets"`.

**Decidimos reusar esas mismas tablas** en vez de crear tablas paralelas para los registros
nativos. Un registro de la app se guarda con `origen = "app"` y `huellaFila = NULL`; Postgres
permite multiples `NULL` en un indice unico, asi que no colisiona con la deduplicacion de filas de
Sheets. La alternativa (tablas separadas) evitaria mezclar dos origenes en una misma tabla, pero
obligaria a que cualquier metrica futura (cierres por closer, caja por programa) sume dos tablas en
vez de una, para siempre.

**Consecuencia:** falta agregar a `sales` el campo de plataforma de pago (lista fija con opcion
"otro", ver `docs/spec.md`), que hoy no existe en el schema.
