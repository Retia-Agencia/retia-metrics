---
id: 030
fase: F0
serves: "ADR 0026 punto 5 (enmienda acotada al ADR 0012)"
depends: [011]
status: todo
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

- [ ] Un producto recien creado y sin ventas se borra y desaparece de la tabla.
- [ ] Un producto con al menos una venta NO se borra: se desactiva y la pantalla dice cuantas
      ventas lo referencian.
- [ ] Un `DELETE` que igual choque contra una FK `restrict` (carrera: alguien lo uso entre el
      conteo y el borrado) sale como un 400 legible, no como un 500.
- [ ] La confirmacion es explicita y el verbo del boton coincide con lo que va a pasar.
- [ ] El borrado queda en `change_log`.
- [ ] Los tests del molde que hoy exigen "nunca `DELETE`" se ajustan a la regla nueva **sin
      aflojarla**: siguen exigiendo que no haya `DELETE` cuando hay referencias.

## Notas

`tests/catalogo.test.ts` afirma hoy que el molde nunca borra. Ese test **no se elimina**: se
convierte en el que prueba la regla nueva. Aflojarlo a "ya no aplica" seria perder la garantia que
protege el historial.
