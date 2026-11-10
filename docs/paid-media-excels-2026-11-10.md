# Los Excels de reporte diario de Pauta contra el CRM (10-nov-2026)

> **Documento de reunión** (ADR 0115, N8): manda ADR vigente > ticket > este documento. Lo escribió la sesión hija G del 412
> (solo análisis, sin código ni migraciones). Cruza dos archivos que Mani descargó (`Reporte_Diario_Llamada_Comunicarte.xlsx`
> y `Reporte_Diario_Llamadas_Tactical.xlsx`) con la pestaña Hub › Pauta que ya está en `main`. Los archivos **no se copian al
> repo**: tienen datos de negocio. Aquí solo hay estructura, fórmulas y cifras agregadas como ejemplo de forma.
> Existe un tercero, `Reporte_Diario_Llamadas_PowerTalk.xlsx`, que **no se leyó** (no estaba en el encargo): ver Q-1.

## Resumen en diez líneas

1. Son el Excel de Pauta que Dani Rodríguez pidió reemplazar (F1 de `paid-media-2026-11-09.md`). Un archivo por programa, **un
   renglón por métrica y una columna por día**, una hoja por cohorte, más un bloque semanal y un "Resumen del periodo". La nota
   de Tactical lo dice: *"Inversión y agendas se toman de Meta; llamadas y ventas del CRM"*; solo se capturan a mano las celdas azules.
2. **Casi todo ya existe en el CRM**: inversión, ventas, costo por agenda, ROAS y show/cierre los cubre la tabla semanal del 412
   (algunos con otra definición, §2). Faltan sin migración el CAC y la inversión por cuenta; y el plan diario ("inversión sugerida") no existe.
3. **Lo que falta no son métricas, es una vista por día**: la tabla del 412 es semanal. Dani pidió "sección semanal y diaria". El Excel
   es diario por construcción.
4. **El Excel miente en tres lugares que el CRM no debe copiar**: ingresos = ventas × un ticket fijo y una TRM fija (3.184), ROAS y
   conversión del mismo día (se vio 150 % y `#DIV/0!`), y totales con rangos que no cubren toda la hoja.
5. **Medido con el CRM de producción (solo lectura, Tactical, 5 a 11 oct)**: ventas 5 en el Excel contra 6 en el CRM (USD 8.850
   vendido contra ≈ USD 7.500 que da 5 × el ticket fijo); agendas 88 contra 124 de Paid creadas (162 en todas las áreas), y
   llamadas realizadas 30 contra 8 shows con tasa "parcial". **Las agendas y las llamadas no cuadran y no sé decir por qué**: Q-2 y Q-3.
6. **El bloqueo real para apagar el Excel es el dato, no la pantalla**: el CRM tiene pocos resultados de llamada marcados y el gasto de
   Meta cargado solo desde el 1-oct (el ROAS de la semana del 21 al 27 de sep sale "—", y el CRM ve 1 venta donde el Excel ve 13).
7. **Recomendación**: no hacer una pestaña ni una vista "reporte diario" aparte. Dar a la tabla del 412 un interruptor **Por semana | Por
   día** (misma consulta, otro paso), agregar 3 filas (CAC, inversión por cuenta, plan) y cerrar las 4 preguntas de definición.
8. **¿Reorganizar el Hub?** No las cuatro pestañas (Hoy, Comercial, Dinero, Pauta). Sí hay que decidir si Pauta, que hoy junta ocho
   bloques, se parte en dos vistas. Esa decisión se toma con la pestaña ya mostrando el diario (§5.3), no antes.
9. Cinco tickets propuestos (413 a 417), uno con migración (el plan de inversión diario).
10. Nueve preguntas abiertas para Mani y Paid Media (§6). Ninguna se asumió.

## 1. Inventario de los Excels

### 1.1 Estructura común

