# Lo que toca hacer

Weekly del 4-nov-2026 con Daniel Tovar. Este documento es el plan de trabajo que sale de ahí. Si hay que retomar o reforzar algo, la fuente oficial de lo que pidió Daniel es la transcripción: [`docs/reportes/weekly-2026-11-04-transcripcion.md`](docs/reportes/weekly-2026-11-04-transcripcion.md). Las partes del Hub están en las líneas 148 a 430.

## 1. Las dos prioridades

1. Atacar el Hub página por página. Hoy son cinco: Hoy, Comercial, Dinero, Pauta y Origen.
2. Dejarlo pulido y listo para usarse, sin "falta migrar" ni "esto lo tengo que cambiar".

## 2. Métricas de éxito

| # | Criterio | Cómo se comprueba |
|---|---|---|
| 1 | Los datos son reales | Cada cifra se contrasta contra producción (lectura) y contra la lista que abre |
| 2 | Las consultas están estandarizadas | Una métrica = un hecho de `lib/queries/` (C-2, `docs/hub.md` §8) y una definición en `docs/metricas.md`. Ninguna consulta suelta |
| 3 | Sabemos que las consultas son efectivas y no tienen huecos | Paridad probada con el caso que las haría divergir (N2), cobertura parcial dicha en pantalla (N3), anuladas fuera (`vigente`) |
| 4 | Trazabilidad | Toda cifra se presiona y abre el pop-up o la lista con los registros que la componen |

Estos cuatro criterios ya son el ADR 0115 (N1 a N9). Lo nuevo es que ahora son la vara con la que se cierra cada página.

## 3. Lo que pidió Daniel (resumen, con línea de la transcripción)

- Los filtros deben servir: hoy "la data está metida pero todavía no es útil por los filtros" (l. 290 aprox.).
- Periodo y cohorte/SKU son filtros **separados**, y debe verse la fecha de la primera venta de la cohorte (l. 224 a 235). Ya existe el 377.
- Dinero siempre en tres columnas con tres nombres: **vendido**, **recaudado**, **por cobrar** (l. 238 a 247). Ya existe el 369 y el 380.
- Todas las gráficas en dos unidades (cupos y plata) y una sección fija, que los filtros no tocan, con lo llevado contra el objetivo del mes y de la cohorte (l. 264 a 280). Ya existe el 371.
- Pauta: el ROAS se mide por el día en que se creó la cita, no por el día de la llamada. Alerta de agendas pendientes y ROAS proyectado con la tasa de show y de cierre de las últimas semanas, por closer (l. 395 a 410). Ya existe el 375.
- Fuente única de verdad: reporte descargable en PDF con los filtros puestos (l. 296 a 300). Ya existe el 373.
- La usabilidad pesa tanto como los datos: si es difícil, no se usa (l. 301).

## 4. Lo que pidió Mani en el recorrido del 4-nov (Hub › Hoy)

Se numera igual que su nota para poder citarlo. Cada ítem apunta a la sección del Hub que toca.

### A. Cambios que valen para las cinco páginas

| # | Pedido | Decisión de diseño propuesta |
|---|---|---|
| A1 | Botón **Info** arriba a la derecha en cada página. Muestra de forma visual y muy corta qué hay en la página y cómo se calcula | Panel lateral o diálogo con una tarjeta por sección, con diagrama pequeño en lugar de párrafo. Reemplaza los bloques "Cómo se calcula" que hoy son un párrafo |
| A2 | Cada sección tiene un mini enlace "?" que abre el Info directo en su apartado | Ancla por sección (`?info=<seccion>`), para que se pueda compartir |
| A3 | Tabla de contenido horizontal, arriba, que lleva a cada sección | Barra de anclas bajo el título de la página |
| A4 | Nada de dropdowns (acordeones) para contenido principal | Todo lo que hoy está plegado pasa a tarjeta visible o al Info |
| A5 | Jerarquía: cada bloque es una tarjeta con título, no texto blanco sobre fondo negro | Tarjetas de Tinta con el mismo patrón que las cuatro de arriba (cupos, leads, caja, show) |
| A6 | Un dato se muestra una sola vez. Se agrupa por categoría y se quita la repetición | Auditar Hoy: "por closer", "leads del día", "citas y cierres" repiten lo mismo (ítems 9, 11 y 12) |
| A7 | **Toda cifra se presiona.** Hoy no se pueden presionar: cupos del día, leads del día, % de show, y las barras de leads y realizadas | Si una cifra no puede abrir lista, no se muestra (N1, contrato de entendimiento) |
| A8 | Vocabulario sin convenciones propias | Ver sección 5 |

