# 0091: Las gráficas del CRM son ECharts, siempre a través de una pieza propia

- **Estado:** aceptado, 14-oct-2026 (Mani, ticket 255, viendo el prototipo de las tres candidatas). Se construye en el
  256.
- **Confirma:** ADR 0006 (un paquete no entra antes del código que lo usa: ECharts se instala con el 256, no antes),
  ADR 0067 (número y % en cada comparación, la cifra abre su lista), `structure.md` §9 (Tinta: ningún color a mano).

## Contexto

Las gráficas del Hub se dibujan a mano en SVG (`components/series-lineales.tsx`) y Mani las juzga pésimas. El Hub
(ADR 0086) quiere que la data del CRM sea lo más visual posible para que se digiera sin leer tablas: embudos,
comparaciones, distribución por día y hora, flujo de leads entre etapas. El 255 construyó la misma gráfica real
(agendas acumuladas por día hábil, este mes contra el anterior, con meta y clic a la lista) en Recharts, ECharts y
visx, en una rama desechable (`t255-prototipo`, commit `f28ba57`, borrada después de decidir).

Mani descartó visx (hay que dibujar ejes y tooltips a mano, que es lo que se quería dejar) y pidió, entre Recharts
y ECharts, **la que tenga más capacidades, sea fácil de mantener y dé flexibilidad para crear lo necesario**.

| Criterio | Recharts 3.10.1 | ECharts 6.1.0 |
|---|---|---|
| Tipos de gráfica | 12 (línea, barra, área, compuesta, torta, radar, radial, dispersión, embudo, treemap, sankey, sunburst) | 23 series (las de Recharts más heatmap, gauge, grafo, árbol, boxplot, velas, river, paralelas, `custom` para lo que no exista) y el calendario como eje |
| Interacción incluida | tooltip, brush | tooltip, `dataZoom` (zoom y rango), `brush`, `visualMap` (color por valor), leyenda que filtra, `markLine`/`markArea` |
| Cómo se construye | componentes JSX anidados | un objeto de opciones (datos, no componentes) |
| Peso gzip, solo lo usado | 107 KB | 187 KB registrando solo lo que se usa (377 KB completo) |
| Dibuja en | SVG | canvas o SVG (se elige al iniciar) |
| Colores de Tinta | lee las variables CSS directo | hay que resolverlas con `getComputedStyle` y volver a pintar al cambiar el tema |
| Teclado | cada punto puede ser un enlace enfocable | no por punto; el módulo `aria` describe la gráfica para lectores de pantalla |
| Mantenimiento | MIT, ~27.600 estrellas, publicó el 13-oct-2026 | Apache 2.0 (fundación Apache), ~67.500 estrellas, commits el 13-oct-2026; 6.1.0 es de mayo |
| Envoltorio de React | no hace falta | `echarts-for-react` (MIT, último push enero 2026) o uno propio |

El tiempo de render no separó a nadie: las tres marcaron entre 117 y 164 ms en modo desarrollo con los mismos datos.

## Decisión

1. **La librería de gráficas del CRM es ECharts.** Tiene casi el doble de tipos, y los que faltan en Recharts son
   justo los que el Hub va a pedir: heatmap de agendas por día y hora, calendario de actividad, sankey de etapas con
   zoom, `visualMap` para el semáforo. La serie `custom` cubre lo que no exista sin cambiar de librería.
2. **Ninguna pantalla importa ECharts.** Toda gráfica sale de una pieza propia en `components/graficas/` (el 256 la
   escribe y un guardián lo verifica): ahí vive, una sola vez, lo que hace mantenible a ECharts:
   - **Un envoltorio propio sobre `echarts/core`**, no `echarts-for-react`: son `init`, `setOption`, `resize` y
     `dispose` en unas 40 líneas, y así no depende de un paquete con menos mantenimiento que la librería.
   - **Registro explícito** de solo las series y componentes que se usan (`echarts.use([...])`), para que el peso
     crezca con lo que se dibuja y no con la librería entera.
   - **El tema de Tinta, una vez:** los tokens se resuelven con `getComputedStyle` y se registran como tema de
     ECharts; la pieza lo vuelve a aplicar cuando cambia el modo claro u oscuro. Ningún color va en las opciones de
     una gráfica.
   - **Renderizador SVG por defecto** (texto nítido y seleccionable, más liviano con pocos puntos); canvas solo si una
     gráfica concreta lo pide por volumen.
   - **Carga solo en el cliente y solo donde hay gráfica** (`next/dynamic`), para que el peso no llegue a pantallas
     sin gráficas.
3. **Lo que importa es el tooltip al pasar el mouse** (Mani, 14-oct): en cada punto dice el día, el valor, contra
   qué se compara y el cambio en número y %. Recorrer los puntos con el teclado **no es requisito**. El clic en un
   punto para abrir el dato **queda para después** (se decide aparte); mientras tanto la cifra abre su lista desde
   fuera de la gráfica, como hoy (ADR 0067). La pieza enciende el módulo `aria` y deja la tabla alternativa, que no
   cuestan nada.
4. **El vocabulario de la comparación es el del 251:** ninguna gráfica dice "A" ni "B"; el tooltip dice contra qué se
   compara ("mismo punto de septiembre: 12 → 15, +3, +25 %").

## Consecuencias

- El 256 instala `echarts` (versión exacta), escribe la pieza y su guardián, y migra `SeriesLineales` y las gráficas
  del Hub. `echarts-for-react` no se instala.
- Cada gráfica nueva es un objeto de opciones dentro de la pieza: más corto que JSX y fácil de revisar en un diff.
- El primer render de una pantalla con gráfica pesa unos 190 KB gzip más; a la escala del CRM (cinco usuarios, red de
  oficina) no se nota, y el `next/dynamic` lo saca de las pantallas sin gráficas.
- No hay puntos enfocables por teclado dentro de la gráfica, y está bien así (Mani, 14-oct). El clic por punto, si se
  pide, ECharts lo da con un evento `click` en la pieza.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Recharts | más liviana y más accesible por punto, pero con la mitad de tipos y sin `dataZoom`, `visualMap` ni heatmap: el Hub se quedaría corto en los primeros tickets de gráficas nuevas |
| visx | 25 KB, pero ejes, escalas y tooltips se arman a mano en cada gráfica (Mani: no) |
| `echarts-for-react` | resuelve 40 líneas a cambio de una dependencia con menos mantenimiento que ECharts |
| Claude Dashboards | referencia de diseño, no candidata: vive fuera del CRM y se salta su rol y su frontera de programa (H-8) |
