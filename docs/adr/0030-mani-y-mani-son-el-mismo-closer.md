# 0030 — `Mani` y `mani` son el mismo closer

**Fecha:** 2026-09-18 · **Estado:** aceptado (Mani, 18-sep) · **Enmienda:** ADR 0011

## El problema

El 18-sep, en el primer recorrido real contra `production`, Mani se cargo su `closer_id` desde
`/ajustes/usuarios` y quedo en **`mani`**. El de la otra closer activa es **`Maru`**. La columna
Closer de las hojas usa nombres capitalizados (`Andrea`, `Juanjo`, `Dana`), y `Andrea` tiene 317
llamadas historicas atadas a esa ortografia.

`closerId` se comparaba como texto crudo en todas partes:

```
lib/queries/dashboard.ts   eq(columna, closerId)      ← el filtro por closer, 7 usos
lib/queries/dashboard.ts   .groupBy(calls.closerId)   ← el comparativo entre closers
lib/mutations/personas.ts  eq(users.closerId, ...)    ← "este closer vende en este programa"
lib/mutations/anulaciones  objetivo.closerId !== ...  ← "esto lo registraste vos"
```

Con eso, `Mani` y `mani` son **dos closers distintos en todas las metricas**:

- El comparativo entre closers muestra dos filas donde hay una persona.
- El filtro por closer devuelve la mitad de sus llamadas.
- `esCloserValidoEnPrograma` diria que un closer no vende en un programa donde si vende.
- La reja de la anulacion le diria "la registro otro closer" a quien la registro.

**Y ninguna de las cuatro lanza un error.** Las dos cifras se ven creibles. Es la misma familia
del centinela del ano 1 (ADR en el CIERRE 4) y de la subconsulta correlacionada del ticket 025:
numeros callados que estan mal.

## Decidimos

**1. La comparacion ignora mayusculas y espacios; el ALMACENAMIENTO no se toca.**

El texto se guarda como lo escribio quien lo escribio. La hoja es la fuente de verdad de los leads
(ADR 0004) y su ortografia es suya: no se puede reescribir, y capitalizar a la fuerza del lado de
la app solo moveria el desencuentro de sitio. Lo que cambia es que **preguntar "¿son el mismo
closer?" deja de mirar las mayusculas**.

**2. Esa pregunta vive en UN modulo: `lib/closers/identidad.ts`** (ADR 0024).

| pregunta | funcion |
|---|---|
| ¿son el mismo closer? (en memoria) | `mismoCloser(a, b)` |
| ¿esta columna es este closer? (en SQL) | `igualCloser(columna, valor)` |
| clave para agrupar (en memoria) | `claveDeCloser(valor)` |
| clave para agrupar (en SQL) | `claveDeCloserSql(columna)` |

La forma canonica es minusculas, sin espacios en los bordes y con los internos colapsados:
`"  Juan  Jose "` y `"juan jose"` son la misma persona escrita por dos manos.

**3. La garantia de que no haya dos cuentas reclamando el mismo closer vive en la BASE.**

Indice unico parcial sobre la expresion normalizada (migracion `0015`), por la razon del ADR 0005:
una garantia que vive solo en el codigo se rompe el dia que alguien escribe por otro camino (el CLI
de emergencia, un script, una migracion). Parcial porque `closer_id` nulo es un estado valido y
frecuente —un gerente no tiene— y varios nulos no chocan.

**4. El comparativo agrupa por la clave normalizada en SQL, y muestra un representante.**

Las tres agregaciones (`calls`, `sales`, `abonos`) agrupan por `claveDeCloserSql(...)` y devuelven
`min(closer_id)` como etiqueta. **La identidad es la clave; la ortografia que se pinta es una de
las formas reales en que esta escrito.** Se prefirio esto a agrupar por el texto crudo y unir en
memoria: lo segundo funcionaba, pero dejaba un `groupBy(calls.closerId)` en el codigo, o sea el
footgun puesto para la proxima consulta que no tenga esa union.

**5. Un guardian recorre el codigo y falla si alguien vuelve a comparar en crudo.**

`tests/closer-identidad.test.ts`, mismo molde que el guardian de vigencia (ADR 0026) y el de slugs
(ticket 009). Caza cuatro formas: `eq()` sobre una columna de closer, `groupBy` por ella, y las dos
direcciones de una comparacion estricta de JavaScript. **Se probo mordiendo en los dos sentidos:**
que caza las cuatro formas malas, y —esto es lo que faltaba en guardianes anteriores— que **NO
marca la solucion**. La primera version marcaba `groupBy(claveDeCloserSql(calls.closerId))`, que es
exactamente lo que este ADR pide; un guardian que castiga el arreglo empuja a escribir la version
mala o a poner una excepcion por archivo, que es donde se esconde lo que no caza (ticket 028).

## La trampa que casi entra, y queda como aviso

La primera version de la normalizacion en SQL era:

```ts
sql`regexp_replace(btrim(lower(${columna})), '\\s+', ' ', 'g')`
```

Dentro de un template literal de JavaScript, `\s` **se cocina a `s`**. El regex que llegaba a
Postgres era `'s+'`: colapsaba las **eses**, no los espacios. `Jose` se habria normalizado a
`jo e`, y `Vanessa` a `vane a`. Peor: el indice unico y la consulta se escribieron en dos archivos
distintos y quedaron con escapes distintos, asi que **el indice habria protegido una cosa y la
consulta habria agrupado otra** — la divergencia exacta que el modulo existe para impedir.

Por eso la expresion usa la clase POSIX `'[[:space:]]+'`, que no lleva backslash y no tiene nada
que cocinar ni en TypeScript ni en SQL. Y por eso hay un test que **compara las dos
normalizaciones contra Postgres de verdad** en vez de leer los dos textos y darlos por iguales.

🎯 **Regla que queda: un regex dentro de una plantilla `sql` pasa por dos capas de escape.** Si
lleva backslash, escribe un caso de prueba que lo ejecute contra el motor.

## Consecuencias

- **A favor:** el error que origino esto deja de ser posible de detectar tarde; ahora lo detecta un
  indice al escribir y un guardian al compilar.
- **A favor:** el dia que entren las llamadas historicas de las hojas, `Andrea` de la hoja y
  `andrea` de la app cuentan como una sola persona sin que nadie tenga que acordarse.
- **En contra:** la comparacion normaliza del lado de la columna, asi que no usa indice. A la
  escala de este repo (miles de filas, ver AGENTS.md) es irrelevante; si dejara de serlo, el indice
  funcional se agrega en `lib/closers/identidad.ts` y en ningun otro lado.
- **En contra:** el comparativo puede mostrar `andrea` o `Andrea` segun cual gane el `min()`. Es
  una ortografia real de las que hay en la base, y la cifra a su lado ya es la correcta.
- **Lo que NO resuelve:** que alguien escriba `Andre` en vez de `Andrea`. Eso no es un problema de
  mayusculas sino de un identificador de texto libre, y sigue siendo el riesgo de fondo del ADR
  0011 y del ticket 031.
