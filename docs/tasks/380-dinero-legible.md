---
id: 380
etapa: hub
serves: "Recorrido de Mani por Hub › Dinero (4-nov) · ADR 0115 (N3, N4, N5) · ADR 0067 (toda cifra abre su lista) · ADR 0091 (contrato de gráficas) · ADR 0077 · docs/structure.md §9 (Tinta)"
depends: [369, 370, 371]
status: en main
---

# 380 — Hub › Dinero legible: menos cifras, gráficas lado a lado que abren su lista, y "¿Vamos a llegar?" en una frase

## Por qué

Mani, 4-nov, en Hub › Dinero (ComunicArte local):

1. Satura: cuatro tarjetas, una tabla que repite la tarjeta, párrafos que explican convenciones ("tramo en curso",
   "no lo leas como una caída", "Cupos es el número de ventas (deals en Abonado o Completo)").
2. Cada gráfica trae sus tres interruptores (unidad, paso, forma): seis grupos de botones para dos gráficas. Cupos o
   plata no debe ser una elección: el hover muestra las dos, siempre.
3. Las cifras abren su resumen (`CifraConLista`); los puntos de una gráfica no. Un punto es una cifra (ADR 0067).
4. "¿Vamos a llegar?" es una matriz de ocho números por fila (Faltan, Esperado a hoy, Por día hábil, Proyección) con
   decimales en cupos ("8 de 7,63"). Nadie la lee. El lenguaje del CRM tiene que entenderse.

## Decisiones (Mani, 4-nov)

- **D1. Tarjetas:** quedan **Vendido · Recaudado · Por cobrar** y **Entró a caja**. Entró a caja lleva UNA línea que
  la distinga de Recaudado ("Todo abono que entró en el periodo, aunque sea de ventas anteriores"). **Comisión sale**
  de Dinero (ya vive por closer en Comercial, `components/dashboard/operacion.tsx`). **Descuento promedio sale.**
  La tabla **Ventas por cohorte** solo se pinta cuando el filtro es "todas las cohortes" (con una cohorte repite la
  tarjeta).
- **D2. Gráficas:** dos, **lado a lado** desde `lg` (una columna en celular): izquierda **Cupos vendidos**, derecha
  **Cupos con caja** (primer abono del deal). Las dos dibujan **cupos**. **Un solo** set de interruptores para las
  dos: **paso** (día, semana, mes) y **forma** (por paso, acumulado). El interruptor de **unidad desaparece**. El
  tooltip de cada punto muestra siempre las dos medidas: en ventas, cupos y Vendido en USD; en caja, cupos con caja y
  lo que entró por moneda (sin convertir, cada moneda en su línea). Con comparación, lo mismo para la serie B.
- **D3. Clic en un punto abre el mismo resumen que una cifra:** el diálogo de `CifraConLista` (cantidad, las tres
  cifras de dinero en ventas, desgloses) y su enlace "Ver registros" a la lista paginada. El resumen se pide al
  hacer clic (no se precalcula uno por punto). Sin equipo comercial (`veEquipo` falso), el punto no abre nada.
- **D4. "¿Vamos a llegar?"** por fila (mes y cohorte): una **barra de avance** con una marca de "dónde deberíamos ir
  hoy" (el esperado a hoy) y **una frase**: "Llevas 12 de 30 cupos. Vas 12 atrás. Necesitas 1,4 ventas por día hábil
  hasta el 20-nov." (o "Vas 2 adelante.", o "Ya llegaste."). **Cupos sin decimales** en lo que se lee (la meta
  prorrateada del mes se redondea al mostrar; el cálculo no cambia). USD y proyección van en un "Ver detalle"
  plegado. Sin meta: "Sin meta" + Configurar (como hoy). Sigue sin leer los filtros (ADR 0023, molde del 371).

## Alcance

1. **Tarjetas** (`components/dashboard/dinero.tsx`, `components/dashboard/dinero-de-ventas.tsx`): aplicar D1. Quitar
   lo que quede huérfano (props, imports) y nada más; `vista.comision` y `vista.descuento` siguen calculándose si otra
   pantalla los usa (verificar con grep antes de tocar `lib/`).
