# 0026 — Anular un registro y borrar del catalogo desde la app

**Fecha:** 2026-09-18 · **Estado:** aceptado (Mani, tras el recorrido visual de `/mi-dia`)

## Contexto

Durante el recorrido visual del 18-sep se registro a proposito un abono con sobrepago para probar
la reja del ADR 0024. Funciono. Pero al querer deshacer la prueba aparecio que **no se puede**:

```
$ grep -rn '\.delete(' lib app scripts
(sin resultados)
```

No hay **ni un solo `.delete(`** en todo el codigo de la app, `calls` no tiene columna para
desactivar una fila, y `/personas/[id]` es de solo lectura por decision del ticket 006. Una llamada
mal registrada queda para siempre, y cuenta en el embudo para siempre.

Eso no es un problema de pruebas. Es un problema de operacion: **un closer que le da a "Cerrada"
por error inventa una venta que nadie puede quitar**, y esa venta entra en el conteo de ventas
cerradas, en la caja recaudada por su fecha de abono y en el comparativo entre closers. Hoy la
unica salida es que alguien entre a la base a mano, que es justo lo que este CRM existe para
evitar.

Mani lo pidio explicito el 18-sep: *"se debe poder anular un registro y borrar cosas desde la app"*.

El choque: el **ADR 0012** dice que toda entidad configurable **nunca se borra, se desactiva**. Esta
decision no lo deroga, lo acota.

## Decidimos

### 1. Un registro (llamada, venta, abono) se ANULA, no se borra

Las tres tablas suman `anulado_en timestamptz`, `anulado_por uuid` y `motivo_anulacion text`.

**No es un booleano** a proposito: cuando el dinero no cuadra, la pregunta no es "¿esto esta
anulado?" sino "¿quien lo anulo, cuando y por que?". Un booleano tira esa respuesta a la basura y
la deja solo en `change_log`, que es una bitacora de campos y no el lugar donde se consulta el
estado de una venta.

Borrar de verdad tampoco sirve: una venta borrada se lleva la explicacion de por que la caja de
ese dia bajo.

### 2. Anular arrastra lo que colgaba del registro, en la misma escritura atomica

- Anular una **venta** anula sus **abonos**. Un abono vivo bajo una venta anulada seguiria sumando
  a la caja recaudada, que se calcula desde `abonos` y no desde `sales` (ADR 0013).
- Anular una llamada **cerrada** anula su venta, y por lo anterior sus abonos. La venta nacio de
  esa llamada; dejarla viva seria afirmar una venta sin la llamada que la cerro.
- Anular un **abono** no toca la venta: una venta puede tener un abono devuelto y seguir viva. El
  saldo se recalcula solo, porque sale de `lib/queries/saldo.ts` (ADR 0024).

### 3. Lo anulado desaparece de TODA metrica, y eso se garantiza en un solo predicado

Este es el punto peligroso de la decision. Si una consulta del embudo se olvida de excluir lo
anulado, **dos pantallas muestran cifras distintas de lo mismo y nadie se entera**: es exactamente
el fallo que costo la primera version de `/nerd-stats` (conteos en cero sin lanzar error).

Por eso, y siguiendo el ADR 0024: **el predicado "esta vigente" vive en UN modulo**
(`lib/queries/vigente.ts`) y toda consulta sobre `calls`, `sales` o `abonos` lo importa. Ninguna
vuelve a escribir `isNull(anuladoEn)` a mano.

Y se **prueba, no se promete**: un test guardian recorre `lib/queries/*.ts` y falla si alguna
consulta lee esas tablas sin el predicado, igual que el guardian de slugs del ticket 009. La regla
la enforza un test, no la memoria de quien agregue la cuarta consulta.

### 4. Lo anulado SI se ve en el historial de la persona, tachado

`/personas/[id]` es la bitacora de lo que paso con alguien, y "aqui hubo una venta que se anulo el
19 de septiembre porque el pago se cayo" es informacion, no ruido. Esconderlo ahi convertiria la
anulacion en un borrado con otro nombre.

La regla es: **fuera de las metricas, dentro del historial.**

### 5. Del catalogo se BORRA de verdad solo lo que nunca se uso; lo demas se desactiva

Enmienda acotada al ADR 0012. La motivacion de aquel ADR sigue en pie: un motivo de perdida
referenciado por 300 llamadas no se puede borrar sin romper el historial, y sus FKs son `restrict`
justamente para impedirlo.

Pero el caso que Mani quiere resolver es otro: **un producto o una categoria creados por error hace
dos minutos, que nadie ha usado.** Desactivarlos los deja como basura permanente en una lista de
administracion.

Entonces:

- **Cero referencias** → se borra de verdad (`DELETE`), con confirmacion, y va a `change_log`.
- **Una o mas** → no se borra: se desactiva, y la app **dice cuantas referencias tiene y por que**.

Lo que NO puede pasar es que la app diga "borrado" y por dentro haya desactivado. Las dos acciones
existen y se nombran distinto.

### 6. Quien puede anular

- El **closer** anula lo que **el mismo registro** (`closer_id` igual al suyo) mientras la cohorte
  siga activa. Es el caso real: se equivoco y lo ve en el momento.
- El **gerente** anula cualquier registro, sin limite de cohorte.
- Toda anulacion exige `motivo_anulacion` no vacio. Sin motivo no hay anulacion: el motivo es la
  mitad del valor de conservar la fila.

## Consecuencias

- Migracion sobre `calls`, `sales` y `abonos` (ticket 029). Se prueba en `dev` antes de
  `production` (ADR 0018).
- **Toda consulta existente del dashboard, del embudo y de `/nerd-stats` cambia.** No es opcional
  ni se puede hacer por partes: una consulta sin el predicado da cifras infladas que parecen
  correctas.
- El ADR 0012 queda enmendado en su punto de "nunca se borra": ahora es *"no se borra lo que ya se
  uso"*.
- Un registro anulado sigue ocupando su lugar en el indice unico `calls_huella_idx`, asi que una
  fila de Sheets anulada NO se vuelve a importar en el proximo sync. Es lo correcto: anular es una
  decision del negocio y el sync no debe revertirla.

## Alternativas descartadas

**Borrar de verdad los registros.** Deja la caja de un dia distinta sin ninguna explicacion
rastreable, y con `origen = "app"` no habria forma de reconstruir que paso.

**Un booleano `anulado`.** Pierde quien y cuando, que es lo que se pregunta cuando el dinero no
cuadra.

**Editar el registro en vez de anularlo.** Reescribe la historia: el embudo del mes pasado
cambiaria despues de cerrado. Anular deja la huella; editar la borra.

**Filtrar lo anulado en cada consulta a mano.** Es lo que el ADR 0024 ya prohibio para el dinero
derivado, por la misma razon y con el mismo final.