### B. Hub › Hoy, ítem por ítem

| # de Mani | Qué dijo | Qué hay que hacer |
|---|---|---|
| 1 | Botón Info | Es A1 |
| 2 | "Cupos del día" y "leads del día" no se presionan. La meta sale vacía y se define en configuración. "Objetivo", "agenda", "flecha", "venta", "porcentaje" son convenciones nuestras. "Ventana del ritmo" y "muestra mínima de conversión" no se entienden en el pop-up de configuración | Hacer presionables las dos cifras. Meta vacía muestra "—" y el botón para configurarla. Renombrar cada término (sección 5) y reescribir el panel de configuración con una frase por campo y un ejemplo |
| 3 | "Caja del día" bien. "% de show" debe presionarse. Las barras (leads, agendas realizadas, ventas) están feas y leads y realizadas no se presionan | Rediseñar el embudo del día. Cada barra abre su lista |
| 4 | "% de show" y "% de cierre" están metidos entre las barras sin relación | Sacarlos del medio. Van como cifra propia encima del embudo, o al lado de la transición que miden |
| 5 | ¿Qué define qué tan llena está la barra? ¿Cuál es el máximo? "Meta" y "real" no se entienden. "Meta" es ambiguo (pauta, empresa, objetivo) | Regla visible: el 100 % de la barra es el total de leads del día y cada barra siguiente se mide contra él. Con el número a la vista. Ver glosario de "meta" en la sección 5 |
| 6 | "Necesarios para llegar" no se sabe de dónde sale. Tiene un dropdown con las ventas por día y el cálculo. No hay jerarquía ni historia | Es la decisión D1 del ticket 378. La cadena (ventas por día ÷ cierre ÷ show ÷ agenda por lead) pasa al Info como diagrama de pasos. En la pantalla queda una tarjeta con el número y su enlace al Info |
| 7 | "26 leads por día" y "ventas del día" no se sabe qué son. Sin títulos ni cuadros | Cada una pasa a tarjeta con título |
| 8 | "Moneda", "ventas del día", "detalle de caja": sin conteo ni jerarquía | Una tarjeta Dinero del día con vendido, recaudado y por cobrar, el conteo de ventas y el detalle por moneda como filas, no como texto corrido |
| 9 | "Agendas del día" repite datos y "por closer" repite. Debe ser su tarjeta, sin dropdown | Una sola tarjeta de agendas, con el desglose por closer como parte de ella |
| 10 | "¿Qué pasó con cada agenda?" debe ser más descriptivo y trazable: canceladas, pendientes y las 8 de cada closer | Estados con conteo, cada uno abre la lista. Cada cita abre su llamada (ya pedido en el 378) |
| 11 | "Leads del día" se repite | Fusionar con la tarjeta de leads |
| 12 | "Citas y cierres del día" también repite el 11 | Fusionar |
| 13 | "Meta de la semana": palabra ambigua; tabla con "meta, fecha, real" que no dice nada; "cumplimiento a la fecha" sin explicar. Los párrafos del "cómo se calcula" no sirven. La barra de "vamos a llegar" no tiene números, se sale de la pantalla y no se sabe cómo se llena. "Agenda de hoy por horas" debe llevar al Info. "Mañana" está feo y debería ser su propia tarjeta junto con alertas y pendientes. "Metas noviembre 2026" queda al final | Rehacer La semana y el cierre de Hoy (ver estructura de abajo) |

