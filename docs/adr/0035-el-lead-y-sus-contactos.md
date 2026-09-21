# 0035 — El Lead y sus contactos: `people` pasa a `leads`, y un telefono une pero marca

**Fecha:** 2026-09-21 · **Estado:** aceptado (Mani, 21-sep; decision **D1** del plan v2) ·
**Implementacion:** etapa 1 del plan v2 · **Aplica:** ADR 0005, ADR 0012, ADR 0032 ·
**Toca:** ADR 0011, ADR 0021 (el responsable sale de la tabla; su destino lo decide el ADR 0037)

## El problema

Dos problemas distintos que se resuelven en la misma tabla, y por eso viven en el mismo ADR.

**El nombre.** La tabla se llama `people` desde agosto. El vocabulario del negocio, del diseno
consolidado (insumo §2.1) y del glosario es **Lead**: una persona **dentro de un programa** que
puede convertirse en una oportunidad. `people` no dice ninguna de las dos cosas, y el modelo nuevo
mete al lado `leads_contactos`, `submissions` y `deals`, que si hablan ese idioma. Una tabla con el
nombre de la epoca anterior rodeada de cinco con el de la nueva es como se ve una migracion a
medias tres meses despues.

**La identidad.** Hoy una persona tiene UN correo y UN telefono: los de la fila del formulario. Las
hojas dicen que eso no alcanza. 🩸 **37 telefonos de Tactical Investor tienen mas de un correo**, y
parte de ellos son personas distintas compartiendo numero (pareja, socio, el celular de la casa).
El script que existe hoy **fusiona por telefono a ciegas**: ese es el bug silencioso que no lanza
ningun error y mezcla dos personas en una.

## Por que AHORA, medido

El rename toca ~39 archivos y **no agrega una sola funcion**. En cualquier otro momento eso es
exactamente el trabajo que este repo no hace (cambios quirurgicos, AGENTS.md). Lo que lo justifica
hoy es un dato, no un gusto, medido contra `production` el 21-sep:

```
people      4.791        calls        0
sources        10        sales        0
productos       2        abonos       0
```

**`calls`, `sales` y `abonos` estan en CERO: ningun closer ha usado el CRM nunca.** Y la capa de
lectura se va a reescribir completa igual (plan v2 §4.2). Renombrar cuesta un `sed` revisado y una
migracion; con 300 llamadas registradas encima, el mismo cambio es un *strangler* de semanas y
termina no haciendose. **Esta es la ventana mas barata que va a existir**, y las ventanas baratas
no se anuncian dos veces.

## Decidimos

**1. `people` pasa a llamarse `leads`.** Tabla, tipos, variables, rutas internas y glosario. El
nombre del dominio es el mismo en la base y en la conversacion del equipo.

**2. La llave sigue siendo `(program_id, correo_principal)`, unica en la base.** El **ADR 0005
queda intacto**: la garantia del dedup vive en un indice, no en el codigo. La misma persona en dos
programas son **dos Leads y no se deduplican entre si** (insumo §2.2): los programas son
independientes, y cruzarlos crearia una entidad "persona global" que nadie pidio y que ensuciaria
las tasas de cada programa con el historial del otro.

**3. Un Lead puede tener varios correos y telefonos: tabla `lead_contactos`.**

```
lead_contactos (lead_id, tipo correo|telefono, valor, submission_id, es_principal, confirmado)
                unico (program_id, tipo, valor)
```

Cada contacto sabe **de que envio llego**, asi que "¿desde cuando tenemos este numero?" es una
consulta y no una arqueologia sobre `raw`. El unico sobre `(program_id, tipo, valor)` es lo que
hace que la busqueda por telefono tenga una sola respuesta.

**4. El correo manda. El telefono UNE Y MARCA; nunca fusiona a ciegas.**

Un envio con el mismo correo es el mismo Lead, sin preguntar. Un envio con **telefono igual y
correo distinto** se suma al Lead existente **marcado como "unido por telefono"**, con aviso en la
tarjeta del deal. Un gerente resuelve la marca de una de dos formas:

- **separar**: el envio vuelve a ser un Lead propio con su historial;
- **dejar unido**: la marca se quita y queda registrado **quien lo confirmo**.

Mientras la marca este puesta, los deals del Lead funcionan normal. La marca es un aviso, no una
reja: bloquear al closer por una sospecha de duplicado le cuesta una venta real hoy para evitar una
cifra torcida manana.

🎯 **Por que no fusionar y ya.** Porque fusionar dos personas **no se puede deshacer mirando los
datos**: una vez que los dos historiales estan en la misma fila, nadie sabe cual envio era de
quien. El error de no fusionar es visible (dos tarjetas parecidas, alguien lo nota); el error de
fusionar es invisible y permanente. Cuando el costo de los dos errores es asimetrico, se elige el
reversible. Es la misma regla del ADR 0027 con la anulacion en cascada.

**5. `estado` pasa de `pgEnum` a texto.** No es decision nueva: es el **ADR 0032**, que ya lo
decidio el 19-sep y nunca se aplico. Lo unico que cambia es **cuando**: entra en el corte de la
etapa 1 en vez de tener migracion propia, porque la tabla se esta tocando igual. Medido el 21-sep:
las **4.791 de 4.791** personas estan en el default `cola_setteo`, o sea el enum **no carga un solo
bit de informacion** y su migracion no tiene nada que preservar.

**6. `responsable_closer_id` sale de `leads`.** Medido: **0 personas** lo tienen puesto. Su destino
—el owner del deal— lo decide el **ADR 0037**; aqui solo se registra que deja de ser un campo de la
persona, y por que se puede quitar sin ceremonia: nunca guardo un dato.

## Consecuencias

- **A favor:** el nombre de la tabla, el del glosario y el que usa el equipo vuelven a ser el
  mismo. Un agente nuevo no tiene que aprender dos vocabularios.
- **A favor:** "este telefono ya lo tenemos" pasa a ser una pregunta contestable, y la respuesta es
  una fila con su envio de origen.
- **En contra:** el rename toca ~39 archivos de un golpe y el diff es enorme. Se hace **en su
  propia rama**, con `npm test`, `typecheck` y `lint` limpios antes de fusionar, y no se mezcla con
  cambios de logica: un diff de 39 archivos donde ademas hay una decision escondida no lo revisa
  nadie de verdad.
- **En contra:** `lead_contactos` duplica el correo principal (esta en `leads` y en la tabla).
  Es una **redundancia declarada** y la escribe solo el sistema: la columna existe porque la llave
  unica del ADR 0005 la necesita como columna, no como fila.
- **Abierto:** que hace la app con un Lead marcado que nadie resuelve nunca. Hoy: nada, se queda
  marcado. Si la lista de "posibles duplicados" crece sin que nadie la mire, es senal de que falta
  un recordatorio, no una regla nueva.

## Alternativas descartadas

**No renombrar, o renombrar despues.** "Despues" es el nombre que se le da a nunca cuando el costo
sube con el tiempo. La medicion de arriba dice que el costo sube desde el primer registro que
escriba un closer.

**Fusionar por telefono automaticamente.** Es lo que hace el script de hoy y es la razon por la que
este ADR existe. Los 37 casos medidos garantizan que se equivocaria en produccion.

**Una entidad "persona" global por encima de los Leads.** Resolveria "la misma persona en dos
programas", que **nadie pidio resolver** (insumo §1.7: cada programa es independiente). Es
abstraccion especulativa (ADR 0006) y ademas obliga a decidir que pasa cuando los dos programas
discrepan en el nombre.
