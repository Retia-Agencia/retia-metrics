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

- `lib/queries/calor-escalera.ts` (puro, sin base): `intensidadesDeFila(fila)` devuelve 0 a 1 por celda, el porcentaje de la
  celda sobre los deals de SU fila. **Continuo: ni cortes ni mínimos escritos en el código** (Mani, 29-oct). La tarjeta del
  320 y, después, el 335 lo importan.
- **Se normaliza por fila**: sin eso, «Sin closer» (515 deals, 100 % en «Dejó datos») y la columna «Dejó datos» (91 % del
  total) se comen todo el color y no se puede comparar a Nicolás con Juan José.
- **«Sin closer» sale del calor** (`esSinDueno` en la fila): es un cubo de deals sin dueño, no una persona a comparar.
- La fila de total por escalón (arriba) conserva su forma: es una distribución, no una matriz.
- Un solo acento morado de Tinta (`color-mix` sobre `var(--primary)`, hasta 40 % en la celda del 100 %); texto en foreground.
- Leyenda corta bajo la tabla: qué significa el tono y que es por fila.
- `docs/metricas.md` §3.1: una línea sobre el tono (no cambia ninguna cifra).

## Done cuando

- Test de `intensidadesDeFila`: normaliza por fila, no depende del tamaño de la fila, sin dueño y nulo sin calor.
- Ninguna cifra cambia: `tests/escalera.test.ts` sigue en verde sin tocar sus esperados.
- Recorrido local con gerente y closer, escritorio y 375 px (la tabla ya scrollea horizontal), y la celda con tono
  sigue abriendo su lista.
- `npm run build` antes de empujar si el cambio toca un componente cliente.

## Avance (29-oct)

Hecho en la rama `calor-escalera-347`: `lib/queries/calor-escalera.ts`, `esSinDueno` en `FilaDeEscalera`, tonos en
`TablaPorDimension`, `tests/calor-escalera.test.ts`. Typecheck, lint y `tests/escalera.test.ts` en verde. Visto en pantalla (29-oct, `dev:local`, gerente, claro y oscuro): legible, el clic de la celda abre su lista y la leyenda solo nombra «Sin closer» si hay esa fila. No se probó a 375 px ni con closer (el closer no ve el Hub, ADR 0082).
