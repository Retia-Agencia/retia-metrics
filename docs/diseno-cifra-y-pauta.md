# La Cifra y Hub › Pauta: el diseño aprobado (10-nov)

> **Norte visual aprobado por Mani el 10-nov, textual: "me parece perfecto así TAL CUAL COMO EL ARTIFACT, ese debe ser el norte; que
> se vea y sienta igual".** El boceto es [`docs/bocetos/una-forma-de-metrica.html`](./bocetos/una-forma-de-metrica.html) (versión 2;
> se abre con doble clic, sin servidor). También está publicado como artifact privado de Mani
> (`https://claude.ai/artifact/HSVdjQ6QdPdHeQ9obbEAPS`); para quien no tenga acceso, el HTML del repo es el mismo.
>
> **Es la referencia visual permanente de todo el CRM** (Mani, 10-nov: "así quiero que se vean los componentes y layouts"), no
> solo de Pauta: toda pantalla nueva o tocada se compara lado a lado con el HTML en claro, oscuro y 375 px.
>
> **Este documento escribe en palabras todo lo que el boceto muestra**, para construirlo sin abrirlo y sin perder detalle. Si el
> boceto y este texto discrepan, manda el boceto en lo visual y este texto en las reglas. Las cifras del boceto son **de ejemplo**;
> las fórmulas son las vigentes (`docs/metricas.md`, `docs/paid-media-2026-11-09.md` §3).
>
> Jerarquía (ADR 0115, N8): es un documento de diseño. Lo que diga un ADR vigente manda sobre él; los tickets 414 a 421 lo
> ejecutan. Las definiciones siguen viviendo solo en `docs/metricas.md`.

## 0. En una página

1. **Una sola pieza, la Cifra**, igual en todo el Hub (no solo en Pauta). A la vista lleva solo lo necesario para leerla en un
   segundo; **todo lo demás aparece al hacer clic** en una explicación organizada: qué mide, la fórmula en bloque con sus
   variables, qué significa cada número y etiqueta de la tarjeta, los filtros con que se calculó y la evidencia (la lista).
2. **Quienes leen son Gerencia y Pauta, no técnicos.** Ningún texto visible lleva rutas de archivo, nombres de función, números
   de ticket, ADR, ids de decisión ni términos del backend (extiende N5 a la explicación).
3. **Hub › Pauta se parte en dos vistas** con los mismos filtros: **Resultados** (lo que reemplaza al Excel) y **Origen y
   calidad** (de dónde vienen las ventas y qué llega mal). De nueve bloques en una pantalla a cinco más tres.
4. **Las gráficas son interactivas**, nunca una imagen estática: tooltip por día, clic en un punto abre su explicación, leyenda
   que prende y apaga series, zoom.
5. **Los filtros son flexibles**: programa (frontera), cohorte, periodo con rango libre, comparar con, y "Ver solo" por cuenta,
   canal, campaña, conjunto o anuncio. Toda cifra se recalcula.

Origen de cada regla: el boceto v1 (10-nov) y las cinco observaciones de Mani sobre él (§8, anotaciones A-186 a A-190).

## 1. La Cifra (la pieza)

### 1.1 Lo que se ve, de arriba abajo

| Parte | Qué es | Regla |
|---|---|---|
| Rótulo | Nombre del concepto, del vocabulario (`overview.md` §11) | Peso medio, 13 px. Un nombre por concepto (N4) |
| Universo | "· de pauta" o "· todas las áreas", en gris junto al nombre | Siempre visible (DM-6). "de pauta" = personas o gasto que vienen de anuncios pagos |
| Estado | Badge a la derecha del rótulo: En meta / En seguimiento / Rezagado | Único color de la pieza. Sin fuente (objetivo o esperado) no hay badge, nunca un gris inventado |
| Valor | Número grande en Geist Mono 26 px, formato de `lib/format.ts`, moneda al lado | Regla del vacío: "—" no se puede calcular, 0 es cero, "Sin datos" aún no hay periodo |
| "de N" | Si hay meta de cantidad: "412 **de 900**" en gris junto al valor | La meta es de la cohorte; la cargan Pauta o Gerencia en Programa › Objetivos |
| Barra de avance | Solo con meta de cantidad (agendas, ventas, plata, presupuesto) | Lleno = lo que llevamos, en el tono del estado (morado si no hay estado). **Rayado** = el atraso (de lo que llevamos a lo esperado). **Marca vertical rotulada debajo: "a hoy 558"**. Nunca una línea sin rótulo (fue la queja del v1: "una línea blanca que parece puesta al azar") |
| Línea de lectura | Una sola: "Vamos **146** atrás" o "Vamos **N** adelante" | El número en mono y en `foreground`; el resto en gris 12 px |
| Línea propia (opcional) | Un dato que la cifra necesita para no engañar, rotulado | Ej.: "Sin contar **COP 57.000** de otras campañas"; "**18** citas de pauta pendientes"; "Promedio real de la cohorte" |
| Comparación (solo si se pidió) | "C5 al mismo día: **380** · +32 (+8 %)" | Gris siempre (DM-2). En tasas el cambio va en **puntos**. Usa el mismo formato que el valor (si el valor va en "COP 15,6 M", el cambio también) |
| Etiquetas | "Parcial", "En curso", y en el boceto "Por construir" | Badge neutro. **Su significado se explica al abrir**, no en la tarjeta (DM-7) |
| "Cómo se calcula →" | Texto en el acento, aparece al pasar el mouse o con foco | Toda la tarjeta es el botón; `aria-label` = "Rótulo: valor. Abrir cómo se calcula" |

