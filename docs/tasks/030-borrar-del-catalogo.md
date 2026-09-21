---
id: 030
fase: F0
serves: "ADR 0026 punto 5 (enmienda acotada al ADR 0012)"
depends: [011]
status: done
---

# 030 — Borrar del catalogo lo que nunca se uso

## Objetivo
Un producto, categoria, motivo, origen, plataforma o recurso creado por error, que **nadie ha
usado todavia**, se borra de verdad desde la app. Lo que ya se uso se desactiva, y la app explica
por que.

## Por que
El ADR 0012 dice "nunca se borra, se desactiva", y su motivo sigue siendo bueno: un motivo de
perdida referenciado por 300 llamadas no se puede borrar sin romper el historial, y por eso sus
FKs son `restrict`.

Pero eso deja sin salida el caso corriente: **escribir mal el nombre de un producto y darle a
guardar.** Hoy esa fila queda desactivada para siempre, ensuciando una lista de administracion,
sin haber participado nunca en una metrica. Mani lo pidio el 18-sep.

Decision en el **ADR 0026 punto 5**.

## Alcance

- Dentro: `lib/catalogo/molde.ts` gana `borrarSiNoSeUso`, que **cuenta referencias primero** y
  decide: cero → `DELETE` de verdad; una o mas → no borra y devuelve el conteo para que la
  pantalla lo explique.
- Dentro: el conteo de referencias por tabla se declara **junto a cada catalogo**, no en el molde:
  el molde no puede saber quien apunta a que sin volverse un registro de FKs escrito a mano y
  desactualizado. Cada catalogo declara sus tablas dependientes.
- Dentro: la UI pide **confirmacion explicita** antes de un borrado real (es la unica operacion
  irreversible de la app) y usa dos verbos distintos: "Borrar" cuando borra, "Desactivar" cuando
  desactiva. Nunca decir "borrado" habiendo desactivado (ADR 0026).
- Dentro: `change_log` del borrado, con la etiqueta de la fila. Es la unica huella que queda.
- Dentro: mismo permiso que ya tiene editar cada catalogo (productos los tocan los dos roles,
  ADR 0016; el resto es de administracion).
- Fuera: anular registros (es el 029).
- Fuera: borrar programas o cohortes. Un programa con personas sincronizadas nunca tiene cero
  referencias, y uno sin ellas es tan raro que no justifica el camino.
- Fuera: borrar usuarios. Se desactivan, y la salvaguarda del ultimo administrador (015) depende
  de que la fila siga existiendo.

## Done cuando

- [x] Un producto recien creado y sin ventas se borra y desaparece de la tabla.
- [x] Un producto con al menos una venta NO se borra: se desactiva y la pantalla dice cuantas
      ventas lo referencian.
- [x] Un `DELETE` que igual choque contra una FK `restrict` (carrera: alguien lo uso entre el
      conteo y el borrado) sale como un 400 legible, no como un 500.
- [x] La confirmacion es explicita y el verbo del boton coincide con lo que va a pasar.
- [x] El borrado queda en `change_log`.
- [x] Los tests del molde que hoy exigen "nunca `DELETE`" se ajustan a la regla nueva **sin
      aflojarla**: siguen exigiendo que no haya `DELETE` cuando hay referencias.
- [x] **Criterio agregado el 20-sep, porque faltaba y por eso el ticket parecia cerrado:** los
      SEIS catalogos del objetivo se borran desde la app, no solo productos.

## ✅ Cerrado el 20-sep (segunda sesion)

La UI que faltaba ya esta: los cuatro catalogos de `/ajustes/catalogos` (plataformas, motivos,
origenes y categorias de recurso) borran por `borrarItemSiNoSeUso` en `lib/catalogo/operaciones.ts`
+ `borrarAccion`, y los recursos por `borrarRecursoAccion` en `/recursos`. Con productos, que ya
estaba, son los SEIS del objetivo.

🩸 **Y el backend NO estaba tan probado como decia esta misma ficha.** `borrarRecursoSiNoSeUso`
existia en `lib/catalogo/recursos.ts` desde el 20-sep y **no la llamaba ni la probaba nadie**: cero
tests. La frase "el backend esta completo y probado para los seis" era cierta para el molde y falsa
para recursos, y nadie lo habria notado porque una funcion que nadie llama no falla nunca.
**Un `grep` de los llamadores cuesta un comando y responde lo que una ficha no.**

Los 8 tests nuevos (`tests/acciones-catalogos.test.ts`, `tests/acciones-recursos.test.ts`) se
mordieron quitando el arreglo: sin el dependiente declarado, la plataforma con un enlace de pago
**se borraba**; sin `exigirAccesoAlRecurso`, un closer borraba un recurso de un programa ajeno.

**Falta el recorrido visual** (cargar una pantalla no es probarla): hacer clic en Borrar en las
cuatro pestañas y en un recurso, con y sin referencias.

## ⚠️ Por que estuvo `en curso` (revision del 20-sep)

El backend esta **completo y probado para los seis**: `borrarSiNoSeUso` vive en el molde, los seis
catalogos declaran sus dependientes, y la carrera contra la FK sale como 400.

Lo que falta es **la UI de borrado en cinco de los seis**. Solo productos tiene el boton. Los otros
cinco (motivos, origenes, plataformas, categorias de recurso y recursos) viven en
`/ajustes/catalogos`, y esta sesion le **prohibio explicitamente** a quien implemento tocar esa
pantalla, porque estaba en medio del rediseno de plataformas (enmienda del 013). **Fue una
decision de esta sesion, no un descuido de quien implemento**, y quedo declarada en su reporte.

🎯 **El ticket se marco `done` con sus seis casillas en `[x]`, y las seis eran CIERTAS.** El
problema estaba en los criterios, no en el trabajo: los seis hablan de *un producto*, cuando el
**Objetivo** del ticket dice *"un producto, categoria, motivo, origen, plataforma o recurso"*.
Unos criterios mas estrechos que el objetivo dejan pasar un ticket a medias **sin que nadie mienta
en ningun paso**. Por eso se agrego el criterio de arriba en vez de solo destildar casillas.

**Se cierra junto con la enmienda del ticket 013**, que es la que abre `/ajustes/catalogos`.

## Notas

`tests/catalogo.test.ts` afirma hoy que el molde nunca borra. Ese test **no se elimina**: se
convierte en el que prueba la regla nueva. Aflojarlo a "ya no aplica" seria perder la garantia que
protege el historial.