2. **Gráficas** (`components/dashboard/graficas-de-dinero.tsx`, `components/graficas/`, `lib/series-pasos.ts`):
   - Una clave de URL compartida (por ejemplo `?g_dinero=semana,acum`); la unidad ya no se lee ni se escribe. Un
     enlace viejo con `g_ventas=plata,...` no rompe: se ignora lo que no sirve (la regla actual de `series-pasos`).
   - El contrato de gráficas (`components/graficas/contrato.ts`) gana un **dato extra por punto** para el tooltip
     (por ejemplo `extras: Array<Array<{ etiqueta, texto }>>` por serie), escrito por `lib/format.ts`. El tooltip
     sigue siendo corto: día, valor, extras, y el cambio contra la comparación si la hay. Ninguna pantalla importa
     `echarts` directo (guardián `tests/graficas-guardian.test.ts`).
   - `components/graficas/interruptores.tsx` lo usa también `components/deals-contra-agendas.tsx`: no romperlo
     (que la unidad sea opcional).
   - Textos: fuera el párrafo "Del … al …, con los mismos filtros… no lo leas como una caída" y las notas de pie de
     cada gráfica. Lo que de verdad hace falta saber (tramo en curso, contribución de un closer, cupos sin valor
     vendido) va en UNA línea corta bajo el título o en el tooltip del último punto.
3. **Clic en un punto** (D3): `Grafica` acepta, por punto, la **entrada** del resumen en vez de (o además de) la URL.
   Un clic llama a una **server action** que valida con zod, pasa por la guarda de rol y el alcance del programa
   (`lib/auth/alcance.ts`, `veEquipoComercial`), y devuelve `detalleDeCifra(metrica, entrada)` de
   `lib/queries/vista-metrica.ts` (la MISMA función que usan las cifras: nada de una consulta nueva). El diálogo
   reutiliza la vista del diálogo de `CifraConLista` (extraer su contenido a un componente si hace falta, sin
   duplicarlo). La tabla "Ver cifras" plegada sigue teniendo sus enlaces (accesibilidad: el clic en el lienzo no es
   la única puerta).
4. **"¿Vamos a llegar?"** (`components/metas/vamos-a-llegar.tsx`; `lib/queries/vamos-a-llegar.ts` solo si falta un
   dato, por ejemplo la fecha de cierre para la frase): aplicar D4. La barra con tokens de Tinta (`docs/structure.md`
   §9: ningún color, sombra ni radio a mano; el tono por `Badge variant` o los tokens `tono-*`). La frase la arma una
   función pura con test (`fraseDeAvance` o similar): atrás, adelante, al día, ya llegó, sin meta, sin cierre.
   Este componente también se pinta dentro de Hub › Hoy (`components/dashboard/reporte-diario.tsx`); el ticket 378
   rediseña Hoy en paralelo pero no toca este archivo: no cambiar la interfaz de props.
5. **Vocabulario** (N4, N5): todo texto nuevo sale de `lib/vocabulario-metricas.ts` cuando es nombre de métrica.
   Ningún texto visible con "tramo", "periodo A/B", "macro", ids ni `utm_*`. Si una palabra nueva entra al
   vocabulario, `docs/overview.md` §11 en el mismo commit; si cambia qué muestra una métrica, `docs/metricas.md`.

## Fuera de alcance

Cambiar fórmulas (vendido, recaudado, caja, proyección, esperado). Hub › Hoy (es el 378). Otras pestañas.

## Done cuando

- [x] Dinero muestra dos tarjetas (Vendido·Recaudado·Por cobrar y Entró a caja); la tabla por cohorte solo con
      "todas las cohortes".
- [x] Dos gráficas lado a lado con un solo set de paso y forma en la URL; sin interruptor de unidad; el tooltip
      muestra cupos y plata (por moneda en caja). Tests del contrato (`tests/graficas-contrato.test.ts`) y de
      `tests/series-pasos.test.ts` actualizados.
- [x] Clic en un punto abre el resumen de ese tramo y su cantidad cuadra con la tabla "Ver cifras" del mismo punto;
      test de la server action: sin `veEquipoComercial` o con un programa ajeno, rechaza sin devolver filas.
- [x] "¿Vamos a llegar?" en frase + barra, cupos sin decimales; test de la función de la frase en sus seis casos;
      `tests/vamos-a-llegar.test.ts` en verde.
- [x] `npm run typecheck`, `npm run lint`, los tests del cambio y `npm run build` limpios.
- [x] Recorrido en `dev:local`: Dinero en escritorio y celular, hover y clic en puntos de las dos gráficas, cambiar
      paso y forma, con y sin "Comparar con", consola limpia; Hoy sigue pintando "¿Vamos a llegar?".