### C. Estructura propuesta para Hub › Hoy

Orden de arriba hacia abajo. Cada bloque es una tarjeta. Nada plegado.

1. Barra de contenido (anclas) + botón Info
2. Las cuatro cifras de entrada: cupos, leads, caja, % de show (todas presionables)
3. El embudo del día: leads → agendas → realizadas → ventas, con el % de show y de cierre encima
4. Dinero del día: vendido, recaudado, por cobrar, y detalle por moneda
5. Agendas del día: estados, por closer, por hora
6. Alertas y pendientes (incluye "Mañana")
7. Objetivo de la semana y avance a la fecha
8. Objetivo del mes y de la cohorte (el bloque fijo del 371), al final

### D. Las otras cuatro páginas

Hoy solo se detalló Hoy. Cada una repite el mismo ciclo: **Info + tarjetas + vocabulario + cada cifra abre su lista + datos contrastados con producción**.

| Página | Estado de partida | Lo que Daniel pidió y falta cerrar |
|---|---|---|
| Comercial | 379 en main, sin checkpoint verde | Filtros útiles. Agendas por día, no solo acumulado. Periodo anterior solo a pedido |
| Dinero | 380 en main, sin checkpoint verde | Tres columnas siempre. Histórico de la cohorte en las gráficas. Fecha de la primera venta del SKU visible |
| Pauta | Sin ticket de entendimiento | ROAS por fecha de creación de la cita, alerta de agendas pendientes, ROAS proyectado por closer. Es la más densa: partirla en origen y rendimiento |
| Origen | Sin ticket de entendimiento | Sentarse con César a entender el tracking de UTM antes de tocarla (acuerdo del weekly) |

## 5. Glosario de vocabulario (aplicado a Hoy el 4-nov)

El problema de fondo es que "meta" se usa para tres cosas distintas y "real" no dice nada. Propuesta, sujeta a tu OK porque cambia el ADR 0115 (N4) y el vocabulario de `docs/overview.md` §11:

| Hoy | Problema | Propuesta |
|---|---|---|
| Meta (de cupos, de dinero, de leads) | Se confunde con "Meta" la plataforma de pauta | **Objetivo**. "Meta" queda solo para la plataforma (Meta Ads) |
| Meta de leads por día (de la cohorte) | Se mezcla con lo que haría falta | **Objetivo de leads**, lo escribe una persona en configuración |
| Necesarios para llegar | Parece un objetivo y es un cálculo | **Leads que hacen falta hoy** (sale del objetivo de cupos, no se edita) |
| Real | No dice qué es | **Llevamos** (lo acumulado a la fecha) |
| Cumplimiento a la fecha | Sin referencia | **Avance contra lo esperado hoy** |
| Ventana del ritmo | Jerga | **Días que se miran para calcular el ritmo** |
| Muestra mínima de conversión | Jerga | **Mínimo de citas para confiar en el % de show** |
| Agenda / agendas | Puede ser la cita o la lista | **Cita agendada** (la cita) y **Citas de hoy** (la lista) |
| Venta / ventas | Puede ser deal o dinero | **Cupo vendido** (conteo) y **Vendido** (dinero) |
| Objetivo (sin decir de qué) | Nadie sabe objetivo de qué | Siempre con su apellido: **Objetivo del mes**, **Objetivo de la cohorte**, **Objetivo de la semana**. Con una frase al lado: "lo que queremos vender" |
| Flecha (↑ ↓ junto a una cifra) | No dice contra qué compara | **Cambio frente a ayer / la semana pasada**, con el periodo escrito: "▲ 12 % vs. semana pasada" |
| Porcentaje suelto (% show, % cierre) | No dice de qué sobre qué | Siempre con su cuenta a la vista: "Show 46 % (18 de 39 citas)". Nombre: **Asistencia a la cita** y **Cierre de ventas**. "Show" queda como palabra de uso interno del equipo, se acepta junto al nombre largo |