| Elemento | Qué es |
|---|---|
| Hojas | Comunicarte: `Comunicarte Llamada` (12-ago a 25-sep, 46 columnas de día) y `Cohorte Oct - Nov` (26-sep a 13-nov, 50). Tactical: `Tactical` (19-ago a 4-oct, 48) y `Cohorte Oct - Nov` (5-oct a 15-nov, 43). **Una hoja por cohorte**; el CRM tiene cohortes y las hojas no las nombran. |
| Eje | Fila 4 = fecha (una columna por día, **incluye sábados y domingos**), última columna = TOTAL. |
| Bloque diario | Filas 5 a 25 (Comunicarte) o 5 a 16 (Tactical): un renglón por métrica. |
| Resumen del periodo | Bajo el diario: meta de cupos, ticket, presupuesto, ventas acumuladas, etc. Una sola columna de valores. |
| Bloque semanal | Más abajo: las mismas métricas sumadas por semana más TOTAL. Semanas de Comunicarte: sáb a vie en la cohorte (26-2 oct, 3-9 oct…); en Tactical: lun a dom (5-11 oct, 12-18 oct…). |
| Formato | Celdas azules = captura manual. Formato condicional que pinta de color cada renglón cuando la celda contiene la palabra `NONE` (es el "vacío" del libro; no hay umbrales de semáforo). Sin comentarios ni validaciones de datos. |
| Quién parece servir | **Ambos**. Inversión y agendas de Meta son de Pauta (César llena). Llamadas y ventas son comerciales (Michael las llena a mano con lo que le pasan los closers, F1). Costo por agenda, CAC y ROAS son el cruce de los dos. Por eso nadie lo puede dejar. |
| Título | Dice `REPORTE DIARIO \| 3 - 29 SEPTIEMBRE 2026` en tres de las cuatro hojas aunque cubren ago a nov. Es un dato de lo mal mantenido que está. |

### 1.2 Hojas de Comunicarte (dos cuentas de Meta: Milena y Rosario)

Mismas filas en las dos hojas. `F` = fórmula; `M` = captura manual.

| Fila | Renglón | Cómo se llena / calcula | Notas |
|---|---|---|---|
| 5 | Inversión Milena | M (COP) | Cuenta publicitaria Milena. |
| 6 | Agendas en Meta (Milena) | M | Pixel de Meta, no el CRM. |
| 7 | Costo por agenda (Milena) | F `=IFERROR(inv/agendas, "NONE")` | |
| 8 | Inversión sugerida (Milena) | M (constante por semana: 300.000 al inicio) | El plan. Rótulo con typo ("Inervsión"). |
| 9 | Inversión Rosario | M (COP); en la hoja de octubre muchas celdas son `=(total_de_la_cuenta - inversión Milena)` | O sea: Rosario = total de una cuenta menos Milena, calculado a mano. |
| 10 a 12 | Agendas Meta, costo, inversión sugerida (Rosario) | igual que Milena | |
| 13 | Inversión total | F `=Milena + Rosario` | |
| 14 | Agendas en Meta (total) | F `=Milena + Rosario` | |
| 15 | Costo por agenda (total) | F `=IFERROR(13/14)` | Es el "Costo por agenda según Meta" (D-1). |
| 16 | Agendas del día | M | **Sin fuente declarada.** Ver Q-2. |
| 17 | Llamadas realizadas | M | Del CRM según la nota de Tactical, a mano. |
| 18 | Ventas | M | Idem. |
| 19 | % Conversión (ventas/llamadas) | F `=IF(17>0, 18/17, "NONE")` | El mismo día: ventas de hoy ÷ llamadas de hoy. Se vio 150 %. |
| 20 | CAC (costo por venta) | F `=IF(18>0, 13/18, "NONE")` | Gasto total del día ÷ ventas del día. |
| 21 | Ingresos | F `=IF(18>0, 18 × $ticket, "NONE")` | **Ventas × ticket fijo en COP** (2.537.648 = USD 797 × 3.184). No es la plata vendida ni la caja. |
| 22 | ROAS estimado | F `=IF(18>0, 21/13, "NONE")` | Ingresos ÷ inversión del mismo día. Da `#DIV/0!` un día con ventas y sin inversión. |
| 23 | Ventas necesarias hoy | F solo en el último tramo: `=(meta − ventas acumuladas) ÷ NETWORKDAYS(hoy, fecha fija)` | La fecha fija (22-sep) y la meta (`$AB$29`, celda vacía) están mal: no calcula. |
| 24 | Inversión sugerida (total) | F `=Milena sugerida + Rosario sugerida`; en octubre constantes (750.000, 840.000) | Se escalona por semana: 300.000, 560.000, 750.000, 840.000. |
| 25 | Diferencia vs plan | F `=inversión real − sugerida` | Positivo = gastó de más. |
| 29 a 40 | Resumen del periodo | meta de cupos (50/60), ticket, presupuesto del periodo (15,3 M / 35 M COP), "agendas/día necesarias" (texto a mano: `~12`, `~16`), ventas acumuladas (`SUM`), % cumplimiento, inversión acumulada, % presupuesto usado, agendas totales, agendas/día real, CAC del periodo, ROAS del periodo | En la hoja de octubre solo hay las constantes; **las fórmulas no están** (F34 a F40 vacías). |
| bloque semanal | las 15 filas de arriba, por semana | `SUM` de las columnas de cada semana; costo, conversión, CAC y ROAS recalculados sobre las sumas | Los rangos de semana están escritos a mano (`SUM(G5:M5)`). |

