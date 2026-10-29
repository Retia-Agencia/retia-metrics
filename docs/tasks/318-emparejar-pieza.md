---
id: 318
etapa: media
serves: "ADR 0108 puntos 4 y 5 · propuesta.md §3.6 punto 7 (avisar UTM de contenido sin pieza)"
depends: [317]
status: done
---

# 318 — El emparejador reconoce la pieza

## Alcance

- `emparejar` (`lib/atribucion/emparejar.ts`) recibe las piezas como dato (como el árbol de Meta) y, solo con
  `utm_medium=contenido`, resuelve `utm_content` → pieza. Código desconocido, anulado o de otro programa: aviso
  `pieza_desconocida`, nunca asignación.
- La pieza se deriva al leer; no se escribe en el envío ni en el lead.
- Hub › Origen: los envíos con `pieza_desconocida` se cuentan aparte, con su lista (contrato ADR 0067).

## Done cuando

- `tests/atribucion-emparejador.test.ts`: la pieza en los dos sentidos, el mismo resultado con las piezas en otro
  orden, y el test que importa: **el emparejador reconoce la pieza del link que el generador del 317 acaba de producir**.
- El guardián de `utm_content` sigue sin excepciones nuevas fuera de `lib/atribucion/`.