Regla para todo el Hub: ninguna cifra sin su unidad, su periodo y su base ("de qué sobre qué"). Si no cabe en la tarjeta, va en el Info.

**Dónde aparecen esas palabras (aclaración de Mani):** "objetivo", "agenda", "venta", "porcentaje", "ventana del ritmo" y "muestra mínima de conversión" son los textos de los **6 campos del panel Configuración de Hoy**. No se entiende qué es cada uno, para qué se define ni sobre qué cifra incide. Cada campo lleva: nombre humano, para qué sirve, qué cifras de Hoy cambia, un ejemplo con números y de dónde sale el valor si no está configurado. Los campos se agrupan por tarjeta y su explicación vive en el Info.

**Estado:** aplicado a Hoy, a "¿Vamos a llegar?" y a Metas del mes desde `lib/vocabulario-metricas.ts` (un solo módulo; un guardián caza "Meta del…", "Necesarios para llegar" y "Cumplimiento a la fecha"). Falta aplicarlo a Comercial, Dinero, Pauta y Origen cuando se hagan.

**Cómo se cerró el glosario:** la sesión que ejecuta Hoy hace primero el inventario real. Busca en `components/dashboard/`, `lib/` y `app/` cada texto visible con las palabras objetivo, meta, real, agenda, flecha, venta, porcentaje, ventana, muestra, y entrega una tabla "texto hoy → texto nuevo → dónde". Esa tabla es el glosario definitivo; esta de arriba es el punto de partida. Los cambios de nombre se hacen en un solo módulo de vocabulario (N4), no pantalla por pantalla.

## 5b. Estado al 4-nov (noche)

Hoy: 12 de los 13 puntos hechos y uno parcial (el 13: "Objetivos del mes y la cohorte" repite parte de "La semana"). Verificado con typecheck, lint, build, 205 tests, cifras contra producción en solo lectura y recorrido visual. Falta: celular, PDF de Hoy, checkpoint verde. Comercial, Dinero, Pauta y Origen: sin empezar con este ciclo (Info, tarjetas, vocabulario, trazabilidad). Detalle en `docs/tasks/378-hoy-legible-y-configurable.md` y `docs/agents/handoff.md`.

## 6. Cómo se ejecuta

Cada página es un ticket nuevo, en este orden: **Hoy → Comercial → Dinero → Pauta → Origen**. Cada ticket cierra con la misma lista:

- [ ] Botón Info con cálculo visual y anclas por sección
- [ ] Barra de contenido horizontal
- [ ] Sin dropdowns en contenido principal, nada repetido
- [ ] Cada cifra abre su lista (prueba por cifra, como `tests/metricas-con-filas.test.ts`)
- [ ] Vocabulario del glosario aplicado, sin jerga ni `utm_*` (N5)
- [ ] Cada cifra contrastada contra producción en solo lectura
- [ ] Consulta única por métrica, citada en `docs/metricas.md`
- [ ] Estados vacíos y parciales dichos en pantalla (N3)
- [ ] `npm run typecheck`, `npm run lint`, tests del cambio, `npm run build` (hay componentes cliente) y un recorrido con clics en la app
- [ ] Tracker (`docs/tasks/README.md`) igual al `status:` del archivo (N9)

Orden sugerido para hoy: (1) cerrar el glosario, (2) construir el componente Info compartido, porque lo usan las cinco, (3) rehacer Hoy con él.

Tickets existentes que quedan absorbidos o se cierran con esto: 378 (Hoy legible y configurable), 379, 380, y los pedidos de 371, 373 y 375 que aún no están a la vista.

## 7. Otros acuerdos del weekly (fuera del Hub)

- Mani agenda 30 minutos con Andrea, Maru y Dana esta semana.
- Sentarse con César para entender el tracking de UTM.
- Majo y Dani Rodríguez (media) esperan a la semana que viene.
- Escribirle a Alfredo y a Mariana de EstadoX para estar visible.
- Los SKU los crean solo gerencia o Mani, con nomenclatura uniforme.