### 1.3 Hojas de Tactical (una sola cuenta)

Tactical usa 12 renglones diarios más 6 filas de resumen y 4 de notas. Diferencias con Comunicarte:

| Fila | Renglón | Cómo se calcula |
|---|---|---|
| 5 | Inversión | M (COP). Algunas celdas son sumas de dos gastos (`=(549770+252820)`). |
| 6 | Agendas en Meta | M. |
| 7 | Costo por agenda | F `inv/agendas` |
| 8 | Agendas del día | M |
| 9 | Llamadas realizadas | M |
| 10 | Ventas | M |
| 11 | Porcentaje de cierre | F `ventas/llamadas` (el mismo día) |
| 12 | Ingresos | F `ventas × $Q$20` (4.776.000 = USD 1.500 × 3.184) |
| 13 | ROAS | F `ingresos ÷ inversión` |
| 14 a 16 | Ventas necesarias hoy / Inversión sugerida / Diferencia vs plan | La "sugerida" es **la inversión real copiada** (`=(B5)`) hasta una fecha y después `real − …`: no es un plan, es un espejo. |
| 19 a 30 | Resumen | meta de cupos (60), ticket COP, presupuesto del periodo (16,74 M COP), agendas/día necesarias (3,7 escrito a mano), ventas acumuladas, % cumplimiento, inversión acumulada, `% presupuesto utilizado = AW5/$Q$21` (usa el total de la columna de la hoja, no la suma del rango), agendas acumuladas, agendas/día promedio real (cuenta los días en cero), CAC del periodo, ROAS del periodo `= ventas × ticket ÷ inversión` |
| 33 a 36 | Notas | *Celdas azules: captura manual diaria. Inversión y agendas se toman de Meta; llamadas y ventas del CRM. Plan: $620.000/día sobre 27 días. Ticket USD 1.500 (TRM 3.184). Referencia al 3 de septiembre: costo por agenda $139.448, cierre 47,8 %.* |
| 41 a 50 | Bloque semanal | 10 filas: inversión, agendas Meta, costo, agendas del día, llamadas, ventas, conversión, CAC, ingresos, ROAS |

### 1.4 Errores y olores del propio Excel (hechos, no opinión)

| # | Hecho | Dónde |
|---|---|---|
| E-1 | Ticket y TRM fijos (3.184); no cambian con el día. | Comunicarte `$X$30`, Tactical `$Q$20` |
| E-2 | Conversión y ROAS del mismo día; ventas de hoy ÷ llamadas de hoy puede pasar de 100 %; sin inversión da `#DIV/0!`. | filas 19, 22 / 11, 13 |
| E-3 | `AU21` suma `c-45 : c-4`: deja fuera las tres últimas columnas de día. | Comunicarte fila 21 |
| E-4 | `% presupuesto utilizado` usa una celda de total de otra zona (`AU13`, `AW5`, `AR5`) en vez de la suma del rango. | resumen |
| E-5 | "Agendas/día promedio" divide por los días con número, incluidos los ceros y los fines de semana. | resumen |
| E-6 | "Agendas/día necesarias" es texto escrito a mano (`~12`). | resumen |
| E-7 | Rotulación vieja (títulos de septiembre en hojas de octubre; "Inervsión"; "Inversion Rosario Cuenta"). | varias |
| E-8 | Inversión Rosario es "total de una cuenta menos Milena" en muchas celdas: la regla vive en la cabeza de quien llena. | Comunicarte oct |
| E-9 | La hoja de octubre de Comunicarte no tiene las fórmulas de resumen. | Cohorte Oct - Nov |

## 2. Cruce fila por fila contra el CRM

Leyenda: ✅ existe igual · 🟡 existe con otra definición · ❌ falta · 🚫 no debe existir como está. "M#" = el catálogo de
`docs/paid-media-2026-11-09.md` §3. "412" = ya lo muestra la tabla semanal de Hub › Pauta (`lib/queries/hechos/pauta-semanal.ts`,
`DEFINICION_FILAS`).