**Lo que se quitó del v1 a pedido de Mani:** las letras guía a–g, la píldora de universo con borde, la leyenda bajo la barra con
tres números sin rótulo ("412 de 900 · 46 %" a la izquierda y "esperado 558" a la derecha) y la línea de atraso con el dinero
pegado. Cada número que queda tiene su rótulo.

### 1.2 Tres tamaños, la misma pieza

- **Tarjeta**: lo principal de un bloque (ej. costo por agenda de la semana con su estado y su comparación).
- **Barra**: la tarjeta con avance, para el cumplimiento.
- **Celda de tabla**: valor en mono, punto de estado a la izquierda solo si hay objetivo, y debajo en gris 11 px el cambio
  contra la columna anterior. Toda celda es un botón que abre la misma explicación.

### 1.3 Los ocho casos raros, resueltos una vez

| Caso | Cómo se ve | Qué dice al abrir |
|---|---|---|
| Normal con estado | Valor + badge | El estado con sus umbrales |
| Parcial (falta dato) | Valor + badge "Parcial" | "Hay N citas del periodo cuya hora no ha llegado; cuando ocurran, la tasa cambia" |
| "—" no se puede calcular | "—" en gris | El motivo en palabras + "«—» nunca significa cero" (ej. frecuencia en una semana: Meta solo da las personas alcanzadas día por día) |
| 0 es cero | "0" | "Es cero de verdad: se midió y no hubo ninguna" |
| Sin datos todavía | "Sin datos" | "La cohorte C7 aún no abre la venta. Todavía no hay periodo que medir" |
| Sin objetivo cargado | Valor sin color | "Sin color: esta cohorte no tiene objetivo cargado para esta métrica. Se carga en Programa › Objetivos" |
| En curso | Valor + badge "En curso" | "La semana del 9 al 15 nov todavía no termina: las cifras pueden subir y las tasas cambiar" |
| "—" por falta de gasto | "—" | "El gasto de Meta solo está desde el 1 oct y el periodo empieza antes: dividir daría un ROAS inflado" (lo mismo vale para Inversión, Profit y CPM: D-E del audit) |

### 1.4 Una escala de estado (DM-1, aprobada)

| Estado | Metas de cantidad: contra lo esperado a hoy (D-7) | Costos y tasas: contra el objetivo (D-6) |
|---|---|---|
| En meta (`exito`) | llevamos ≥ 100 % de lo esperado | cumple el objetivo |
| En seguimiento (`alerta`) | entre 65 % y 100 % | entre el objetivo y lo aceptable |
| Rezagado (`peligro`) | < 65 % | peor que lo aceptable |

- Esperado a hoy = meta × fracción de días hábiles de venta de la cohorte transcurridos (en el ejemplo, 900 × 62 % = 558).
- **El semáforo deja "Atención / En peligro"** (`components/semaforo/semaforo-del-programa.tsx:8`) y usa estas palabras
  (`lib/metas/cumplimiento-de-cohorte.ts:26`). Cambia el rótulo, no el cálculo; el reporte de WhatsApp no cambia en esta ola.
- **Presupuesto usado no lleva estado**: gastar más rápido o más lento de lo planeado no es bueno ni malo por sí solo; se lee
  junto al costo por agenda. Al abrirla lo dice.
- Umbrales del boceto, **ilustrativos** (D-6 sigue sin confirmar por Paid Media): costo por agenda ≤ COP 40.000 meta, ≤ 52.000
  aceptable; costo por venta ≤ COP 450.000 / 600.000; ROAS ≥ 10× / 5×; Agenda → venta ≥ 10 % / 6 %.

## 2. La explicación (lo que abre toda cifra)

Panel lateral derecho de 480 px (pantalla completa en celular), con velo, foco en "Cerrar", Escape cierra y el foco vuelve a la
cifra. En el boceto se ve también incrustado al lado de la tarjeta de ejemplo. Secciones, en este orden:

1. **Encabezado:** rótulo; valor grande ("412 de 900") con su badge de estado; **qué mide en una frase** de negocio.
2. **Fórmula:** bloque gris con la fórmula escrita como matemática: nombre en negrita, "=", y para una razón una fracción
   apilada (numerador sobre una raya, denominador abajo), "× 1.000" si aplica; para una suma "Σ"; para un conteo "número de …";
   para una resta "A − B"; para un producto "A × B". Debajo, en mono gris: **"Con los números de esta cifra: 403.200 ÷ 9 =
   COP 44.800"** (las partes reales con que se calculó). Debajo, la lista de **variables**: cada nombre de la fórmula con su
   explicación en una línea. Si el Excel la llama distinto: "En el Excel se llama «% de presentación a zoom»".
