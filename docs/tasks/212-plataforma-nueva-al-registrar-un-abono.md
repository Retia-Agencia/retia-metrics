---
id: 212
etapa: corte
serves: "Mani, 9-oct (recorrido de Students tras el 208)"
depends: []
status: todo
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

- [ ] Registrar un abono con una plataforma nueva la crea, la vincula al programa y deja rastro.
- [ ] Cambiar la plataforma de un abono deja una fila en `change_log`.
- [ ] Tests de las dos escrituras y de la reja (un closer de otro programa recibe 403, forjando la acción).
- [ ] Recorrido: abrir el selector, crear, cambiar; consola limpia.
