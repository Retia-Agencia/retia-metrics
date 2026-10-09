---
id: 212
etapa: corte
serves: "Mani, 9-oct (recorrido de Students tras el 208)"
depends: []
status: review
---

# 212 — El closer crea la plataforma de pago al registrar el abono, y la corrige después

## Por qué existe

Al migrar C3 (208), un abono de ComunicArte decía "hotmart / mercadopago" y quedó sin plataforma porque no
existía en el catálogo. Mani: si la plataforma no existe, el closer tiene que poder crearla en el momento de
registrar el abono, sin ir a Ajustes. Y un abono que quedó sin plataforma (o con la equivocada) se tiene que
poder corregir.

## Alcance

1. En el diálogo de registrar abono, el selector de plataforma ofrece "Crear «<lo escrito>»" cuando no hay
   coincidencia. Usa `crearOVincularPlataforma` (`lib/catalogo/plataformas.ts`), que ya existe: crea la fila
   por el molde, con `change_log`, y la vincula al programa (ADR 0034); si existe con otras mayúsculas, la
   vincula en vez de duplicarla; si está desactivada, dice que la reactive un administrador.
2. En la ficha del deal, cambiar la plataforma de un abono vigente, con rastro (`editarConRastro` sobre
   `abonos`). Solo la plataforma: el monto y la fecha siguen corrigiéndose anulando (ADR 0026).
3. Quién: quien puede registrar el abono (`trabajaLeads` + `puedeTrabajarDeal`); el developer pasa (ADR 0025).

## Done cuando

- [x] Registrar un abono con una plataforma nueva la crea, la vincula al programa y deja rastro.
- [x] Cambiar la plataforma de un abono deja una fila en `change_log`.
- [x] Tests de las dos escrituras y de la reja (un closer de otro programa recibe 403, forjando la acción).
- [x] Recorrido: abrir el selector, crear, cambiar; consola limpia.

## Resultado (9-oct, en revisión)

- **Por qué ComunicArte "no tenía plataformas":** el importador (`lib/migracion/importar.ts`) buscaba la
  plataforma por nombre en TODO el catálogo y la escribía en el abono, pero nunca creaba el vínculo
  `plataformas_programa`; el selector solo muestra las vinculadas (ADR 0034). Al 9-oct en producción: CA tiene abonos
  con MercadoPago (9), Hotmart (3) y Hotmart / Mercadopago (1) y solo la última vinculada; TI tiene MercadoPago (8) y
  Bancolombia (1) y ninguna vinculada. Arreglado hacia adelante: `OpcionesImportacion` recibe `actor` (con rol) y
  el importador llama `asociarPrograma` por cada plataforma que usa. Los vínculos que faltan en producción se cargan
  con `asociarPrograma`, con el ok de Mani.
- Diálogo de abono: buscar o crear (`crearPlataformaParaAbonoAccion` → `crearOVincularPlataforma`). "Cambiar
  plataforma" por abono vigente (`cambiarPlataformaDeAbono`, `editarConRastro`, solo `plataformaId`); si la actual
  no está vinculada, el control la muestra igual.
- Recorrido local: crear, vincular y cambiar dejan tres filas en `change_log`; consola limpia. Las dos acciones
  forjadas como una closer del programa que no es dueña: error de permiso y la base sin moverse.