| Renglón del Excel | Estado | En el CRM / qué difiere | ¿Lo cubre el 412? |
|---|---|---|---|
| Inversión (total) | ✅ | M1, `gastoConvertido`; en la tabla en COP, sumado de todas las cuentas del programa | Sí |
| **Inversión por cuenta** (Milena, Rosario) | ❌ | El gasto está por anuncio y `pauta_objetos.cuentaId` lo liga a la cuenta, pero **la cuenta no es una dimensión** de `lib/queries/hechos/dimensiones.ts` ni fila de la tabla. `cuentas-del-programa.tsx` muestra la salud de la cuenta, no su gasto | No |
| Agendas en Meta (total / por cuenta) | 🟡 | M4/M6: existe `gasto_pauta.agendas_meta`; en la tabla sale **dentro** de "Costo por agenda (según Meta)", no como cifra propia ni por cuenta | Parcial |
| Costo por agenda (total) | 🟡 | El Excel = inversión total ÷ agendas Meta. El CRM tiene **dos**: del CRM (M5, solo gasto de campañas `agenda` ÷ agendas CRM Paid) y según Meta (M6). D-1 y D-2 las separan; el Excel suma todo el gasto, incluida la que no es de agenda | Sí (las dos) |
| Costo por agenda por cuenta | ❌ | Mismo hueco de la dimensión cuenta | No |
| Agendas del día | 🟡 | Hoy el CRM tiene **tres** (creadas, §1.2; citas del día, §1.3; Meta, §1.9). El Excel no dice cuál. **Medido: no cuadra con ninguna** (§3) | Sí (creadas Paid) |
| Llamadas realizadas | 🟡 | CRM: `show` (cita cuyo resultado ocurrió) o "Realizadas" de Hoy. Depende de que el closer haya marcado el resultado | Sí (como base de % de show) |
| Ventas | ✅ | M7, deals en Abonado o Completo por día de venta (§1.4). El Excel es "del CRM, a mano" | Sí |
| % Conversión / % de cierre (ventas/llamadas del día) | 🟡 | M13 "Cierre de ventas" = ventas ÷ shows **del mismo grupo de citas** (ADR 0079, 187). El Excel divide dos conteos de universos distintos y puede pasar de 100 % | Sí (M13) |
| CAC (costo por venta) | ❌ | Fórmula en `metricas.md` §3.2 marcada 🟡 ("123"), nunca se construyó. Es gasto Paid ÷ ventas Paid. **Falta y no necesita migración** | No |
| Ingresos | 🚫 | Ventas × ticket fijo en COP con TRM fija. Viola "todo dinero derivado tiene UNA definición" (ADR 0024) y "nunca convertir moneda en silencio". El equivalente real es **Facturación** (M9, valor vendido, USD) | Sí (como Facturación) |
| ROAS estimado / ROAS del periodo | 🟡 | M10: vendido de Paid (USD) ÷ gasto USD con la TRM del día, anclado por **cohorte de registro** (355), con cobertura y "parcial: N agendas pendientes". El Excel ancla la venta al día de la venta y al ticket | Sí (M10) |
| Profit (no está en el Excel) | ✅ | M11. El Excel lo tiene solo en la imagen KPI de 30X | Sí |
| Inversión sugerida (por cuenta y total) | ❌ | Es un **plan diario de inversión**. En el CRM existe la meta de inversión **de la cohorte** (`objetivos.inversion`, migración 0132) y `inversionDiaMeta`/`inversionDiaPromedio` calculados (`lib/metas/cumplimiento-de-cohorte.ts`). **No hay valor por día ni por cuenta** | No |
| Diferencia vs plan | ❌ | Depende del plan diario | No |
| Ventas necesarias hoy | ✅ (en Hoy) | `metaDeHoy` en Hub › Hoy, el "Objetivo del día" (DA-5). En Pauta, `requeridos` del cumplimiento. Ver si hace falta por Paid solamente | Parcial |
| Resumen: meta de cupos, ventas acumuladas, % cumplimiento | ✅ | Cumplimiento de la cohorte (371, hija C): llevamos / meta, % sobre el total, % sobre lo esperado, estado | Sí |
| Resumen: presupuesto del periodo, inversión acumulada, % presupuesto utilizado | ✅ | `cumplimiento.inversion = { llevamos: gastoCop, meta }`. Funciona cuando alguien cargue `objetivos.inversion` de la cohorte (tarea de Mani, §13 del doc del 9-nov). **Verificar la barra en pantalla**, no se pudo ver aquí | Sí (con la meta cargada) |
| Resumen: agendas/día necesarias | ✅ | Agendas requeridas por día (`calcularProyeccion`) calculadas, no escritas | Sí |
| Resumen: agendas/día promedio real | ❌ | No está en el cumplimiento. Es trivial (agendas ÷ días hábiles del periodo). OJO a E-5: contar solo días hábiles (regla: sábado y domingo no cuentan, dato de `AGENTS.md`) | No |
| Resumen: CAC del periodo | ❌ | Mismo hueco del CAC | No |
| Bloque semanal completo | ✅ | La tabla semanal (lun a dom, Bogotá, D-3). **Difiere el calendario**: el Excel de Comunicarte corta sáb a vie | Sí |
| Nota: "referencia al 3 de septiembre" (costo por agenda de 139.448, cierre 47,8 %) | ❌ | Línea de base escrita en una nota. En el CRM sería una meta (`objetivos`, D-6) | No |
| Separación por cohorte (una hoja por cohorte) | ✅ | Filtro de cohorte `?cohorte=` (377) | Sí |

