# 0031 — Una corrida de sync es de un programa, y el candado vive en la base

**Fecha:** 2026-09-19 · **Estado:** aceptado (Mani, 19-sep) · **Cierra:** F-03 y F-07 · **Se apoya
en:** ADR 0005 (la garantia vive en la base), ADR 0018 (neon-http)

## El problema

F-03 ("dos sync simultaneos se pisan") y F-07 ("corrida de sync atribuida a la primera fuente")
estaban anotadas como dos deudas sueltas desde agosto. Son la misma.

`lib/sheets/sync.ts` explica en su cabecera por que las personas se sincronizan **por programa**:
un programa tiene varios formularios, se leen todos juntos y se deduplica sobre el conjunto, porque
si cada fuente se sincronizara por su cuenta `numAplicaciones` dependeria del orden de ejecucion y
correr el sync dos veces no daria el mismo resultado. La tabla, en cambio, colgaba la corrida de
una fuente:

```ts
.insert(syncRuns).values({ sourceId: fuentes[0].id, estado: "corriendo" })
```

De ahi salen las dos:

- **F-07.** Comunicarte tiene dos fuentes de personas activas: `Formulario anterior` (orden 1) y
  `Formulario actual` (orden 2). `fuentes[0]` es la de orden menor, asi que **toda corrida de
  Comunicarte quedaba atribuida al formulario VIEJO**, el de 65 personas, habiendo leido los dos.
  `/nerd-stats` pintaba ese nombre en una columna llamada "Fuente". No falla, no avisa: **miente, y
  se ve creible** — la familia del centinela del ano 1 (ADR 0030).
- **F-03.** No habia ninguna llave por programa sobre la cual poner un candado. Y el camino
  habitual estaba cerrado: con `drizzle-orm/neon-http` cada consulta es su propia peticion HTTP, o
  sea su propia sesion, asi que `pg_advisory_lock` **no sirve** (diagnosticado el 16-sep).

Hoy los dos disparadores conviven: el cron diario de Vercel y el boton manual de `/ajustes/fuentes`.
Nada impedia que se solaparan.

## Decidimos

**1. La corrida es de un PROGRAMA. `sync_runs.program_id` entra NOT NULL y `source_id` se va.**

El modelo honesto es el que el codigo ya practicaba. Dejar `source_id` "por si acaso" era dejar una
columna con dos significados que nadie iba a llenar. Si algun dia una corrida SI es de una sola
fuente —las fuentes de `calls`, `sales` y `ad_spend` estan sembradas pero inactivas— la columna
vuelve con su migracion, cuando el uso sea real y no antes (ADR 0006).

La trazabilidad de la bitacora no se toca: `change_log.sync_run_id` sigue apuntando a la corrida.

**2. Lo que si se queria saber de las fuentes se guarda como DATO, no como llave foranea.**

`sync_runs.fuentes_leidas` (jsonb): `[{ nombre, tab, filas }]`. Es exactamente lo que la corrida ya
calculaba y solo imprimia en consola. Una FK podia nombrar una de varias; una lista las nombra
todas, con cuantas filas trajo cada una. El `tab` va aparte del `nombre` porque la pestana es lo
que se abre en Sheets cuando hay que revisar por que vino vacia.

Las corridas anteriores a la migracion quedan con `fuentes_leidas` en `null` y la pantalla muestra
`—`. **No se les invento el dato**: es la misma regla con la que no se les fabrico `change_log` a
los 5 enlaces de pago (ADR 0029). Un rastro inventado se ve identico al de verdad.

**3. El candado es un indice unico PARCIAL, y el INSERT de la corrida ES el candado.**

```sql
CREATE UNIQUE INDEX sync_runs_una_corriendo_por_programa_idx
  ON sync_runs (program_id) WHERE estado = 'corriendo';
```

Mismo molde que `cohorts_una_activa_por_programa_idx` (ADR 0005): solo las filas `corriendo`
compiten por la unicidad, las `ok` y `error` historicas no. No hay que pedir un candado y despues
acordarse de soltarlo — **la fila que marca "estoy corriendo" es el candado**, y termina de
existir como candado en el mismo UPDATE que la cierra. Un segundo sync choca con `23505` y se
traduce a un 409.