3. **Cómo leer la tarjeta:** una fila por cada cosa visible en la tarjeta, en el orden en que aparece:
   - el valor: qué es, con el periodo ("Cuántas citas se reservaron, de personas que llegaron por anuncios, cohorte C6 hasta hoy");
   - el universo: "de pauta: solo personas o gasto que vienen de anuncios pagos" o "todas las áreas: pauta, orgánico, referidos
     y registros sin origen, juntos";
   - "de 900": la meta de la cohorte y dónde se carga;
   - "a hoy 558": "lo que deberíamos llevar si avanzáramos parejo: 900 × 62 %, porque ya pasó el 62 % de los días hábiles de
     venta de la cohorte. Es la marca sobre la barra";
   - "146 atrás": "558 − 412. Es lo rayado en la barra" (o "ya vamos por encima de lo esperado");
   - el estado: con esperado, "llevamos 74 % de lo esperado a hoy. En meta desde 100 %, en seguimiento desde 65 %, rezagado por
     debajo"; con objetivo, "el objetivo es COP 40.000 o menos y lo aceptable COP 52.000 o menos. Esta cifra queda entre los dos.
     Los cargan Pauta o Gerencia en Programa › Objetivos";
   - el cambio: "Comparado con C5 al mismo día (380): +32 (+8 %). Va en gris porque subir no siempre es bueno; el color solo lo
     pone el estado" (en tasas añade "de 40 % a 42 % son 2 puntos"); en una celda de tabla se llama "La línea pequeña" y dice
     contra qué columna; en la gráfica, "Contra el día anterior";
   - "Parcial", "En curso", "Sin color", "—", "0", "Sin datos": cada uno con su frase (§1.3);
   - notas propias de la cifra (ej. "COP 57.000: gasto de hoy en campañas que no son de agenda, «Tráfico a Instagram». Se nombran
     aparte para no inflar el costo por agenda"; "7,2× · 6,8×: cada día se guarda lo proyectado y, cuando ya ocurrieron esas citas,
     el real").
4. **Calculada con:** chips con los filtros vigentes para **esa** cifra: Programa, Cohorte, Periodo (o "Semana: 2–8 nov" / "Día:
   3 nov" si es una columna o un punto), "Solo: Cuenta · Rosario". El cumplimiento muestra solo programa y cohorte (no sigue el
   periodo); lo de hoy muestra "hoy hasta las 3 p. m.".
5. **La evidencia:** las primeras 5 filas de la lista detrás de la cifra y el botón "Ver las 412 agendadas" (la lista completa,
   `urlDeLista`, paginada en el servidor y que sabe volver). En una razón, una línea dice "Son las agendadas de abajo de la
   fórmula; la última columna dice cuáles suman arriba". Sin lista, la cifra no se muestra (§9 punto 8).

Prohibido en la explicación (DM-9): rutas, funciones, tickets, ADR, "§", ids M#/D-#/I-#, `utm_*`, "macro", "periodo A/B".

### 2.1 El texto de cada explicación (contenido de las fichas)

Es el contenido a escribir en las fichas del registro (`lib/metricas/registro.ts`, campos nuevos del 419). Rótulos provisionales
donde el audit tiene D-C abierta (§7).

| Clave (boceto) | Rótulo | Universo | Qué mide | Fórmula | Variables |
|---|---|---|---|---|---|
| inversion | Inversión | pauta | Lo que se gastó en anuncios de Meta, sumando todas las cuentas del programa | Inversión = Σ gasto de cada día en Meta | Gasto de cada día: lo que Meta reporta como gastado ese día, en pesos; entran todas las campañas (agenda, lanzamiento y otras) |
| presupuesto | Presupuesto usado | pauta | Cuánto de la inversión planeada para la cohorte ya se gastó | Σ gasto de cada día desde que abrió la venta de la cohorte | Inversión planeada: el presupuesto de la cohorte, en Programa › Objetivos |
| agendas | Agendadas | pauta | Cuántas citas se reservaron, de personas que llegaron por anuncios | número de citas reservadas en el periodo por personas de pauta | Cita reservada: la llamada que el lead apartó; cuenta el día en que la reservó, no el de la llamada. Persona de pauta: llegó por el enlace de un anuncio pago |
| agendas_meta | Agendas según Meta | pauta | Las agendas que reporta el pixel; sirven para revisar la medición, no como dato de negocio | número de agendas que reporta el pixel | Pixel de Meta: el código en la página de agenda; no siempre ve lo mismo que el CRM, la diferencia avisa que algo se mide mal |
| costo_agenda_crm | Costo por agenda | pauta | Cuánto costó, en promedio, cada cita que trajo la pauta | Gasto en campañas de agenda ÷ Agendadas de pauta | Gasto en campañas de agenda: solo las de objetivo agendar; lanzamientos y tráfico a Instagram van aparte como "otras campañas". Agendadas de pauta: del CRM |
| costo_agenda_meta | Costo por agenda según Meta | pauta | El mismo costo, dividiendo por las agendas que ve Meta | Gasto en campañas de agenda ÷ Agendas según Meta | Si difiere mucho del costo del CRM, la medición tiene un problema |
| cac | Costo por venta (CAC) | pauta | Cuánto se invirtió en pauta por cada venta de pauta | Inversión ÷ Ventas de pauta | Ventas de pauta: deals de personas de pauta en Abonado o Completo en el periodo |
| ventas | Ventas | pauta | Cuántos deals de personas de pauta pasaron a Abonado o Completo | número de deals en Abonado o Completo, por fecha de venta | Abonado o Completo: ya pagó al menos un abono |
| ventas_total | Ventas totales | todas | Todas las ventas de la cohorte, de cualquier origen | número de deals de la cohorte en Abonado o Completo | — |
| facturacion | Facturación (D-C propone "Vendido") | pauta | Cuánto se vendió en USD: el valor pactado, no lo que ya entró a caja | Σ valor vendido de cada venta de pauta | Valor vendido: el precio pactado; lo pagado es "Recaudado" y lo que falta "Por cobrar" |
| vendido_pauta / vendido_total | Vendido de pauta / Vendido total | pauta / todas | Valor pactado de las ventas de la cohorte, en USD (modo Plata del cumplimiento) | Σ valor vendido | — |
| roas | ROAS | pauta | Cuántos dólares vendidos trajo cada dólar invertido | Facturación de pauta ÷ Inversión en dólares | Inversión en dólares: gasto de cada día ÷ tasa de cambio de ese día. A qué día va una venta: al día en que la persona se registró, no al de la venta (D-B) |
| profit | Profit | pauta | Lo vendido en pauta menos lo invertido, en dólares | Facturación de pauta − Inversión en dólares | — |
| show | % de show (D-C: rótulo por definir) | pauta | De las citas que ya debían ocurrir, qué parte ocurrió | Citas realizadas ÷ Citas del grupo | En el Excel: "% de presentación a zoom". Fórmula sujeta a D-A |
| cierre_ventas | Cierre de ventas | pauta | De las llamadas que ocurrieron, qué parte terminó en venta | Ventas ÷ Citas realizadas | En el Excel: "% de cierre zoom a cliente". Sujeta a D-A |
| agenda_venta | Agenda → venta (D-C: "De cita a venta") | pauta | De las citas reservadas, qué parte terminó en venta | Ventas ÷ Agendadas | En el Excel: "% de cierre agenda a cliente". Sujeta a D-A |
| cpm | CPM | pauta | Cuánto cuesta que Meta muestre los anuncios mil veces | Inversión ÷ Impresiones × 1.000 | Impresiones: veces que Meta mostró los anuncios |
| ctr | CTR | pauta | De las veces que se mostró un anuncio, qué parte terminó en clic al enlace | Clics al enlace ÷ Impresiones | Clics al enlace: los que llevan a la landing, no likes ni perfil |
| llegada_landing | Llegada a la landing | pauta | De los clics al enlace, qué parte terminó de cargar la página | Vistas de la landing ÷ Clics al enlace | Vista: Meta la cuenta cuando la página terminó de cargar |
| conversion_landing | Conversión de la landing | pauta | De quienes vieron la página, qué parte se registró | Registros de pauta ÷ Vistas de la landing | Registros de pauta: formularios que llegaron al CRM desde anuncios |
| frecuencia | Frecuencia | pauta | Cuántas veces vio los anuncios cada persona, en promedio | Impresiones ÷ Personas alcanzadas | Personas alcanzadas: Meta solo la da día por día; en una semana sale "—" |
| agendas_dia | Agendas por día | pauta | Citas reservadas por día hábil de la cohorte, en promedio | Agendadas de la cohorte ÷ Días hábiles transcurridos | Días hábiles: lunes a viernes; festivos cuentan |
| agendas_req | Agendas por día necesarias | pauta | Citas por día que hacen falta, de hoy al cierre, para la meta | (Meta − Agendadas) ÷ Días hábiles que faltan | — |
| inversion_req | Inversión por día necesaria | pauta | Cuánto invertir por día para conseguir las agendas necesarias | Agendas por día necesarias × Costo por agenda | Se calcula con dos costos: el objetivo (cifra grande) y el promedio real de la cohorte (línea de abajo), como 30X |
| roas_proy | ROAS proyectado | pauta | El ROAS esperado cuando ocurran las citas de pauta que faltan | (Vendido a hoy + Valor esperado de las citas pendientes) ÷ Inversión en dólares | Valor esperado de una cita = prob. de que ocurra × prob. de que cierre × precio de la cohorte; probabilidades del closer dueño, últimas 3 semanas (la del programa si tiene pocas) |
| envios_sin_id | Registros de pauta sin anuncio | pauta | Registros que llegaron por un anuncio pago sin el dato de cuál fue | número de registros de pauta sin id del anuncio | Id del anuncio: lo agrega Meta si el anuncio usa la plantilla de enlaces de Retia |
| registros_sin_utm | Registros sin origen | todas | Registros que llegaron sin decir de dónde vienen; no se recuperan, se corrige el enlace | número de registros sin fuente ni medio | Origen: plataforma, tipo de tráfico y campaña del enlace |
| ventas_sin_anuncio | Ventas sin anuncio identificado | pauta | Ventas de pauta sin saber qué anuncio trajo a la persona | número de ventas de pauta cuyo registro llegó sin id | — |
| embudo | (nombre del paso) | todas | Cuántas personas llegaron a este paso del formulario | % que llega = Personas en este paso ÷ Personas que abrieron el formulario | Abrieron: cargaron la primera pregunta |

## 3. Filtros (compartidos por las dos vistas de Pauta)

Barra en una tarjeta debajo del título, con etiquetas arriba de cada control:

| Control | Opciones en el boceto | Regla |
|---|---|---|
| Programa | Comunicarte, Tactical Investor, … | **Frontera, no filtro**: un programa a la vez, nunca se mezclan |
| Cohorte | C6 · en venta, C5 · cerrada | Filtro aparte del periodo (377) |
| Periodo | Desde que abrió la cohorte · Últimos 7 · 14 · 28 días · **Elegir fechas…** (dos campos de fecha "Del · al") | "De tal fecha a tal fecha" (Dani Rodríguez) |
| Comparar con | Nada · El periodo anterior · C5 al mismo día de venta | Comparación solo a pedido (ADR 0067) |
| Ver solo | Todo el programa · Cuenta de Meta (Rosario, Milena) · Canal (Instagram, Facebook) · Campaña · Conjunto · Anuncio | Corte de §9.4 del doc del 10-nov. Cuenta y conjunto **faltan como dimensión** (416 y 420) |

Debajo, una línea gris que resume en palabras: "Viendo Comunicarte, cohorte C6, 12 oct a 10 nov, solo Cuenta · Rosario,
comparado con el periodo anterior. Un programa a la vez: nunca se mezclan." Arriba a la derecha, el interruptor de vista
**Resultados | Origen y calidad** (DM-5). Todo filtro vive en la URL.

## 4. Hub › Pauta › Resultados (cinco bloques, en este orden)

### 4.1 "¿Vamos a llegar a la meta de la cohorte?"
Subtítulo: "Solo cambia con la cohorte: el periodo y los demás filtros no la mueven." Interruptor **Cupos | Plata** arriba a la
derecha.

- **Fila 1, cuatro barras:**
  - Agendadas (de pauta): 412 de 900, a hoy 558, 146 atrás, En seguimiento. Comparación: C5 al mismo día 380.
  - Ventas de pauta: 21 de 55, a hoy 34,1, Rezagado (en Plata: Vendido de pauta USD 28.400 de 74.000).
  - Ventas totales (todas las áreas): 31 de 80, a hoy 49,6, Rezagado (en Plata: Vendido total USD 41.900 de 108.000).
  - Presupuesto usado: COP 15,6 M de COP 26,0 M, a hoy 16,1 M, **sin estado**.
  - En Plata, Agendadas y Presupuesto no cambian.
- **Fila 2, el ritmo (tres cifras):**
  - Agendas por día: 11,8, "Promedio real de la cohorte" (412 ÷ 35 días hábiles).
  - Agendas por día necesarias: 22,2, "Hasta el cierre, el 9 dic" (488 ÷ 22).
  - Inversión por día necesaria: COP 888.000 al costo objetivo, con la línea "Al costo promedio real: **COP 1.023.400**".
- La comparación aquí solo aparece con "C5 al mismo día de venta".

### 4.2 "¿Cómo va el costo por agenda hoy?" (era el semáforo)
Subtítulo: "Hoy hasta las 3 p. m. Siempre es de hoy, sin importar el periodo elegido."

Cuatro tarjetas, comparadas con "Ayer a esta hora" si se pidió comparar:
- Costo por agenda: COP 44.800, En seguimiento, con la línea "Sin contar **COP 57.000** de otras campañas".
- Agendadas: 9.
- Agendas según Meta: 11.
- Inversión: COP 460.200.

### 4.3 "¿Qué semana rindió mejor?" / "¿Qué día rindió mejor?"
El título cambia con el paso. Controles:
- **Por semana | Por día** (414).
- **Total | Por cuenta** (416).
- Chip **"Cambio contra la semana anterior"** (o "el día anterior"), encendido por defecto.
- **Descargar CSV**.

**Leyenda encima de la tabla**, que responde la duda de Mani sobre los números pequeños: "Debajo de cada número, en gris: cuánto
cambió contra la semana (o el día) de la izquierda, en cantidad y en porcentaje. El punto de color solo aparece donde hay
objetivo cargado."

- **Columnas:**
  - Métrica, pegada a la izquierda.
  - **Total del periodo**, resaltada en `marca-suave` y en negrita: es la cifra fuerte (DM-3, sin tarjetas sueltas arriba).
  - Una columna por semana, lunes a domingo, Bogotá. La última dice "· en curso" (DM-7).
  - Por día: 14 días.
- **Filas, en tres bloques con su título en versalitas:**
  - **General:** Inversión, Agendadas, Costo por agenda, Ventas, **Costo por venta** (nueva, 415), Facturación, ROAS, Profit.
  - **Comercial:** % de show, Cierre de ventas, Agenda → venta. En la columna en curso llevan "Parcial".
  - **Tráfico:** CPM, CTR, Llegada a la landing, Conversión de la landing, **Agendas según Meta** (fila propia, nueva), Costo por
    agenda según Meta, Frecuencia (por semana "—").
- **Por cuenta:** debajo de Inversión, Agendas según Meta y Costo por agenda según Meta salen subfilas sangradas "Rosario" y
  "Milena", cada una con su total y sus columnas. **No suma programas.**
- **Punto de estado** solo en filas con objetivo (costo por agenda, costo por venta, ROAS, Agenda → venta).
- Toda celda abre su explicación, con "Calculada con: Semana 2–8 nov" y "La línea pequeña: comparado con la semana anterior
  (26 oct–1 nov)".

### 4.4 "¿Cómo se mueve día a día?" · meta: 22,2 agendas por día
La meta va como número junto al título, nunca dibujada (ADR 0106). Subtítulo con las instrucciones: "Pasa el mouse para ver cada
día; clic en un punto para abrir esa cifra; clic en la leyenda para prender o apagar una serie; arrastra abajo para acercar."

- **Interruptores** (en la URL, `?g_<clave>=`, ADR 0091 y 370):
  - **Unidad:** "Inversión y agendas" (por defecto: inversión en barras, eje COP a la izquierda; agendadas en línea, eje
    "cantidad" a la derecha) · "Cupos" (agendadas y agendas según Meta en línea, ventas en barras) · "Plata" (inversión COP en
    barras a la izquierda, facturación USD en línea a la derecha: **dos ejes, nunca mezclar monedas en uno**).
  - **Paso:** Día | Semana.
  - **Forma:** Por paso | Acumulado.
- **Interacción:**
  - Tooltip con el día en negrita, una línea por serie con su unidad (COP, USD o cantidad) y "Clic para ver cómo se calcula".
  - Clic en un punto o barra abre la explicación de esa métrica en ese día, con "Contra el día anterior" y "Calculada con: Día ·
    1 nov".
  - Leyenda arriba al centro, clicable.
  - Zoom con la rueda y con un deslizador abajo (solo por día).
- **Comparación:** si se pidió, una línea punteada gris "Agendadas · periodo anterior".
- **Pie:** "Datos de Meta de hace 14 min" a la izquierda y el chip **Ver como tabla** a la derecha. La tabla alternativa tiene
  las mismas series y sus celdas también abren la explicación.
- **Colores:** barras en `marca-suave` con borde del acento; líneas en acento, `info` y `exito` (tokens de Tinta resueltos al
  pintar, y se repinta al cambiar de tema).

### 4.5 "¿Qué ROAS esperamos cuando ocurran las citas que faltan?"
Subtítulo: "El ROAS de hoy es parcial mientras haya citas pendientes; el proyectado estima cuánto subirá."

- **ROAS a hoy:** 6,1×, En seguimiento, badge Parcial, línea "**18** citas de pauta pendientes".
- **ROAS proyectado:** 8,3×, línea "Proyectado el 3 nov: **7,2×** · real: **6,8×**".

## 5. Hub › Pauta › Origen y calidad (tres bloques)

### 5.1 "¿Qué trae ventas?"
Subtítulo: "Inversión, agendas y ventas por origen. «Revisar» marca lo que gastó sin traer agendas."

- **Ver por:** Cuenta | Canal | Campaña (por defecto) | Anuncio.
- **Columnas:** nombre, Inversión, Agendadas, Costo por agenda, Ventas, ROAS. Toda celda es una Cifra.
- Sin gasto (orgánico, referidos, sin origen) → "—" con el título "Sin gasto: no viene de pauta".
- En Canal, badges neutros "de pauta / orgánico / referidos / sin origen".
- En Anuncio, badge rojo **"Revisar"** en el que gastó sin agendas.
- Absorbe a Origen (vista Canal) y al ranking de anuncios.

### 5.2 "¿Qué llega sin origen?"
Subtítulo: "Lo que no se puede atribuir a un anuncio. Es la lista para corregir los enlaces."

- Dos cifras:
  - **Registros de pauta sin anuncio:** 38, "de **214** registros de pauta (18 %)".
  - **Ventas sin anuncio identificado:** 4, "de **21** ventas de pauta".
- Debajo, la lista por anuncio: nombre, campaña, "N sin id" (para la sesión con César).

### 5.3 "¿Dónde se va la gente del formulario?"
- Cuatro pasos como barras clicables, con "N · %" a la derecha y "Se fueron **N** en este paso":
  1. Abrieron el formulario.
  2. Respondieron la 1.ª pregunta.
  3. Llegaron a la agenda.
  4. Agendaron.
- Debajo: "La pregunta que más pierde: «¿Cuánto inviertes al mes?», se van **22 %**". Funde el embudo y el embudo por pregunta
  en un bloque.

## 6. Qué pasa con los nueve bloques de hoy (`app/(app)/p/[programa]/hub/page.tsx:675-694`)

| Bloque hoy | Pregunta | Qué pasa | Dónde queda |
|---|---|---|---|
| Semáforo del programa | ¿Cómo va el costo por agenda hoy? | Cambia de forma: Cifras con la escala única; el título dice que es de hoy | Resultados, 2.º |
| Cumplimiento de la cohorte | ¿Vamos a llegar a la meta? | Se queda arriba; gana Cupos/Plata y el ritmo | Resultados, 1.º |
| Tabla semanal de pauta | ¿Qué semana rindió mejor? | Se queda y crece: Por día, Por cuenta, Costo por venta | Resultados, 3.º |
| ROAS de pauta | ¿Qué trae ventas? | Se mueve; absorbe Origen y ranking | Origen y calidad, 1.º |
| Origen | ¿De qué canal llegan? | Se funde | Vista Canal de "¿Qué trae ventas?" |
| Traza de pauta | ¿Qué llega sin origen? | Se mueve | Origen y calidad |
| Proyección del ROAS | ¿Qué ROAS esperamos? | Se queda: dos Cifras | Resultados, al final |
| Embudo del formulario | ¿Dónde se va la gente? | Se mueve | Origen y calidad |
| Embudo por pregunta | ¿En qué pregunta? | Se funde | Dentro del embudo |

Ninguna cifra desaparece; lo que se quita es la repetición. La gráfica por día (4.4) es un bloque nuevo de Resultados.

## 7. Decisiones

| # | Qué | Estado (10-nov) | Cómo queda |
|---|---|---|---|
| DM-1 | Un solo vocabulario de estado | **Aprobada** | En meta · En seguimiento · Rezagado en todo, también el semáforo. Mani: "en otras sesiones ya había trabajado para centralizar el lenguaje; usar una convención estándar para NO tener confusiones" |
| DM-2 | La variación no lleva color | **Aprobada** | Gris; número y %; en tasas, puntos |
| DM-3 | Sin tarjetas sueltas arriba de la tabla | **Aprobada** | La columna Total del periodo es la cifra fuerte |
| DM-4 | Semáforos de Tráfico (CTR, conversión de la landing, frecuencia) | **Aprobada** | Esperan umbrales de Paid Media; luego valores nuevos en `metrica_objetivo` (migración). Mani: "cualquier cosa de objetivos la llenan pauta o gerencia de manera sencilla": se cargan en Programa › Objetivos (`app/(app)/p/[programa]/programa/objetivos-de-la-cohorte.tsx`), que ya existe |
| DM-5 | Pauta en dos vistas | **Aprobada** | Resultados \| Origen y calidad, mismos filtros, `?vista=` |
| DM-6 | Qué se mide, siempre visible | **Aprobada** | "de pauta" / "todas las áreas" en cada cifra y el detalle al abrir |
| DM-7 | Lo que está en curso | **Aprobada** | Última columna "en curso", tasas "Parcial"; toda etiqueta se explica al abrir, "organizada y breve" |
| DM-8 | Agenda, confirmada y llamada | **Propuesta** (falta el sí de Michael y Paid Media) | §7.1 |
| DM-9 | Toda cifra se explica al abrirla | **Aprobada** (feedback de Mani, 10-nov) | §2; aplica a todo el Hub |
| Q-8 | Por cuenta: ¿columnas fijas o desplegable? | Abierta (Paid Media) | El boceto usa el interruptor Total \| Por cuenta |

### 7.1 DM-8: una sola cosa, la cita, con estados

**Estados de una cita:** Agendada → **Confirmada** (estado nuevo) → Realizada / No asistió / Reagendada / Cancelada.

| Métrica | Qué cuenta | Con qué fecha | Quién la usa |
|---|---|---|---|
| Agendadas | Citas creadas | El día en que el lead reservó | Pauta (lo que compra la inversión) |
| Citas del día | Citas programadas para ese día | El día de la llamada | Comercial |
| Confirmadas | De las citas del día, las que el lead confirmó | El día de la llamada | Comercial: el closer marca "confirmó" cuando el lead dice que va |
| Realizadas | De las citas del día, las que ocurrieron | El día de la llamada | Las dos: base del % de show y del cierre |
| Agendas según Meta | Lo que reporta el pixel | El día en que Meta la vio | Pauta, solo para revisar la medición |

- **"Llamada" deja de ser una métrica:** una llamada es una cita realizada.
- **Por eso el número del día nunca cuadra:** las 30 agendadas hoy y las 8 realizadas hoy son citas distintas, porque las de hoy
  se reservaron días antes.
- **Para el Excel:** "Agendas del día" = Agendadas; "Llamadas realizadas" = Realizadas. Cierra Q-2 y Q-3 si lo confirman.
- **Es compatible con la D-C del audit** ("Agendadas" = creadas, "Citas" = por fecha de cita).
- **Si se confirma:**
  - Se escribe en `overview.md` §11 y `metricas.md` con N8.
  - "Confirmada" entra como estado nuevo de la cita, con migración (ticket 421).
  - Antes se pasa por `/grill-with-docs`.
- **Contexto:** Mani, 10-nov, "las confirmadas es algo que me toca agregar al pipeline comercial para que los closers puedan
  confirmar las llamadas si el lead ya dijo que va a ir".

### 7.2 Lo que este diseño no decide: el 403 (audit, F1)

El audit (`docs/audit-hub-2026-11-10.md` §8) tiene abiertas D-A (show, cierre y agenda → venta de Pauta con el grupo de citas de
Paid), D-B (un solo ROAS, por cohorte de registro), D-C (un rótulo por concepto: "Vendido" en vez de "Facturación", "De cita a
venta", "Asistencia" frente a "% de show por cita") y D-E (inversión "—" sin gasto cargado). **Hasta que Mani decida, la forma se
construye pero los rótulos y fórmulas de esas cifras no se fijan** (mensaje de la sesión del 403, 10-nov). La forma ayuda a
decidir: el universo y la explicación hacen visible qué se está mirando.

## 8. Lo que pidió Mani sobre el v1 (10-nov), cómo quedó

| # | Observación de Mani | Cómo quedó |
|---|---|---|
| 1 | "La tarjeta sigue muy saturada y los números a simple vista no se sabe para qué son. La barra tiene una línea blanca que parece puesta de manera aleatoria" | §1.1: sin letras ni leyenda de tres números; "de 900", "a hoy 558" y "146 atrás" rotulados; atraso rayado |
| 2 | "Lo de ¿vamos a llegar a la meta? igual; no entiendo los números de la tarjeta a simple vista" | §4.1 con la misma tarjeta, Cupos \| Plata y la fila de ritmo con cada número rotulado |
| 3 | "Para explicar cómo se calcula debe mostrar la fórmula y explicar las variables. Ver toda la lista es bueno. No debe mostrar convenciones del backend como «§3 M3 · lib/queries/hechos/agenda.ts». Los que usan esto son gerencia" | §2 y DM-9 |
| 4 | "¿Los números de cambio en cantidad y porcentaje son con respecto a la anterior? Presionar la métrica debería decir esto. Cualquier duda de cómo se ve la carta en números y métricas debe ser lo que se explica al presionar, con la evidencia y la fórmula en bloque de math con las variables explicadas" | Sí, contra la columna anterior: leyenda sobre la tabla (§4.3) y "Cómo leer la tarjeta" (§2) |
| 5 | "La gráfica va a ser interactiva, no puede ser una imagen estática" | §4.4 |
| — | "Debes tenerlo en cuenta para TODO, a nivel general" | DM-9 y el 419 aplican al Hub entero |
| — | "Ellos quieren flexibilidad de filtrado también y buenas gráficas" | §3 y §4.4 |

## 9. Lo que pidió cada uno y dónde quedó (cruce del boceto, 26 pedidos)

Fuentes: reunión con Paid Media (7-nov), weekly con Daniel Tovar (3-nov), Excels de pauta, diario de 30X, imagen KPI.

| Pedido | Quién | Dónde queda | Estado | Nota |
|---|---|---|---|---|
| Tabla semanal del Excel (inversión, agendas, costo por agenda, ventas, facturación, ROAS) | Paid Media · Excel | Resultados › tabla | En el boceto | — |
| Una sección diaria | Dani Rodríguez | Tabla Por día y gráfica | En el boceto | Cuadra con el Excel cuando se cierre DM-8 |
| Filtrar de tal fecha a tal fecha | Dani Rodríguez | Periodo › Elegir fechas | En el boceto | — |
| Show y cierre al lado del gasto | Dani Rodríguez | Tabla › Comercial | En el boceto | — |
| Bloques General / Comercial / Tráfico con semáforo | Imagen KPI | Tabla con punto de estado | En el boceto | Tráfico espera umbrales (DM-4) |
| Tres barras de cumplimiento | Diario 30X | Cumplimiento | En el boceto | — |
| Presupuesto usado | Excel | Cumplimiento | En el boceto | Funciona cuando se cargue la inversión de la cohorte |
| Agendas por día necesarias | Diario 30X · Excel | Ritmo | En el boceto | — |
| Agendas por día promedio real | Excel | Ritmo | Falta construir | Sin migración (420) |
| Inversión por día necesaria (objetivo y promedio) | Diario 30X | Ritmo | Falta construir | Sin migración (420) |
| Costo por agenda sin otras campañas, nombradas | Diario 30X | Hoy › costo por agenda | En el boceto | "Otras campañas" falta exponer (M2) |
| Costo por venta (CAC) | Excel | Tabla › General | Hecho (13-nov); falta el estado contra objetivo, que pide migración | 415 |
| Inversión, agendas Meta y costo por cuenta | Excel | Por cuenta · Ver por Cuenta · Ver solo | Falta construir | 416, sin migración; Q-8 |
| CPM, CTR, llegada, conversión landing, frecuencia | Imagen KPI · PowerTalk | Tabla › Tráfico | Falta construir | Traer impresiones, clics y vistas de Meta (hija D del 412) |
| Gráficas en cupos y en plata | Weekly 3-nov | Gráfica › Unidad; Cumplimiento › Cupos \| Plata | En el boceto | — |
| Periodo y cohorte separados | Weekly 3-nov | Filtros | En el boceto | Ya existe (377) |
| Cortar por cuenta, canal, campaña, conjunto, anuncio | Doc 10-nov §9.4 | Ver solo | En el boceto | Cuenta y conjunto faltan |
| ROAS por día del registro, aviso de pendientes, proyectado | Weekly 3-nov | ROAS a hoy y proyectado | En el boceto | La tabla semanal hoy ancla a la venta (D-B) |
| Anuncios sin id, lista para César | Weekly 3-nov | ¿Qué llega sin origen? | En el boceto | — |
| Ranking de anuncios con "Revisar" y ventas sin anuncio | Diario 30X | Ver por Anuncio · Ventas sin anuncio | En el boceto | — |
| Descargar lo que se ve | Weekly · Excel | CSV; PDF del día en Hoy | En el boceto | — |
| Metas y umbrales cargados sin técnico | Mani 10-nov | Programa › Objetivos | Falta decidir | Agregar ahí los de Tráfico |
| Plan de inversión diaria y diferencia contra el plan | Excel | — | Falta decidir | 417; Q-4; migración si es tabla |
| Agendas diarias por programa con interruptores | Diario 30X | Vista de todos los programas | Falta decidir | Solo cantidades, nunca tasas entre programas |
| Día contra el promedio de 7 días | Diario 30X | — | Falta decidir | Segunda fase (M22) |
| Línea de base "referencia al 3 de septiembre" | Excel | — | Falta decidir | Se carga como objetivo (Q-9) |

Resumen: 15 en el boceto, 5 dibujados que falta construir, 6 por decidir.

## 10. El contrato de la pieza (para construirla)

```
CifraDeMetrica {
  concepto      // clave del registro: de ahí salen rótulo, "qué mide", fórmula, variables y alias del Excel
  universo      // "paid" | "todas"
  valor         // número | null  (null = "—", siempre con motivo en palabras)
  unidad        // conteo | COP | USD | porcentaje | veces
  partes?       // [numerador, denominador] con que se calculó: "con los números de esta cifra"
  periodo       // texto del periodo y los filtros con que se calculó (chips de "Calculada con")
  cobertura     // { completa } | { parcial, motivo }
  enCurso?      // el periodo no ha cerrado
  comparacion?  // { referencia, valor }   (solo si se pidió comparar, o la columna anterior en una tabla)
  estado?       // { tono, fuente: "esperado" | "objetivo", umbrales }
  avance?       // { llevamos, meta, esperado, fraccionDeTiempo }
  notas?        // [rótulo, frase] propias de la cifra (otras campañas, proyectado contra real)
  lista         // la lista detrás de la cifra; sin lista no se muestra
}
```

Lo arma el servidor; la pantalla solo lo pinta, así la explicación y la cifra no se pueden separar. Las piezas que ya existen y
se evolucionan, no se duplican (§9 punto 9 de `structure.md`): `components/cifra-con-lista.tsx`,
`components/como-se-calcula.tsx` (hoy un diálogo con texto libre), `components/variacion.tsx` y
`components/hub/barra-de-avance.tsx`. El texto de la explicación vive en la ficha del concepto (`FichaDeMetrica` en
`lib/metricas/registro.ts`, campos nuevos `que`, `formula`, `variables`, `aliasExcel`), no en la pantalla ni en el MCP.

## 11. Cómo trabajan dos personas (ola O12)

Ver `docs/plan-reparto.md` §4, ola O12, y los tickets 414 a 421 en `docs/tasks/README.md`, sección 21.