Filas del 412 que **el Excel no tiene** y que Paid Media pidió: M15 a M19 (CPM, CTR, llegada y conversión de la landing,
frecuencia) y los semáforos. Son las que sacan al CRM de ser solo un reemplazo.

### 2.1 Reglas duras que tocan al Excel

| Regla | Qué pasa en el Excel | Qué hacer en el CRM |
|---|---|---|
| El programa es una frontera (AGENTS.md) | Un archivo por programa: correcto. **No** hay suma entre programas. Las dos cuentas de Comunicarte son del mismo programa y la misma moneda (COP): sumarlas es válido. | Cuenta es una dimensión **dentro** de un programa; nunca se suma "todas las cuentas de todos los programas" en una tasa |
| Anulados no cuentan | Las ventas y llamadas se escriben a mano: una venta anulada puede seguir contada. | Ya lo garantiza `vigente()` |
| Nunca convertir moneda en silencio | El ticket en COP viene de USD × 3.184 fija. Ingresos y ROAS no son comparables con Meta en USD. | `convertirGasto` con la TRM del día (ya) |
| Toda fecha es de Bogotá | El Excel no dice zona; el gasto de Meta ya viene en `America/Bogota`. | Sin cambio |
| Solo días hábiles | Promedios cuentan todos los días con número (E-5). | Promedio por hábil, mostrando "por día calendario" solo si se pide |
| Cobertura, nunca un número a medias (N3) | `NONE` es un texto; `0` y "sin dato" se confunden. | `—` con razón; `0` es cero |
| Un concepto, un módulo (N1) | "Agendas del día" y "Llamadas realizadas" son lo que cada persona entiende ese día. | Una definición por columna del Excel (Q-2, Q-3) antes de dibujarlas |

## 3. Medido contra la base

**No se pudo cuadrar contra la base local.** `npm run db:local` está arriba, pero su seed es sintético (no tiene el gasto de Meta
ni los envíos reales de producción), así que cualquier cuadre ahí no prueba nada sobre los Excels. Para medir con datos reales usé
las herramientas de lectura del CRM de producción (MCP, rol del usuario, solo consulta, cifras agregadas; no se leyó ni se escribió
nada). Ninguna cifra de persona está en este documento.

**Semana 5 a 11 de octubre, Tactical** (lunes a domingo, coincide con la semana del Excel). Fuente CRM: `resumen_del_hub` y
`consultar_metrica` (`agendas_creadas`).

| Renglón | Excel (suma de la semana) | CRM | Veredicto |
|---|---|---|---|
| Ventas | 5 | 6 (por fecha de venta, §1.4) | **Difiere por 1.** Puede ser fecha de registro del Excel, una venta anulada o la regla de "perdido" (§1.4). No se pudo decir cuál sin ver la fila |
| Dinero de esas ventas | 5 × 4.776.000 COP = 23,88 M COP; a 3.184 ≈ **USD 7.500** | Vendido **USD 8.850** (recaudado 6.475, por cobrar 2.375) | **Difiere**: el Excel estima con el ticket de lista; el CRM suma el valor vendido real de 6 deals. Confirma que "Ingresos" ≠ Facturación |
| Agendas del día | 88 | 124 creadas de Paid; 162 creadas de todas las áreas; 65 citas con fecha en la semana | **No cuadra con ninguna** (Q-2) |
| Llamadas realizadas | 30 | 8 shows (citas con resultado "ocurrió"); tasa de show y de cierre salen **"parcial", cobertura 35 %** | **No cuadra** y el CRM avisa que le faltan resultados (Q-3) |
| Inversión | 5.634.397 COP (con un 5-oct en 0 y 11-oct con gasto) | **No se pudo medir**: `pauta_roas` respondió "Error interno" (se reportó al final) | Sin dato |
| Agendas según Meta | 77 | No expuesto por las herramientas de lectura | Sin dato |