Que viva en la base y no en el codigo es lo que lo hace cierto para el cron, para el boton, para
`npm run sync` desde la terminal de cualquiera y para el script que alguien escriba en diciembre.

**4. Una corrida `corriendo` de mas de 10 minutos esta muerta, y se cierra antes de intentar.**

Sin esto, una funcion que se cae a la mitad deja la fila `corriendo` para siempre y el candado pasa
de proteger a bloquear: el sync no vuelve a correr nunca y nadie se entera. Antes de insertar, las
corridas del programa con mas de `MINUTOS_ANTES_DE_DAR_POR_MUERTA` sin terminar quedan en `error`
con el porque escrito.

**El 10 no es un numero redondo elegido de gusto: es 2x el techo real.** Las dos rutas declaran
`maxDuration = 300`, asi que una corrida de mas de 5 minutos en Vercel esta muerta con certeza.
`npm run sync` desde la terminal no tiene ese limite, pero el sync completo tarda ~4 segundos
(1.253 personas, por lotes), asi que el margen es de dos ordenes de magnitud. Si algun dia el techo
de Vercel cambia, el que cambia es este numero y esta escrito al lado.

**5. Chocar con el candado NO es un fallo.**

`SyncEnCursoError` es 409, no 500. En el cron se cuenta como `omitidos`, aparte de `fallidos`:
contar el candado funcionando como una rotura haria que el cron se viera roto justo cuando hizo lo
correcto, y el dia que algo se rompa de verdad el numero ya no significaria nada.

## La trampa que estaba puesta

El `try/catch` de `sincronizarPersonas` termina marcando la corrida como `error` usando
`corrida.id`. Meter el candado DENTRO de ese try parece natural y es exactamente al reves de lo
que se quiere: un sync rechazado **marcaria como `error` la corrida viva de otro**. El reaper y el
insert van fuera, y hay un test que muerde justo eso — despues del 409, la primera corrida sigue
`corriendo` y sin `errores`.

🎯 **La forma general: un guardia que escribe en el recurso que protege tiene que probar que no lo
toca cuando rechaza.** Es la version "candado" de la leccion del ADR 0030 sobre guardianes: se
prueba en los dos sentidos, que caza lo malo y que **no** muerde lo bueno.

## El orden del despliegue, que aqui SI importa

Las migraciones anteriores eran aditivas, y por eso la regla del 18-sep era "migrar antes de
pushear": una columna nueva no rompe al codigo viejo, pero codigo nuevo contra un esquema viejo
revienta. **Esta no es aditiva.** `program_id` entra NOT NULL y `source_id` se va, asi que hay una
ventana en la que el codigo desplegado y el esquema no se entienden **en cualquiera de los dos
ordenes**.

Se asume la ventana en vez de partir el cambio en tres migraciones al estilo zero-downtime, y se
asume con los ojos abiertos: el unico escritor automatico es el cron diario de las 7am Colombia,
son 5 usuarios, y **un sync que falla no deja nada a medias** — el insert de la corrida falla antes
de escribir una sola persona, y el sync siguiente recalcula todo desde cero por diseno. El costo
maximo es una corrida perdida que se repara sola al dia siguiente. Migrar `production` y desplegar
seguidos, fuera de la hora del cron.

## Consecuencias

- **A favor:** la bitacora deja de mentir sobre que se leyo, y pasa a decir mas de lo que decia
  antes (todas las fuentes, con sus conteos).
- **A favor:** la exclusion mutua no depende de que todos los caminos de escritura se acuerden de
  pedirla. Es de la base.
- **A favor:** el reaper deja rastro de las funciones que se caen, que hasta hoy no se veia en
  ninguna parte.
- **En contra:** las 6 corridas historicas de `production` pierden su `source_id`. Era una
  atribucion arbitraria entre las fuentes del programa, y el programa —lo unico que significaba de
  verdad— se conserva backfilleado desde ella.
- **En contra:** la ventana de despliegue de arriba.
- **Lo que NO resuelve:** dos corridas de **programas distintos** siguen pudiendo solaparse, a
  proposito: no comparten ninguna fila y el cron las corre en serie igual. Y el candado no es un
  reintento: quien choca recibe un 409 y decide, no se queda esperando turno.
