# 0036 — El Envio guarda TODAS las columnas, y las promovidas no se repiten

**Fecha:** 2026-09-21 · **Estado:** aceptado (Mani, 20-sep cuarta ronda, opcion **A'**) ·
**Implementacion:** etapas 1 y 3 del plan v2 · **Aplica:** ADR 0012 ·
**Enmienda:** ADR 0019 (la plantilla de lead deja de ser de todos los campos)

## El problema

Hoy el sync lee una fila del formulario, mapea ~10 campos conocidos y **tira el resto a
`people.raw`** como bolsa sin forma. Tres cosas se rompen con eso:

1. **Se pierde el historial.** Una persona que aplica tres veces es **una** fila: la ultima gana y
   las dos anteriores no existen en ninguna parte. Medido en `production` el 21-sep: **1.146
   personas tienen mas de una aplicacion**, con **2.588 envios** entre ellas y **6.233 envios
   totales implicitos** en las hojas. Hoy el CRM guarda 4.791 filas donde hubo 6.233 hechos.
2. **Una columna nueva del formulario no aparece sola.** Cae en `raw`, donde nadie la ve, o exige
   tocar el mapeo. El insumo §1.5 lo pide al reves: *"el CRM recorre todas las columnas y las
   guarda; una columna nueva aparece sola"*.
3. **Los parciales no existen.** Typeform escribe una fila cuando alguien empieza el formulario y
   otra cuando lo termina, con el **mismo Token**. Hoy el Token ni siquiera se mapea, asi que "esta
   persona abandono el form" no es un dato del CRM.

## Decidimos

**1. El Envio (`submissions`) es una fila por cada vez que alguien lleno el formulario**, parcial o
completo. Es el **hecho**; el Lead es la persona que lo produjo. La llave es el **Token** de
Typeform (o el id del webhook cuando entre Dapta).

**2. ~10 campos promovidos a columna, TODO lo demas en `respuestas jsonb`, y las promovidas NO se
repiten adentro** (opcion **A'**, Mani 20-sep).

```
submissions (lead_id, source_id, token, es_parcial, fecha_envio, estado_hoja,
             utm_source, utm_medium, utm_campaign, utm_term, utm_content,
             posicion_en_hoja, respuestas jsonb)
```

Un campo se promueve **solo si el codigo decide, filtra, indexa o cruza con el**. Lo demas es
contenido: se guarda entero, con el texto del encabezado como llave, y se lee cuando alguien abre
la ficha.

La union de las dos piezas es la fila completa, **nada dos veces**. Esa fue la correccion de Mani
sobre la propuesta original (opcion A, que repetia los 10 valores dentro del `jsonb`): una copia
que nadie declara es una copia que se desincroniza, y este repo ya tiene un ADR entero sobre eso
(0024).

**3. Una columna nueva en la hoja entra sola y los envios viejos la tienen en `null`.** Se lee
hasta el ultimo encabezado no vacio; no hay rango fijo ni lista blanca.

**4. Parcial y completo se guardan los dos.** La completa manda para el `estado` del Lead; la
parcial es el evento *"inicio el formulario"*. El CRM **recalcula cuando llega la hermana**, no
decide una sola vez. (El script de hoy decide una vez cada 10 minutos y lo que llegue despues no
cambia nada.)

**5. `submissions` NO se rellena desde `people.raw`.** La construye el **primer sync v2** leyendo
la hoja. `raw` tiene una fila por persona (la ultima aplicacion), asi que un backfill desde ahi
produciria 4.791 envios donde hubo 6.233, y los 1.442 que faltan **no se verian como faltantes**:
se veria un historial completo y equivocado. La hoja es la fuente (ADR 0004) y tiene las 6.233.

## Por que `jsonb` y no las otras dos formas

| | **A' · promovidas + `jsonb` del resto** ✅ | A'' · solo `jsonb` con indices de expresion | B · EAV, una fila por respuesta |
|---|---|---|---|
| Redundancia | ninguna | ninguna | ninguna |
| Leer un envio | una fila | una fila | ~40 filas y un join |
| Llave `(programa, correo)` | columna normal | **no se puede**: un indice unico sobre `respuestas->>'correo'` no es la llave del Lead | join |
| Columna nueva | aparece sola | aparece sola | aparece sola |
| Costo | el patron que el repo ya usa en `people.raw` | consultas torpes en TODO el codigo | mas codigo y mas lento en cada pantalla |

Postgres indexa y consulta `jsonb`; no hace falta una base de documentos para esto. Lo que decide
el empate es la tercera fila: **la llave del ADR 0005 tiene que ser una columna**, y desde el
momento en que el correo es columna, tener las otras nueve tambien lo es coherencia, no gasto.

⚠️ **El matiz honesto:** las promovidas se guardan **normalizadas** (correo en minusculas, fecha
como `timestamptz`, telefono en digitos), asi que el texto exacto de la celda no queda en el CRM
para esos 10 campos. Se acepta: la hoja es la fuente y el sync recalcula desde ella (ADR 0004).

## Enmienda al ADR 0019

El ADR 0019 decidio una **plantilla de lead** en tres niveles (fuente → programa → codigo) y dijo:
*"Los campos son fijos en el codigo... la plantilla solo dice en que columna esta cada uno"*.

**Lo que se conserva:** el mecanismo de tres niveles, la resolucion por **texto del encabezado** y
no por posicion, y `MapeoInvalidoError` cuando falta un obligatorio.

**Lo que cambia:** la plantilla ya **no cubre todos los campos, solo los ~10 promovidos**. El resto
de las columnas deja de necesitar mapeo, porque deja de necesitar destino: entra al `jsonb` con su
encabezado. La frase *"toda columna que no mapea queda completa en `people.raw`"* se sustituye por
*"toda columna que no se promueve queda en `submissions.respuestas`, por envio y no por persona"*.

Es un ADR **mas chico**, no derogado: la parte que el 0019 resolvia bien (cada hoja tiene su
redaccion y no se estandarizan) sigue en pie.

## Consecuencias

- **A favor:** el historial del Lead existe. "Aplico en julio diciendo que ganaba X y en septiembre
  diciendo que gana Y" pasa a ser visible, y con `posicion_en_hoja` se puede ordenar aunque las
  fechas mientan.
- **A favor:** un cambio de redaccion del formulario deja de ser un incidente.
- **En contra:** `submissions` nace con ~6.233 filas y crece mas rapido que `leads`. A la escala de
  Retia (~3.000 filas por hoja) no es un problema; si el volumen se multiplica por diez hay que
  mirar el tamano del `jsonb`, que es donde vive el peso.
- **En contra:** una consulta sobre una respuesta NO promovida es mas torpe que sobre una columna.
  Es el precio de que la columna nueva entre sola. Cuando una respuesta empiece a decidir algo, se
  promueve **con su ADR**, que es lo mismo que dice el 0019.
- ⚠️ **El centinela sigue vigente.** `parsearFecha` tiene piso de plausibilidad (ano 2000) porque
  una hoja mandaba `1/1/0001` como "vacio". **Cada campo que se promueva responde la misma
  pregunta: ¿cual es el valor que esta fuente escribe cuando no sabe?** 🩸 Y aqui hay uno ya
  conocido: los parciales llevan esa fecha placeholder, por eso el orden de los envios se decide
  por `posicion_en_hoja` y no por `fecha_envio`.