**Semana 21 a 27 de septiembre, Comunicarte** (Excel: 13 ventas, 27 llamadas, 65 agendas, 3,07 M COP de inversión). CRM: **1
venta**, 0 citas, 0 agendas creadas; el ROAS de la ventana sale **"—, Gasto de Meta desde el 1 oct 2026"**. Es la cobertura (N3)
funcionando: el CRM empezó a guardar gasto el 1-oct y las agendas anteriores a esa fecha no están en su base. **Consecuencia práctica:**
mientras Paid Media quiera ver septiembre, tiene que seguir en el Excel; el CRM solo reemplaza lo posterior al 1-oct.

**Lo que quedó sin medir y por qué:** la inversión de la semana (necesita `gasto_pauta` de producción; no hay herramienta de lectura
del gasto, solo el ROAS que falló) y la tabla semanal tal como la ve Dani en pantalla (no la abrí; la sesión no tiene login al CRM
desplegado). Se puede cuadrar en minutos con el CRM abierto: Hub › Pauta, programa Tactical, 5 a 11 oct, cohorte del 5-oct, y comparar
Inversión, Agendadas y Ventas contra los números de arriba (PQ-3 del doc del 9-nov).

## 4. Qué hay que decidir antes de construir (las cuatro definiciones)

1. **Agendas del día**: ¿creadas ese día, con cita ese día o del pixel? (Q-2). Hoy no se puede decir cuál usa el Excel.
2. **Llamadas realizadas**: ¿shows marcados en el CRM o llamadas que los closers reportan sin marcar? (Q-3).
3. **Qué día cuenta una venta** en el reporte diario de Pauta: el de la venta (Comercial) o el del registro (ROAS 355). Las dos
   existen y dan cifras distintas por diseño; mezclarlas en una fila es el error medido el 30-oct (ADR 0115).
4. **El plan de inversión diario** (la fila "sugerida"): ¿lo fija Pauta día a día o sale de la meta de inversión de la cohorte? (Q-4).

## 5. Recomendación

### 5.1 Alternativas

| # | Opción | Qué es | Costo | Riesgo |
|---|---|---|---|---|
| A | **Reproducir el Excel tal cual**: una vista "Reporte diario" con sus renglones y sus fórmulas | Una pantalla nueva con 16 renglones por día y el bloque semanal | Alto: una consulta y un componente nuevos | Copia E-1 a E-9. Una segunda definición de ventas, agendas y ROAS (viola N1). Dos pantallas con cifras distintas para la misma pregunta: justo lo que la auditoría del 30-oct encontró |
| B | **Ampliar la tabla del 412 con paso diario** (recomendada) | El mismo `cargarPautaSemanal` acepta un paso (`dia` \| `semana`); las filas son las mismas y el selector de la URL (`?g_<clave>=...`, `lib/series-pasos.ts`) ya lo modela para las gráficas. Más 3 filas nuevas | Medio-bajo: sin migración para el diario, CAC e inversión por cuenta; migración solo para el plan | Hay que decidir el calendario (Excel de Comunicarte corta sáb a vie, el CRM lun a dom, D-3) |
| C | No hacer nada y que Pauta siga en el Excel | | Cero | Doble captura diaria, cifras que no cuadran, el CRM nunca es la fuente única (norte del 3-nov) |

**Recomiendo B**, por tres razones argumentadas con el repo: (1) el 412 ya tiene la consulta y la cobertura por celda; un paso
diario reutiliza `semanasDelRango` y `agrupar` de los hechos sin tocar definiciones (N1). (2) Dani lo pidió así: *"una sección semanal
y una sección diaria … de tal fecha a tal fecha"*. (3) Con A se vuelve a escribir "ventas del día" y "agendas del día" por una tercera
vía; el Excel no es una fuente de definición, es el síntoma que se quiere quitar.

### 5.2 Qué incluye B, fila por fila

| Pieza | Qué se hace | Migración |
|---|---|---|
| Paso Por día | El interruptor Por semana \| Por día de la tabla del 412. Con "Por día" las columnas son los días del periodo (con fines de semana) y se ocultan las filas que no tienen sentido diario (Frecuencia ya es "—" en varios días; D-5) | No |
| CAC | Una fila nueva `Costo por venta` en General: gasto total de Paid ÷ ventas de Paid, en COP, con cobertura. Cierra la fila 🟡 123 de `metricas.md` | No |
| Inversión por cuenta | Dimensión `cuenta` en `hechos/dimensiones.ts` (vía `pauta_objetos.cuentaId`) y un desplegable "Ver por cuenta" para Inversión, Agendas Meta y Costo por agenda según Meta | No |
| Plan de inversión diario | Valor por día (y cuenta) de lo "sugerido", con la fila "Diferencia vs plan" | **Sí** (tabla nueva o columna; ver §5.4) |
| Promedios por día hábil | "Agendas/día real" calculado, nunca escrito | No |
| Línea de base | Las notas como metas de cohorte (`objetivos`, D-6), no como texto | No |

