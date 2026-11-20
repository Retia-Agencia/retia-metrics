---
id: 457
etapa: comercial
serves: "Dani Rodríguez (Paid Media), audio del 11-nov: ver el embudo de los leads completo y su vida (formulario, origen, cita, compra) · decisiones D1 a D5 de Mani, 19-nov (nota `02 Projects/retia/embudo-total-del-lead-borrador.md` del vault)"
depends: []
status: en curso
---

# 457 — «¿Dónde se pierden?» muestra el embudo total: origen por área, primera barra partida y ventas sin llamada dentro del embudo (tanda 1)

> ⚠️ **Es una extensión del bloque que ya existe, no una pantalla nueva.** El bloque «¿Dónde se pierden?» de Comercial
> (`components/dashboard/operacion.tsx`, núcleo en `lib/queries/embudo-comercial.ts`) ya es el embudo por cohorte de deals
> creados en el periodo: 4 pasos anidados, % del paso anterior, lista por cifra. **Este ticket no crea ninguna métrica
> registrada, ningún universo ni ninguna pantalla.** Si al implementarlo aparece esa necesidad, se para y se pregunta a Mani.

## El pedido

Dani Rodríguez quiere ver el embudo de los leads completo, cortado por origen, para saber dónde se pierden (audio del 11-nov;
el 424 entregó solo una descarga por lista). Mani aprobó el 19-nov (D1 a D5): se extiende el bloque; el origen entra por área;
la primera barra se parte en completo, parcial y manual; las ventas sin llamada se ven dentro del embudo; las citas sin
marcar avisan en el paso show.

## Alcance de la tanda 1

1. **Primera barra partida.** `pasosDelEmbudoComercial` devuelve en el paso `creados` una `composicion` `{ completo, parcial, manual }`
   (conteos de los deals del mismo universo, ya clasificados por `DealParaEmbudoComercial.origen`). `EmbudoDeBarras` pinta esa barra
   en tres segmentos con los tonos de Tinta y una leyenda con los conteos. Los demás pasos no cambian.
2. **Corte por área.** Un parámetro de URL nuevo `area` (`paid` | `organico` | `referidos` | `sin_utm`; ausente = todas) que
   **se combina** con el `origen` actual (Todos / Formulario completo / Parcial). Una fila de chips «Área» junto a la de «Origen del
   deal», con el mismo patrón de enlaces. Filtra el embudo **y las listas de los cuatro pasos** (barra y lista dan la misma cifra).
   El área de un deal se obtiene con lo que ya existe (`dealsDelArea` en `lib/queries/metricas-filtros.ts`, `areaSql` en
   `lib/atribucion/canal-sql.ts`): **no se crea una segunda derivación del área** (ADR 0115 N1).
3. **Ventas sin llamada dentro del embudo.** La línea «N ventas sin llamada registrada» (hoy un párrafo debajo de las barras, con su
   `Celda` y su lista) pasa a ir pegada al paso «Compraron», dentro del bloque del embudo, como «+N sin llamada registrada». Misma
   cifra, misma lista, solo cambia dónde se ve. Con un `area` activo la línea no se muestra y una nota muda dice que esa cifra
   todavía no se corta por origen (no se inventa un número).
4. **Aviso ámbar en «Tuvieron show».** Debajo de ese paso, un aviso `Badge variant="alerta"` con el conteo de citas pasadas sin marcar
   que la pantalla ya calcula (`grupo.sinMarcar`, el mismo de «Cifras clave»): «N citas pasadas sin marcar: parte pudieron ser
   shows». Sin cifra nueva; si `sinMarcar` es 0 no se muestra.

## Fuera de este ticket, a propósito

- Repetir el bloque en la pestaña Pauta (requiere extraerlo a un componente): tanda 2.
- El paso «Terminaron de pagar», los cortes de calidad High y de «Lo trabajaron», el corte por campaña y anuncio, la tabla con la
  fecha de cada hito y el panel de traza: tandas 2 y 3.
- Cualquier métrica nueva en `lib/metricas/registro.ts`, ficha en `docs/metricas.md` o ADR nuevo.
- Cambiar el anidado de «Compraron» (sigue exigiendo show) o el filtro `origen` existente.

## Hecho

- `lib/queries/embudo-comercial.ts`: agregó la composición de creados y el corte combinado por área usando la derivación central existente.
- `lib/hub-programa/cargar-datos.ts` y `lib/queries/vista-metrica.ts`: propagaron `area` a barras, listas y enlaces conservando los demás parámetros.
- `components/dashboard/operacion.tsx` y `components/graficas/barras.tsx`: agregaron chips de área, barra partida, aviso de citas y ventas sin llamada junto a Compraron.
- `tests/embudo-comercial.test.ts`: cubrió composición, anidado por área y uso de la derivación central.
