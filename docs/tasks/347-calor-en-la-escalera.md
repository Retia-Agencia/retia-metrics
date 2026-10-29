---
id: 347
etapa: media
serves: "propuesta.md §3.1 y §3.6 · lectura visual de la escalera (Mani, 29-oct) · prepara el 335"
depends: [320]
status: done
---

# 347 — Calor en las ventas por escalón

## Por qué

La tarjeta «Ventas por escalón» (320) entregó una tabla plana y lo dijo ("sin gráfica"). Las filas por closer y por
calidad ya son una matriz (filas × escalones), pero hay que leer cada número para ver dónde se concentra cada closer.
El deck de media muestra esa lectura como mapa de calor (slide `matriz`, origen × escalón). Este ticket la lleva a lo
que ya existe; el 335 (origen × escalón) reutiliza la misma pieza cuando haya piezas con link.

## Decisión de diseño (a confirmar en la revisión)

**Celdas con tono, no una gráfica ECharts.** Razones: (1) cada celda ya es una `CifraConLista` que abre su lista
(ADR 0067), y un heatmap de ECharts obligaría a reconstruir ese clic y la tabla alternativa; (2) `components/graficas/`
hoy solo tiene línea y barra (`contrato.ts`), así que un heatmap sería extender el contrato por una sola vista;
(3) la tabla sigue accesible y se imprime. Una tabla con fondo no es una gráfica dibujada a mano: el guardián del ADR 0091
no aplica, pero el color sí sale de Tinta. Si en la revisión se prefiere ECharts, se enmienda este ticket y se extiende
`crearOpcionGrafica` con `heatmap`.

## Alcance

- `lib/queries/` (puro, sin base): `tonoDeCalor(celdas, modo)` devuelve un tono discreto (0 a 3: casi nada, bajo, medio,
  alto) por celda. Vive en un módulo y lo importan la tarjeta del 320 y, después, el 335; nadie repite el corte.
- **Se normaliza por fila**: el porcentaje del closer (o de la calidad) sobre sus propios deals, no sobre toda la tabla.
  Sin eso, «Sin closer» (515 deals, 100 % en «Dejó datos») y la columna «Dejó datos y sin cita ocurrida» (91 % del
  total) se comen todo el color y no se puede comparar a Nicolás con Juan José.
- **Filas con pocos deals no se pintan** (`MINIMO_DE_DEALS_PARA_CALOR` = 10, constante de presentación con `ponytail:`;
  si gerencia la quiere editable pasa a una columna de Programa): 4 deals al 100 % se verían igual de «caliente» que 515.
  Se muestra el número sin tono y la leyenda lo dice.
- **«Sin closer» sale del calor**: es un cubo de deals sin dueño, no una persona a comparar; va aparte, sin tono.
- La fila de total por escalón (arriba) conserva su forma: es una distribución, no una matriz.
- Un solo acento morado de Tinta con cuatro pasos de lightness (diferenciables sin depender del tono, `docs/structure.md`
  §9); si Tinta no tiene la escala, se agrega ahí primero. Texto con contraste 4.5:1 sobre cada paso.
- Leyenda corta bajo la tabla: qué significa el tono y que es por fila.
- `docs/metricas.md` §3.1: una línea sobre el tono (no cambia ninguna cifra).

## Done cuando

- Test de `tonoDeCalor`: normaliza por fila, fila con pocos deals sin tono, cero deals sin tono, mismos pasos con el
  mismo orden de entrada en otro orden.
- Ninguna cifra cambia: `tests/escalera.test.ts` sigue en verde sin tocar sus esperados.
- Recorrido local con gerente y closer, escritorio y 375 px (la tabla ya scrollea horizontal), y la celda con tono
  sigue abriendo su lista.
- `npm run build` antes de empujar si el cambio toca un componente cliente.

## Avance (29-oct)

Hecho en la rama `calor-escalera-347`: `lib/queries/calor-escalera.ts`, `esSinDueno` en `FilaDeEscalera`, tonos en
`TablaPorDimension`, `tests/calor-escalera.test.ts`. Typecheck, lint y `tests/escalera.test.ts` en verde. **Falta:** verlo en
pantalla (contraste de `bg-primary/40` en claro y oscuro, clic de la celda) y que la leyenda de «Por calidad» no nombre
«Sin closer».