### 5.3 ¿Hay que reorganizar el Hub?

**Respuesta corta: las cuatro pestañas no se tocan; lo que hay que revisar es cuánto cabe dentro de Pauta.**

Lo que hay hoy (`app/(app)/p/[programa]/hub/page.tsx`): **Hoy** (el reporte del día, plantilla de Michael, 373), **Comercial** (embudo y
closers), **Dinero** (caja y metas), **Pauta** (Origen más Pauta, 412). Comparten el periodo, el filtro de cohorte y el contrato de
`structure.md` §9.

Por qué no reorganizar las cuatro:

- Cada pestaña ya responde una pregunta de una persona distinta: Hoy = el cierre del día de Michael a Dani; Comercial = los closers;
  Dinero = Gerencia; Pauta = Paid Media. Mover cifras entre ellas rompería lo que Daniel Tovar pidió el 3-nov ("primero comercial,
  terminadísimo").
- El Excel reproduce Pauta + Comercial **del universo Paid**, y eso el 412 ya lo hace dentro de Pauta con `area: paid`. No hace falta
  una pestaña nueva; hace falta que la misma fila diga qué universo mide (ver abajo).

Lo que sí hay que ordenar (propuesta, a decidir con la pantalla delante):

| Pestaña | Qué vive | Por qué |
|---|---|---|
| **Hoy** | Sin cambio. Reporte del día (cupos, leads, citas, ventas, caja, por closer, PDF) | Es la plantilla v5 de Michael; no mezclarla con pauta |
| **Comercial** | Sin cambio. Embudo, show, cierre, closers, todas las áreas | Universo = todas las áreas |
| **Dinero** | Sin cambio. Caja, vendido, saldo, metas del mes y de la cohorte | |
| **Pauta** | **Resultados** (arriba y siempre visible): cifras del periodo, cumplimiento de la cohorte, tabla con Por día \| Por semana y Por cuenta, gráfica. **Origen y calidad** (más abajo, o en su propia vista): tabla por canal, campaña y anuncio (355), traza, embudo del formulario, ROAS proyectado | Hoy son ocho bloques en una sola pantalla; Paid Media pide primero lo que sustituye al Excel |

Dos riesgos de naming que sí hay que resolver (N4):

1. **Show, Cierre de ventas y Agenda → venta aparecen en Comercial (todas las áreas) y en la tabla de Pauta (solo Paid).** Son el
   mismo concepto con dos universos. La tabla debe rotular "de Paid" y el "Cómo se calcula" de Comercial "todas las áreas". Un módulo, un
   parámetro de área, nada de una segunda función.
2. **"Agendas" tiene hoy tres significados en pantalla.** Antes de poner "agendas del día" en una columna diaria, fijar cuál (Q-2).

Si tras el diario la pestaña Pauta pasa de ~8 bloques a ~10, vale partirla en dos vistas con el mismo componente de pestañas
(`Pestanas`), no con plegables: `structure.md` §9 dice que **lo principal no se pliega**. No lo afirmo hoy: no tengo la longitud
medida de la pantalla real.

### 5.4 Plan de inversión diario: tres formas, una decisión

| Forma | Cómo | Costo | Cuándo sirve |
|---|---|---|---|
| a | Reparto automático de `objetivos.inversion` de la cohorte entre los días hábiles que quedan (ya existe `inversionDiaMeta`) | Cero migración | Si "sugerida" es solo el presupuesto repartido |
| b | Tabla `plan_inversion` (programa, cuenta, fecha, monto, moneda) editable en Hub, con `change_log` por el molde | Migración + pantalla | Si Pauta fija el número cada día (hoy: 300.000 → 560.000 → 750.000 → 840.000, escalonado por semana) |
| c | Dejarlo fuera: el CRM no decide, Pauta sigue con su plan en otro lado | Cero | Si el plan es juicio de Pauta y no debe vivir en el CRM |

No elijo: depende de Q-4. Mi inclinación es **a** con una excepción **b** por semana si Pauta lo confirma (los cambios son semanales,
no diarios), pero es una inclinación sin datos.

## 6. Tickets propuestos (no creados)

Los números son los siguientes libres en `docs/tasks/` (el último archivo es el 412). **Verificar el tracker antes de tomarlos**: otras
sesiones pueden reservar números.

| # propuesto | Título | Alcance | Depende de | Migración |
|---|---|---|---|---|
| 413 | Tabla de Pauta por día | Paso `dia` en `cargarPautaSemanal` y `TablaSemanalDePauta`; interruptor en la URL (`lib/series-pasos.ts`); CSV por día; el límite de columnas razonable y paginación o desplazamiento horizontal; tests de paridad día = suma de la semana | 412, Q-2, Q-3 | No |
| 414 | Costo por venta (CAC) de Paid | Fila nueva con cobertura, módulo único, fila en `metricas.md` §3.2 (cierra el 🟡 123), nombre en `overview.md` §11 | 412 | No |
| 415 | Pauta por cuenta | Dimensión `cuenta` en `hechos/dimensiones.ts`; "Ver por cuenta" para inversión, agendas Meta y costo por agenda según Meta; no suma programas | 412 | No |
| 416 | Plan de inversión diario y diferencia vs plan | Según Q-4: reparto de la meta de cohorte (sin migración) o tabla editable `plan_inversion` por el molde `lib/catalogo/`; fila "Diferencia vs plan" | 413, 415, Q-4 | **Sí** si se elige la tabla |
| 417 | Cuadre del Excel y retiro | Con una semana cerrada de Paid Media (PQ-3), probar la tabla contra el Excel fila por fila y anotar las diferencias; criterio para apagar el Excel | 413, 414, 415 | No |

Y una decisión sobre la que no propongo ticket aún: ordenar Pauta en dos vistas (§5.3). Se abre después del 413.

## 7. Preguntas abiertas (nada asumido)

| # | Pregunta | A quién | Por qué importa |
|---|---|---|---|
| Q-1 | ¿Hay que leer también el Excel de PowerTalk? ¿Es un programa de Retia que falta en el CRM (PQ-1 del doc del 9-nov)? Las cuentas dicen que Power Talk es Comunícate con Confianza | Mani, Paid Media | El tercer archivo existe en Descargas y no se leyó |
| Q-2 | "Agendas del día": ¿cita creada ese día, cita con fecha ese día, o la del pixel? Medí 88 contra 124 Paid creadas, 162 totales y 65 citas | Michael / Paid Media | Define la fila diaria; sin esto el diario no cuadra |
| Q-3 | "Llamadas realizadas": ¿lo que el closer reporta o lo marcado en el CRM? Medí 30 contra 8 shows con cobertura 35 % | Michael, closers | Si es lo marcado, el trabajo es que los closers marquen; si no, el Excel mide otra cosa |
| Q-4 | "Inversión sugerida": ¿la fija Pauta cada día o sale de un presupuesto repartido? | Paid Media | Decide si hay migración (§5.4) |
| Q-5 | ¿Qué día cuenta una venta en el reporte diario de Pauta: el de la venta o el del registro? | Mani | Define la fila de ventas y el ROAS diarios; ya existen las dos |
| Q-6 | ¿La semana de Pauta es lun a dom (D-3) o sáb a vie como en la hoja de Comunicarte? | Paid Media | Cambia todos los totales semanales |
| Q-7 | ¿Se puede retirar el Excel de lo anterior al 1-oct, o hay que cargar un histórico a mano en el CRM? | Mani | El CRM no tiene gasto ni agendas previas: el Excel de septiembre no tiene equivalente |
| Q-8 | ¿Inversión por cuenta se necesita por Milena y Rosario como columnas siempre visibles, o basta un desplegable? | Paid Media | Define el costo de pantalla de 415 |
| Q-9 | ¿Quién llena hoy la "línea de base" (costo por agenda 139.448, cierre 47,8 %) y debería ser una meta de cohorte? | Paid Media | Convierte una nota en un objetivo con semáforo (D-6) |

## 8. Lo que no pude verificar

- El estado actual de la barra de inversión del cumplimiento con una meta cargada, y cómo se ve la tabla semanal en pantalla: no abrí
  el CRM desplegado.
- La inversión y las agendas de Meta de la semana medida (§3): `pauta_roas` falló con "Error interno" en producción. **Conviene
  revisar ese error** (no es de esta sesión; lo anoto aquí para que alguien lo vea).
- Qué hay en el tercer Excel (PowerTalk).
- Por qué ventas 5 contra 6: se necesita la lista de deals de la semana, que no traje para no meter datos de personas en este documento.
